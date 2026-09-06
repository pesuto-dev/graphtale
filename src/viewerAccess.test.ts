import { expect, it } from "vitest";
import { resolveOpenTarget } from "./viewerAccess";
import { isHostToWebview, isWebviewToHost, type SkillGraph } from "./shared/protocol";
const graph: SkillGraph = { skillId: "sample", skillName: "Sample", rootPath: "/skills/sample", nodes: [
  { id: "step:1", label: "Read", kind: "reference", path: "/skills/sample/SKILL.md", source: { path: "/skills/sample/SKILL.md", startLine: 7, endLine: 9 }, resourcePath: "/shared/data.md", summary: "", uses: [] },
], edges: [] };
it("rejects malformed fields, enums, arbitrary paths and oversized clipboard payloads", () => {
  for (const value of [{ type: "openFile", path: "/etc/passwd" }, { type: "openFile", nodeId: "x", target: "shell" }, { type: "selectNode", nodeId: 4 }, { type: "setDirection", direction: "TB;run" }, { type: "openSkill", rootPath: null }, { type: "copyText", text: "x".repeat(65537) }]) expect(isWebviewToHost(value)).toBe(false);
  expect(isWebviewToHost({ type: "openFile", nodeId: "step:1", target: "resource" })).toBe(true);
});
it("resolves exact source lines and legitimate external resources only from known nodes", () => {
  expect(resolveOpenTarget([graph], { type: "openFile", nodeId: "step:1" })).toEqual(graph.nodes[0].source);
  expect(resolveOpenTarget([graph], { type: "openFile", nodeId: "step:1", target: "resource" })?.path).toBe("/shared/data.md");
  expect(resolveOpenTarget([graph], { type: "openFile", nodeId: "unknown" })).toBeUndefined();
});
it("validates graph internals and every host message variant", () => {
  const message = { type: "graph", graph, procedure: graph, diagnosis: { confidence: "partial", message: "", fixPrompt: "" }, catalog: [], direction: "TB" };
  expect(isHostToWebview(message)).toBe(true);
  expect(isHostToWebview({ ...message, graph: { ...graph, edges: [{ from: "step:1", to: "unknown" }] } })).toBe(false);
  expect(isHostToWebview({ ...message, graph: { ...graph, nodes: [{ ...graph.nodes[0], source: { path: "a", startLine: -1, endLine: 2 } }] } })).toBe(false);
  expect(isHostToWebview({ ...message, diagnosis: { ...message.diagnosis, confidence: "certain" } })).toBe(false);
  for (const value of [{ type: "fileContent", payload: { nodeId: "x", path: "x", text: {} } }, { type: "stale", stale: "true" }, { type: "copyResult", ok: 1 }, { type: "direction", direction: "up" }, { type: "error", message: "oops", retryable: "yes" }]) expect(isHostToWebview(value)).toBe(false);
});
