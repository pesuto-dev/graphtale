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

/**
 * Compact Flow: real DAG, LR within each wrap row, parallel stacks.
 */
export function toCompactFlow(
  inputNodes: SkillNode[],
  inputEdges: SkillEdge[],
  colsPerRow = COMPACT_COLS,
): { nodes: SkillFlowNode[]; edges: ReturnType<typeof styleCompactEdge>[] } {
  const { nodes, edges } = filterForCompact(inputNodes, inputEdges);
  if (nodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  const levels = compactLevels(nodes, edges);
  const columns = columnsFromLevels(levels, edges);
  const rows = packCompactRows(columns, colsPerRow, edges);
  const { places, rowBottoms } = placeNodes(rows);

  const wrapLaneByRow = new Map<number, number>();
  const wrapMetaFor = (from: Place, to: Place): CompactWrapData | undefined => {
    if (!isLongWrap(from, to)) {
      return undefined;
    }
    const lane = wrapLaneByRow.get(from.row) ?? 0;
    wrapLaneByRow.set(from.row, lane + 1);
    return {
      wrapY: rowBottoms[from.row] + COMPACT_WRAP_LANE + lane * 14,
      gutterX: Math.max(8, to.x - COMPACT_WRAP_INSET),
      enter: to.col === 0 ? "left" : "top",
    };
  };

  const flowNodes: SkillFlowNode[] = nodes.map((node) => {
    const placed = places.get(node.id) ?? { x: 0, y: 0, row: 0, col: 0, stacked: false };
    const { sourcePosition, targetPosition } = handlePositions(node.id, placed, edges, places);
    const accessibleName = compactAccessibleName(node.kind, node.label);
    return {
      id: node.id,
      type: "skill",
      position: { x: placed.x, y: placed.y },
      ariaLabel: accessibleName,
      data: {
        ...node,
        label: compactDisplayLabel(node),
        direction: "LR",
        expanded: false,
        compact: true,
        accessibleName,
      },
      sourcePosition,
      targetPosition,
      draggable: false,
      className: "rf-compact",
      style: { width: COMPACT_NODE_W, height: COMPACT_NODE_H, overflow: "visible" },
    };
  });

  return {
    nodes: flowNodes,
    edges: edges.map((edge) => {
      const from = places.get(edge.from);
      const to = places.get(edge.to);
      const wrapMeta = from && to ? wrapMetaFor(from, to) : undefined;
      return styleCompactEdge(edge, from, to, wrapMeta);
    }),
  };
}
