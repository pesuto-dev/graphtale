import type { SkillNode } from "@shared/protocol";

export function filterCatalogNodes(nodes: SkillNode[], query: string): SkillNode[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return nodes;
  }
  return nodes.filter((node) => nodeMatchesQuery(node, q));
}

export function catalogMatchStatus(query: string, matchCount: number, total: number): string {
  const trimmed = query.trim();
  if (!trimmed) {
    return "";
  }
  if (matchCount === 0) {
    return `No files match "${trimmed}".`;
  }
  return `${matchCount} of ${total} files`;
}

export function catalogQueryClears(key: string, query: string): boolean {
  return key === "Escape" && query.length > 0;
}

function nodeMatchesQuery(node: SkillNode, query: string): boolean {
  return [node.label, node.path, node.summary].some((field) => field.toLowerCase().includes(query));
}
