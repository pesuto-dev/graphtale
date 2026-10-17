import type { SkillEdge, SkillNode } from "@shared/protocol";

export function filterForCompact(
  nodes: SkillNode[],
  edges: SkillEdge[],
): { nodes: SkillNode[]; edges: SkillEdge[] } {
  const stepPredKeys = new Set(
    nodes
      .filter((node) => node.id.startsWith("step:"))
      .map((node) => predecessors(node.id, edges).join("|"))
      .filter(Boolean),
  );
  const kept = nodes.filter((node) => {
    if (!node.id.startsWith("support:")) {
      return true;
    }
    return stepPredKeys.has(predecessors(node.id, edges).join("|"));
  });
  const ids = new Set(kept.map((node) => node.id));
  const trimmed = edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to));
  return {
    nodes: kept,
    edges: routeSkipThroughSupport(kept, trimmed),
  };
}

export function compactDisplayLabel(node: SkillNode): string {
  let label = node.label.replace(/\.(py|md|json)$/i, "");
  if (label.length > 22) {
    label = `${label.slice(0, 21)}…`;
  }
  return label;
}

export function predecessors(id: string, edges: SkillEdge[]): string[] {
  return edges
    .filter((edge) => edge.to === id)
    .map((edge) => edge.from)
    .sort();
}

/**
 * LR draws A→C through the support column (schema → N6). Compact would otherwise
 * draw that skip from the stacked agent (two arrows out of N5v). Reroute A→C
 * to leave via the schema-like support sibling instead.
 */
function routeSkipThroughSupport(nodes: SkillNode[], edges: SkillEdge[]): SkillEdge[] {
  return edges.map((edge) => {
    if (!edge.from.startsWith("step:") || !edge.to.startsWith("step:")) {
      return edge;
    }
    const supportSiblings = nodes.filter(
      (node) =>
        node.id.startsWith("support:") && predecessors(node.id, edges).includes(edge.from),
    );
    if (supportSiblings.length === 0) {
      return edge;
    }
    const siblingStepReachesTarget = nodes.some(
      (node) =>
        node.id.startsWith("step:") &&
        node.id !== edge.to &&
        predecessors(node.id, edges).includes(edge.from) &&
        edges.some((other) => other.from === node.id && other.to === edge.to),
    );
    if (!siblingStepReachesTarget) {
      return edge;
    }
    const through =
      supportSiblings.find((node) => /schema|\.json$/i.test(node.id)) ??
      supportSiblings.find((node) =>
        edges.some((other) => other.to === node.id && other.label === "shape"),
      ) ??
      supportSiblings[0];
    if (edges.some((other) => other.from === through.id && other.to === edge.to)) {
      return edge;
    }
    return { ...edge, from: through.id };
  });
}
