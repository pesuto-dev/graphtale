import type { CatalogSkill, SkillGraph, SkillNode } from "./protocol";

export function normalizePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/\/+$/, "");
}

export function findCatalogNode(
  graph: SkillGraph,
  skill: CatalogSkill,
): SkillNode | undefined {
  const skillFile = `${normalizePath(skill.rootPath)}/SKILL.md`;
  return graph.nodes.find((node) => {
    if (node.kind !== "skill") {
      return false;
    }
    const path = normalizePath(node.path);
    return (
      path === skillFile ||
      node.id === `skill:${skill.name}` ||
      node.label === skill.name
    );
  });
}

export function pendingNodeFromCatalog(skill: CatalogSkill): SkillNode {
  return {
    id: `pending:${skill.id}`,
    label: skill.name,
    kind: "skill",
    path: `${normalizePath(skill.rootPath)}/SKILL.md`,
    summary: "Pending link from the open entry. This viewer does not write to disk.",
    uses: [],
    inferred: true,
    pending: true,
  };
}

export function graphWithPending(
  graph: SkillGraph,
  pending: CatalogSkill | undefined,
): SkillGraph {
  if (!pending || findCatalogNode(graph, pending)) {
    return graph;
  }
  const entry = graph.nodes.find((node) => node.isEntry);
  const node = pendingNodeFromCatalog(pending);
  return {
    ...graph,
    nodes: [...graph.nodes, node],
    edges: [
      ...graph.edges,
      {
        from: entry?.id ?? "skill-md",
        to: node.id,
        inferred: true,
        label: "pending",
      },
    ],
  };
}
