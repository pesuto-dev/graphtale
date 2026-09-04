import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import { discoverSkills, skillLocationLabel } from "./discover";
import { GraphtalePanel } from "./panel";
import type { CatalogSkill } from "./shared/protocol";

const SKILL_FILE = "SKILL.md";

export function activate(context: vscode.ExtensionContext): void {
  const tree = new SkillTreeProvider();
  const watcher = vscode.workspace.createFileSystemWatcher(`**/${SKILL_FILE}`);
  watcher.onDidCreate(() => tree.refresh());
  watcher.onDidDelete(() => tree.refresh());
  watcher.onDidChange(() => tree.refresh());
  context.subscriptions.push(
    tree,
    watcher,
    vscode.window.registerTreeDataProvider("graphtale.skills", tree),
    vscode.commands.registerCommand("graphtale.openViewer", async (uri?: vscode.Uri) => {
      const root = await resolveSkillRoot(uri);
      if (!root) {
        return;
      }
      GraphtalePanel.createOrShow(context, root);
    }),
    vscode.commands.registerCommand("graphtale.openSkill", (rootPath: string) => {
      GraphtalePanel.createOrShow(context, rootPath);
    }),
    vscode.commands.registerCommand("graphtale.refresh", () => {
      GraphtalePanel.current?.refresh();
    }),
    vscode.commands.registerCommand("graphtale.refreshTree", () => {
      tree.refresh();
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => tree.refresh()),
  );
}

export function deactivate(): void {}

async function resolveSkillRoot(uri?: vscode.Uri): Promise<string | undefined> {
  if (uri) {
    const fromUri = skillRootFromUri(uri);
    if (fromUri) {
      return fromUri;
    }
    void vscode.window.showWarningMessage(
      "That folder has no SKILL.md. Open a SKILL.md, or pick a skill from the list.",
    );
    return undefined;
  }

  const active = vscode.window.activeTextEditor?.document.uri;
  if (active && path.basename(active.fsPath) === SKILL_FILE) {
    return path.dirname(active.fsPath);
  }

  const skills = currentCatalog();
  if (skills.length === 0) {
    void vscode.window.showInformationMessage(
      "No Agent Skills found. Open a SKILL.md, or add a skill under .cursor/skills, .claude/skills, .codex/skills, or .agents/skills.",
    );
    return undefined;
  }
  if (skills.length === 1) {
    return skills[0].rootPath;
  }

  const folders = workspaceFolderPaths();
  const picked = await vscode.window.showQuickPick(
    skills.map((skill) => ({
      label: skill.name,
      description: skillLocationLabel(skill.rootPath, {
        workspaceFolders: folders,
        homedir: os.homedir(),
      }),
      detail: skill.description,
      rootPath: skill.rootPath,
    })),
    {
      placeHolder: "Open which Agent Skill?",
      matchOnDescription: true,
      matchOnDetail: true,
    },
  );
  return picked?.rootPath;
}

function skillRootFromUri(uri: vscode.Uri): string | undefined {
  if (path.basename(uri.fsPath) === SKILL_FILE) {
    return path.dirname(uri.fsPath);
  }
  if (fs.existsSync(path.join(uri.fsPath, SKILL_FILE))) {
    return uri.fsPath;
  }
  return undefined;
}

function currentCatalog(): CatalogSkill[] {
  return discoverSkills({ workspaceFolders: workspaceFolderPaths() });
}

function workspaceFolderPaths(): string[] {
  return (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath);
}

class SkillTreeProvider implements vscode.TreeDataProvider<CatalogSkill>, vscode.Disposable {
  private readonly emitter = new vscode.EventEmitter<CatalogSkill | undefined>();
  readonly onDidChangeTreeData = this.emitter.event;

  refresh(): void {
    this.emitter.fire(undefined);
  }

  dispose(): void {
    this.emitter.dispose();
  }

  getTreeItem(element: CatalogSkill): vscode.TreeItem {
    const item = new vscode.TreeItem(element.name, vscode.TreeItemCollapsibleState.None);
    item.description = skillLocationLabel(element.rootPath, {
      workspaceFolders: workspaceFolderPaths(),
      homedir: os.homedir(),
    });
    item.tooltip = element.description
      ? `${element.description}\n${element.rootPath}`
      : element.rootPath;
    item.command = {
      command: "graphtale.openSkill",
      title: "Open skill",
      arguments: [element.rootPath],
    };
    return item;
  }

  getChildren(): CatalogSkill[] {
    return currentCatalog();
  }
}
