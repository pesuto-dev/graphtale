import type { SkillEdge, SkillNode } from "@shared/protocol";
import type { CompactWrapData } from "./CompactWrapEdge";
import { columnsFromLevels, compactLevels, packCompactRows } from "./compactColumns";
import { compactDisplayLabel, filterForCompact } from "./compactFilter";
import {
  COMPACT_COLS,
  COMPACT_NODE_H,
  COMPACT_NODE_W,
  COMPACT_WRAP_INSET,
  COMPACT_WRAP_LANE,
  handlePositions,
  isLongWrap,
  placeNodes,
  styleCompactEdge,
  type Place,
} from "./compactGeometry";
import { compactAccessibleName, type SkillFlowNode } from "./SkillNodeView";
import type { CompactEdge } from "./compactGeometry";

export {
  COMPACT_COL_GAP,
  COMPACT_COLS,
  COMPACT_MARGIN,
  COMPACT_NODE_H,
  COMPACT_NODE_W,
  COMPACT_ROW_GAP,
  COMPACT_STACK_GAP,
  COMPACT_WRAP_INSET,
  COMPACT_WRAP_LANE,
  compactNodeBoxesOverlap,
} from "./compactGeometry";
export { columnsFromLevels, compactLevels, chunkColumns, packCompactRows } from "./compactColumns";
export { compactDisplayLabel, filterForCompact } from "./compactFilter";

const UNPLACED: Place = { x: 0, y: 0, row: 0, col: 0, stacked: false };

function nextWrap(
  from: Place,
  to: Place,
  rowBottoms: number[],
  lanes: Map<number, number>,
): CompactWrapData | undefined {
  if (!isLongWrap(from, to)) {
    return undefined;
  }
  const lane = lanes.get(from.row) ?? 0;
  lanes.set(from.row, lane + 1);
  return {
    wrapY: rowBottoms[from.row] + COMPACT_WRAP_LANE + lane * 14,
    gutterX: Math.max(8, to.x - COMPACT_WRAP_INSET),
    enter: to.col === 0 ? "left" : "top",
  };
}

function toCompactNode(node: SkillNode, places: Map<string, Place>, edges: SkillEdge[]): SkillFlowNode {
  const placed = places.get(node.id) ?? UNPLACED;
  const { sourcePosition, targetPosition } = handlePositions(node.id, placed, edges, places);
  return {
    id: node.id,
    type: "skill",
    position: { x: placed.x, y: placed.y },
    ariaLabel: compactAccessibleName(node.kind, node.label),
    data: {
      ...node,
      label: compactDisplayLabel(node),
      direction: "LR",
      expanded: false,
      compact: true,
    },
    sourcePosition,
    targetPosition,
    draggable: false,
    className: "rf-compact",
    style: { width: COMPACT_NODE_W, height: COMPACT_NODE_H, overflow: "visible" },
  };
}

function styleEdges(
  edges: SkillEdge[],
  places: Map<string, Place>,
  rowBottoms: number[],
): CompactEdge[] {
  const lanes = new Map<number, number>();
  return edges.map((edge) => {
    const from = places.get(edge.from);
    const to = places.get(edge.to);
    const wrapMeta = from && to ? nextWrap(from, to, rowBottoms, lanes) : undefined;
    return styleCompactEdge(edge, from, to, wrapMeta);
  });
}

/**
 * Compact Flow: real DAG, LR within each wrap row, parallel stacks.
 */
export function toCompactFlow(
  inputNodes: SkillNode[],
  inputEdges: SkillEdge[],
  colsPerRow = COMPACT_COLS,
): { nodes: SkillFlowNode[]; edges: CompactEdge[] } {
  const { nodes, edges } = filterForCompact(inputNodes, inputEdges);
  if (nodes.length === 0) {
    return { nodes: [], edges: [] };
  }
  const rows = packCompactRows(columnsFromLevels(compactLevels(nodes, edges), edges), colsPerRow, edges);
  const { places, rowBottoms } = placeNodes(rows);
  return {
    nodes: nodes.map((node) => toCompactNode(node, places, edges)),
    edges: styleEdges(edges, places, rowBottoms),
  };
}
