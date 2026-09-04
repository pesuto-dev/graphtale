import dagre from "@dagrejs/dagre";
import { MarkerType, Position, type Edge } from "@xyflow/react";
import type { LayoutDirection, SkillEdge, SkillNode } from "@shared/protocol";
import type { SkillFlowNode } from "./SkillNodeView";

export const NODE_W = 188;
export const NODE_H = 68;

/** Same dagre graph settings for Flow LR and Compact ranks. */
export const DAGRE_LAYOUT = {
  nodesep: 36,
  ranksep: 96,
  marginx: 28,
  marginy: 28,
} as const;

const SAME_RANK_X_EPS = 8;

export function layoutDagre(
  nodes: SkillNode[],
  edges: SkillEdge[],
  direction: LayoutDirection,
): dagre.graphlib.Graph {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: direction,
    ...DAGRE_LAYOUT,
  });

  for (const node of nodes) {
    graph.setNode(node.id, { width: NODE_W, height: NODE_H });
  }
  for (const edge of edges) {
    graph.setEdge(edge.from, edge.to);
  }
  dagre.layout(graph);
  return graph;
}

/**
 * LR rank columns in the same order dagre uses for Flow left-to-right.
 * Siblings in a rank are top-to-bottom (increasing y).
 */
export function dagreLrRanks(nodes: SkillNode[], edges: SkillEdge[]): SkillNode[][] {
  if (nodes.length === 0) {
    return [];
  }
  const graph = layoutDagre(nodes, edges, "LR");
  const items = nodes.map((node) => {
    const placed = graph.node(node.id);
    return {
      node,
      x: placed?.x ?? 0,
      y: placed?.y ?? 0,
    };
  });
  items.sort(
    (a, b) => a.x - b.x || a.y - b.y || a.node.id.localeCompare(b.node.id),
  );

  const ranks: SkillNode[][] = [];
  for (const item of items) {
    const last = ranks[ranks.length - 1];
    const lastX = last ? (graph.node(last[0].id)?.x ?? 0) : undefined;
    if (last && lastX !== undefined && Math.abs(item.x - lastX) <= SAME_RANK_X_EPS) {
      last.push(item.node);
    } else {
      ranks.push([item.node]);
    }
  }
  return ranks;
}

export function toFlow(
  nodes: SkillNode[],
  edges: SkillEdge[],
  direction: LayoutDirection,
  expandedIds: string[],
): { nodes: SkillFlowNode[]; edges: Edge[] } {
  const graph = layoutDagre(nodes, edges, direction);

  const flowNodes: SkillFlowNode[] = nodes.map((node) => {
    const placed = graph.node(node.id);
    return {
      id: node.id,
      type: "skill",
      position: {
        x: (placed?.x ?? 0) - NODE_W / 2,
        y: (placed?.y ?? 0) - NODE_H / 2,
      },
      data: { ...node, direction, expanded: expandedIds.includes(node.id) },
      sourcePosition: direction === "LR" ? Position.Right : Position.Bottom,
      targetPosition: direction === "LR" ? Position.Left : Position.Top,
      draggable: false,
      className: expandedIds.includes(node.id) ? "rf-expanded" : undefined,
      style: { width: NODE_W, overflow: "visible" },
    };
  });

  const flowEdges: Edge[] = edges.map((edge) => {
    const pending = edge.label === "pending";
    const low = edge.confidence === "low" || edge.inferred || pending;
    const color = pending ? "var(--accent)" : edge.inferred || edge.confidence === "low" ? "var(--muted)" : "var(--edge)";
    return {
      id: `${edge.from}-${edge.to}`,
      source: edge.from,
      target: edge.to,
      label: edge.label,
      className: pending ? "edge-pending" : low ? "edge-inferred" : "edge-explicit",
      animated: pending,
      style: {
        stroke: color,
        strokeWidth: pending ? 2 : 1.6,
        strokeDasharray: low ? "5 4" : undefined,
      },
      labelStyle: {
        fill: "var(--muted)",
        fontSize: 10,
      },
      labelBgStyle: {
        fill: "var(--bg)",
        fillOpacity: 0.88,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 14,
        height: 14,
        color,
      },
    };
  });

  return { nodes: flowNodes, edges: flowEdges };
}
