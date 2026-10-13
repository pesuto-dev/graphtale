import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import type { ExtensionContext } from "vscode";
import { isHostToWebview } from "./shared/protocol";

type StepNode = { id: string; source?: { startLine: number } };
type HostMessage = {
  type?: string;
  graph?: unknown;
  procedure?: { nodes: StepNode[] };
  payload?: { notice?: string; text?: string };
};
type FileUri = { fsPath: string; toString: () => string };

const host = vi.hoisted(() => ({
  messages: [] as HostMessage[],
  receive: (_message: unknown) => {},
  root: "",
  open: vi.fn(),
  show: vi.fn(),
  clipboard: vi.fn(),
}));
vi.mock("./discover", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./discover")>()),
  discoverSkills: () => [{ id: "test", name: "test", description: "", rootPath: host.root }],
}));
vi.mock("vscode", () => {
  const uri = (fsPath: string): FileUri => ({ fsPath, toString: () => fsPath });
  const disposable = () => ({ dispose() {} });
  return {
    ViewColumn: { Beside: 2, One: 1 },
    Uri: { file: uri, joinPath: (base: FileUri, ...parts: string[]) => uri(path.join(base.fsPath, ...parts)) },
    Range: class { constructor(public startLine: number, public startCharacter: number, public endLine: number, public endCharacter: number) {} },
    RelativePattern: class {},
    env: { clipboard: { writeText: host.clipboard } },
    workspace: { workspaceFolders: [], createFileSystemWatcher: () => ({ ...disposable(), onDidChange: disposable, onDidCreate: disposable, onDidDelete: disposable }), onDidSaveTextDocument: disposable, openTextDocument: host.open },
    window: { showTextDocument: host.show, createWebviewPanel: () => ({ title: "", reveal() {}, onDidDispose: disposable,
      webview: { html: "", cspSource: "test", asWebviewUri: (value: FileUri) => value, postMessage: (message: HostMessage) => { host.messages.push(message); return Promise.resolve(true); }, onDidReceiveMessage: (fn: (message: unknown) => void) => { host.receive = fn; } },
    }) },
  };
});
import { GraphtalePanel } from "./panel";
import { PREVIEW_READ_LIMIT_BYTES } from "./fileAccess";
afterEach(() => { GraphtalePanel.current = undefined; if (host.root) fs.rmSync(host.root, { recursive: true, force: true }); host.messages.length = 0; vi.clearAllMocks(); });
it("preserves the last good graph on deletion, retries, and opens exact instruction lines", async () => {
  host.root = fs.mkdtempSync(path.join(os.tmpdir(), "host-boundary-"));
  const skillFile = path.join(host.root, "SKILL.md"), content = "## Instructions\n1. Read\n2. Finish\n";
  fs.writeFileSync(skillFile, content);
  host.open.mockResolvedValue({ lineCount: 4 }); host.show.mockResolvedValue(undefined); host.clipboard.mockResolvedValue(undefined);
  GraphtalePanel.createOrShow({ extensionUri: { fsPath: host.root }, workspaceState: { get: () => "TB", update: () => Promise.resolve() } } as unknown as ExtensionContext, host.root);
  const good = host.messages.find(m => m.type === "graph");
  expect(good?.procedure?.nodes.some((n) => n.id === "step:1")).toBe(true);
  host.receive({ type: "openFile", nodeId: "step:1" }); await new Promise(resolve => setImmediate(resolve));
  expect(host.show.mock.calls[0][1].selection.startLine).toBe(1);
  host.receive({ type: "openFile", path: "/unknown" }); host.receive({ type: "openFile", nodeId: "unknown" });
  expect(host.open).toHaveBeenCalledTimes(1);
  host.receive({ type: "openSkill", rootPath: "/unknown" });
  expect(host.messages.filter(m => m.type === "graph")).toHaveLength(1);
  fs.unlinkSync(skillFile); host.receive({ type: "refresh" }); host.receive({ type: "ready" });
  expect(host.messages.at(-1)).toMatchObject({ type: "error", retryable: true });
  expect(host.messages.filter(m => m.type === "graph").at(-1).graph).toEqual(good.graph);
  host.receive({ type: "selectNode", nodeId: "step:1" });
  expect(host.messages.at(-1).payload.notice).toMatch(/read/);
  expect(host.messages.at(-1).payload.text).toBe("");
  fs.writeFileSync(skillFile, content); host.receive({ type: "refresh" });
  expect(host.messages.at(-1)).toEqual({ type: "stale", stale: false });
  host.receive({ type: "copyText", text: "test" }); await new Promise(resolve => setImmediate(resolve));
  expect(host.messages.at(-1)).toEqual({ type: "copyResult", ok: true });
  host.clipboard.mockRejectedValueOnce(new Error("unavailable")); host.receive({ type: "copyText", text: "test" }); await new Promise(resolve => setImmediate(resolve));
  expect(host.messages.at(-1)).toEqual({ type: "copyResult", ok: false });
  host.open.mockRejectedValueOnce(new Error("unavailable")); host.receive({ type: "openFile", nodeId: "step:1" }); await new Promise(resolve => setImmediate(resolve));
  expect(host.messages.at(-1).type).toBe("error");
  expect(host.messages.every(isHostToWebview)).toBe(true);
});
it("shows the selected instruction beyond the file preview limit", () => {
  host.root = fs.mkdtempSync(path.join(os.tmpdir(), "host-preview-"));
  const prefix = "Introduction\n" + "x".repeat(PREVIEW_READ_LIMIT_BYTES) + "\n";
  fs.writeFileSync(path.join(host.root, "SKILL.md"), prefix + "## 1. Prepare\nSpecific instruction\n## 2. Finish\n");
  GraphtalePanel.createOrShow({ extensionUri: { fsPath: host.root }, workspaceState: { get: () => "TB", update: () => Promise.resolve() } } as unknown as ExtensionContext, host.root);
  const graph = host.messages.find(m => m.type === "graph");
  expect(graph?.procedure?.nodes.find((n) => n.id === "step:1")?.source?.startLine).toBe(3);
  host.receive({ type: "selectNode", nodeId: "step:1" });
  expect(host.messages.at(-1).payload).toMatchObject({
    text: "## 1. Prepare\nSpecific instruction",
    notice: expect.stringMatching(/truncated/),
  });
  host.receive({ type: "selectNode", nodeId: "skill-md" });
  expect(host.messages.at(-1).payload.text).toBe(prefix.slice(0, PREVIEW_READ_LIMIT_BYTES));
});
