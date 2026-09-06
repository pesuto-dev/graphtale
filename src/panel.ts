import { randomBytes } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import { readTextFile, PREVIEW_READ_LIMIT_BYTES } from "./fileAccess";
import { resolveOpenTarget } from "./viewerAccess";
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
  private discoveryWarnings: string[] = [];
  private graph: SkillGraph | undefined;
  private procedure: SkillGraph | undefined;
  private diagnosis: ProcedureDiagnosis = emptyDiagnosis();
  private direction: LayoutDirection;
  private watchedFiles: string[] = [];
  private watchers: vscode.Disposable[] = [];
  private attemptedRoot: string | undefined;
  private lastError: { message: string; retryable: boolean } | undefined;
  private stale = false;
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
      try { this.onMessage(raw); } catch { this.reportError("The action could not be completed. Retry after checking the skill files.", true); }
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
    const root = this.attemptedRoot ?? this.graph?.rootPath;
    if (root) {
      this.openSkill(root);
    }
  }

  public openSkill(skillRoot: string): void {
    this.attemptedRoot = skillRoot;
    try {
      this.refreshCatalog();
      const graph = parseSkill({ skillRoot, catalog: this.catalog });
      const parsed = parseProcedure({ skillRoot, catalog: this.catalog });
      graph.warnings = [...(graph.warnings ?? []), ...this.discoveryWarnings];
      this.graph = graph;
      this.procedure = parsed.graph;
      this.diagnosis = parsed.diagnosis;
      this.lastError = undefined;
      this.stale = false;
      this.panel.title = `Graphtale - ${graph.skillName}`;
      this.watchSkill(skillRoot);
      this.sendGraph();
      this.post({ type: "stale", stale: false });
    } catch {
      this.reportError(`Could not load ${path.join(skillRoot, "SKILL.md")}. Check that it is readable text within the 256 KiB input limit, then retry. The previous view is preserved.`, true);
    }
  }

  private sendGraph(): void {
    this.post({ type: "graph", graph: this.graph ?? emptyGraph(), procedure: this.procedure ?? emptyGraph(),
      pipeline: this.procedure ?? emptyGraph(), diagnosis: this.diagnosis, catalog: this.catalog, direction: this.direction });
  }

  private reportError(message: string, retryable: boolean): void {
    this.lastError = { message, retryable };
    this.stale = true;
    this.post({ type: "stale", stale: true });
    this.post({ type: "error", message, retryable });
  }

  private watchSkill(skillRoot: string): void {
    this.disposeWatch();
    this.watchedFiles = extraWatchFiles([
      ...(this.graph?.nodes ?? []).map((node) => node.path),
      ...(this.procedure?.nodes ?? []).flatMap((node) => [node.path, ...(node.resourcePath ? [node.resourcePath] : [])]),
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
      this.stale = true;
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
        this.sendGraph();
        this.post({ type: "stale", stale: this.stale });
        if (this.lastError) this.post({ type: "error", ...this.lastError });
        return;
      case "selectNode":
        this.sendFile(message.nodeId);
        return;
      case "openFile":
        void this.openInEditor(message);
        return;
      case "setDirection":
        this.direction = message.direction;
        void Promise.resolve(this.context.workspaceState.update(DIRECTION_KEY, this.direction)).catch(() => this.reportError("Could not save the layout preference.", false));
        this.post({ type: "direction", direction: this.direction });
        return;
      case "openSkill":
        if (this.catalog.some(skill => path.resolve(skill.rootPath) === path.resolve(message.rootPath))) this.openSkill(message.rootPath);
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
    const preview = readTextFile(node.path, PREVIEW_READ_LIMIT_BYTES);
    const text = preview.warning && !preview.truncated ? preview.text : node.excerpt ?? preview.text;
    const payload: FileContentPayload = {
      nodeId: node.id,
      path: node.path,
      text,
      notice: preview.warning,
    };
    if (node.isBlock && this.graph && !node.excerpt) {
      const skillFile = path.join(this.graph.rootPath, "SKILL.md");
      const skillText = readTextFile(skillFile, PREVIEW_READ_LIMIT_BYTES).text;
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

  private async openInEditor(request: Extract<WebviewToHost, { type: "openFile" }>): Promise<void> {
    const target = resolveOpenTarget([this.procedure, this.graph], request);
    if (!target) return;
    try {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(target.path));
      const start = Math.min(target.startLine - 1, Math.max(0, doc.lineCount - 1));
      const end = Math.min(target.endLine - 1, Math.max(0, doc.lineCount - 1));
      await vscode.window.showTextDocument(doc, { preview: true, viewColumn: vscode.ViewColumn.One,
        selection: new vscode.Range(start, 0, end, 0) });
    } catch {
      this.reportError(`Could not open ${target.path}. The file may have moved or become unreadable.`, true);
    }
  }

  private refreshCatalog(): void {
    const folders = (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath);
    this.discoveryWarnings = [];
    this.catalog = discoverSkills({ workspaceFolders: folders, onWarning: warning => this.discoveryWarnings.push(warning) });
  }

  private defaultSkillRoot(): string | undefined {
    const active = vscode.window.activeTextEditor?.document.uri;
    if (active && path.basename(active.fsPath) === "SKILL.md") {
      return path.dirname(active.fsPath);
    }
    return undefined;
  }

  private post(message: HostToWebview): void {
    void Promise.resolve(this.panel.webview.postMessage(message)).catch(() => { /* Panel was disposed. */ });
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

function randomNonce(): string {
  return randomBytes(16).toString("hex");
}
