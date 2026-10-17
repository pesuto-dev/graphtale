import type { GraphView, LayoutDirection, SkillGraph, SkillNode } from "@shared/protocol";

export type NodeClickIntent =
  | { type: "expand"; id: string }
  | { type: "follow"; id: string }
  | { type: "select"; id: string };

export function entryAfterSwitch(
  next: GraphView,
  graph: SkillGraph,
  procedure: SkillGraph,
): SkillNode | undefined {
  const active = next === "flow" ? procedure : graph;
  return active.nodes.find((node) => node.isEntry) ?? active.nodes[0];
}

/** Flow leaves the wide catalog direction so the procedure reads top to bottom. */
export function directionAfterSwitch(
  next: GraphView,
  direction: LayoutDirection,
  compact: boolean,
): LayoutDirection | null {
  if (next === "flow" && direction === "LR" && !compact) {
    return "TB";
  }
  return null;
}

export function nodeClickIntent(target: EventTarget | null, nodeId: string): NodeClickIntent {
  const element = target instanceof HTMLElement ? target : null;
  if (element?.closest("[data-expand]")) {
    return { type: "expand", id: nodeId };
  }
  const chip = element?.closest("[data-target-id]");
  const targetId = chip instanceof HTMLElement ? chip.dataset.targetId : undefined;
  if (targetId) {
    return { type: "follow", id: targetId };
  }
  return { type: "select", id: nodeId };
}
