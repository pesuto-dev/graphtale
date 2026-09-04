import { randomBytes } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import { discoverSkills } from "./discover";
import { parseProcedure } from "./parseProcedure";
import { parseSkill, wrapperAroundLink } from "./parseSkill";
import { extraWatchFiles, isWatchedChange } from "./shared/watch";
import type {
  CatalogSkill,
  FileContentPayload,
  HostToWebview,
  LayoutDirection,
  ProcedureDiagnosis,
  SkillGraph,
  WebviewToHost,
} from "./shared/protocol";
import { emptyDiagnosis, isWebviewToHost } from "./shared/protocol";

const DIRECTION_KEY = "graphtale.layoutDirection";

export class GraphtalePanel {
  public static current: GraphtalePanel | undefined;

  public static createOrShow(context: vscode.ExtensionContext, skillRoot?: string): void {
    const column = vscode.ViewColumn.Beside;
    if (GraphtalePanel.current) {
      GraphtalePanel.current.panel.reveal(column);
      if (skillRoot) {
        GraphtalePanel.current.openSkill(skillRoot);
      }
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      "graphtale.viewer",
      "Graphtale",
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "dist", "webview")],
      },
    );
    GraphtalePanel.current = new GraphtalePanel(panel, context, skillRoot);
  }

  private catalog: CatalogSkill[] = [];
  private graph: SkillGraph | undefined;
  private procedure: SkillGraph | undefined;
  private diagnosis: ProcedureDiagnosis = emptyDiagnosis();
  private direction: LayoutDirection;
  private watchedFiles: string[] = [];
  private watchers: vscode.Disposable[] = [];
  private staleTimer: ReturnType<typeof setTimeout> | undefined;

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly context: vscode.ExtensionContext,
    skillRoot: string | undefined,
  ) {
    this.direction = context.workspaceState.get<LayoutDirection>(DIRECTION_KEY, "LR");
    this.panel.webview.html = this.html();
    this.panel.onDidDispose(() => {
      this.disposeWatch();
      GraphtalePanel.current = undefined;
    });
    this.panel.webview.onDidReceiveMessage((raw: unknown) => {
      if (!isWebviewToHost(raw)) {
        return;
      }
      this.onMessage(raw);
    });
    const initial = skillRoot ?? this.defaultSkillRoot();
    if (initial) {
      this.openSkill(initial);
    } else {
      this.refreshCatalog();
      this.procedure = emptyGraph();
      this.diagnosis = emptyDiagnosis();
      this.post({
        type: "graph",
        graph: emptyGraph(),
        procedure: this.procedure,
        pipeline: this.procedure,
        diagnosis: this.diagnosis,
        catalog: this.catalog,
        direction: this.direction,
      });
    }
  }

  public refresh(): void {
    if (this.graph?.rootPath) {
      this.openSkill(this.graph.rootPath);
    }
  }

  public openSkill(skillRoot: string): void {
    this.refreshCatalog();
    this.graph = parseSkill({ skillRoot, catalog: this.catalog });
    const parsed = parseProcedure({ skillRoot, catalog: this.catalog });
    this.procedure = parsed.graph;
    this.diagnosis = parsed.diagnosis;
    this.panel.title = `Graphtale - ${this.graph.skillName}`;
    this.watchSkill(skillRoot);
    this.post({
      type: "graph",
      graph: this.graph,
      procedure: parsed.graph,
      pipeline: parsed.graph,
      diagnosis: this.diagnosis,
      catalog: this.catalog,
      direction: this.direction,
    });
    this.post({ type: "stale", stale: false });
  }

  private watchSkill(skillRoot: string): void {
    this.disposeWatch();
    this.watchedFiles = extraWatchFiles([
      ...(this.graph?.nodes ?? []).map((node) => node.path),
      ...(this.procedure?.nodes ?? []).map((node) => node.path),
    ]);
    const folder = vscode.Uri.file(skillRoot);
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(folder, "**/*"),
    );
    const mark = (uri: vscode.Uri) => this.markStale(uri.fsPath);
    this.watchers.push(
      watcher,
      watcher.onDidChange(mark),
      watcher.onDidCreate(mark),
      watcher.onDidDelete(mark),
      vscode.workspace.onDidSaveTextDocument((doc) => this.markStale(doc.uri.fsPath)),
    );
  }

  private markStale(filePath: string): void {
    if (!isWatchedChange(filePath, this.graph?.rootPath, this.watchedFiles)) {
      return;
    }
    if (this.staleTimer) {
      clearTimeout(this.staleTimer);
    }
    this.staleTimer = setTimeout(() => {
      this.post({ type: "stale", stale: true });
    }, 120);
  }

  private disposeWatch(): void {
    if (this.staleTimer) {
      clearTimeout(this.staleTimer);
      this.staleTimer = undefined;
    }
    for (const item of this.watchers) {
      item.dispose();
    }
    this.watchers = [];
  }

  private onMessage(message: WebviewToHost): void {
    switch (message.type) {
      case "ready":
        if (this.graph) {
          this.post({
            type: "graph",
            graph: this.graph,
            procedure: this.procedure ?? emptyGraph(),
            pipeline: this.procedure ?? emptyGraph(),
            diagnosis: this.diagnosis,
            catalog: this.catalog,
            direction: this.direction,
          });
        }
        return;
      case "selectNode":
        this.sendFile(message.nodeId);
        return;
      case "openFile":
        void this.openInEditor(message.path);
        return;
      case "setDirection":
        this.direction = message.direction;
        void this.context.workspaceState.update(DIRECTION_KEY, this.direction);
        this.post({ type: "direction", direction: this.direction });
        return;
      case "openSkill":
        this.openSkill(message.rootPath);
        return;
      case "refresh":
        this.refresh();
        return;
      case "copyText":
        void this.copyText(message.text);
        return;
      default: {
        const _exhaustive: never = message;
        return _exhaustive;
      }
    }
  }

  private sendFile(nodeId: string): void {
    const node =
      this.graph?.nodes.find((item) => item.id === nodeId) ??
      this.procedure?.nodes.find((item) => item.id === nodeId);
    if (!node) {
      return;
    }
    const text = node.excerpt ?? safeRead(node.path);
    const payload: FileContentPayload = {
      nodeId: node.id,
      path: node.path,
      text,
    };
    if (node.isBlock && this.graph && !node.excerpt) {
      const skillFile = path.join(this.graph.rootPath, "SKILL.md");
      const skillText = safeRead(skillFile);
      const rel = path.relative(this.graph.rootPath, node.path).split(path.sep).join("/");
      const wrap = wrapperAroundLink(skillText, rel);
      if (wrap) {
        payload.wrapper = { path: skillFile, ...wrap };
      }
    }
    this.post({ type: "fileContent", payload });
  }

  private async copyText(text: string): Promise<void> {
    try {
      await vscode.env.clipboard.writeText(text);
      this.post({ type: "copyResult", ok: true });
    } catch {
      this.post({ type: "copyResult", ok: false });
    }
  }

  private async openInEditor(filePath: string): Promise<void> {
    if (!fs.existsSync(filePath)) {
      void vscode.window.showWarningMessage(`File not found: ${filePath}`);
      return;
    }
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
    await vscode.window.showTextDocument(doc, { preview: true, viewColumn: vscode.ViewColumn.One });
  }

  private refreshCatalog(): void {
    const folders = (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath);
    this.catalog = discoverSkills({ workspaceFolders: folders });
  }

  private defaultSkillRoot(): string | undefined {
    const active = vscode.window.activeTextEditor?.document.uri;
    if (active && path.basename(active.fsPath) === "SKILL.md") {
      return path.dirname(active.fsPath);
    }
    return undefined;
  }

  private post(message: HostToWebview): void {
    void this.panel.webview.postMessage(message);
  }

  private html(): string {
    const webview = this.panel.webview;
    const dist = vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview");
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(dist, "main.js"));
    const stylePath = vscode.Uri.joinPath(dist, "assets", "main.css");
    const styleTag = fs.existsSync(stylePath.fsPath)
      ? `<link rel="stylesheet" href="${webview.asWebviewUri(stylePath)}">`
      : "";
    const nonce = randomNonce();
    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy"
      content="default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    ${styleTag}
    <title>Graphtale</title>
  </head>
  <body>
    <div id="root"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
  }
}

function emptyGraph(): SkillGraph {
  return {
    skillId: "",
    skillName: "No skill",
    rootPath: "",
    nodes: [],
    edges: [],
  };
}

function safeRead(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function randomNonce(): string {
  return randomBytes(16).toString("hex");
}
