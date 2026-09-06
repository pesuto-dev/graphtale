import * as path from "node:path";
import type { SkillGraph, SourceRange, WebviewToHost } from "./shared/protocol";

/** Resolve only host-owned node data. Resource references may legitimately be external. */
export function resolveOpenTarget(
  graphs: Array<SkillGraph | undefined>,
  request: Extract<WebviewToHost, { type: "openFile" }>,
): SourceRange | undefined {
  const node = graphs.flatMap(graph => graph?.nodes ?? []).find(item => item.id === request.nodeId);
  if (!node) return undefined;
  if (request.target === "resource") {
    return node.resourcePath ? { path: node.resourcePath, startLine: 1, endLine: 1 } : undefined;
  }
  if (request.target === "wrapper") {
    const graph = graphs.find(graph => graph?.nodes.includes(node));
    return graph?.rootPath ? { path: path.join(graph.rootPath, "SKILL.md"), startLine: 1, endLine: 1 } : undefined;
  }
  return node.source ?? { path: node.path, startLine: 1, endLine: 1 };
}
