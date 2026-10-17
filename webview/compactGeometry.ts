import { MarkerType, Position, type Edge, type SmoothStepPathOptions } from "@xyflow/react";
import type { SkillEdge } from "@shared/protocol";
import type { CompactWrapData } from "./CompactWrapEdge";
import type { Column } from "./compactColumns";

export const COMPACT_NODE_W = 148;
export const COMPACT_NODE_H = 40;
export const COMPACT_STACK_GAP = 8;
export const COMPACT_COL_GAP = 56;
/** Room for wrap highway under a row plus skip arc above the next row. */
export const COMPACT_ROW_GAP = 120;
export const COMPACT_COLS = 4;
export const COMPACT_MARGIN = 36;
export const COMPACT_WRAP_LANE = 22;
export const COMPACT_WRAP_INSET = 20;

export type CompactEdge = Edge<Record<string, unknown> | CompactWrapData, "smoothstep" | "compactWrap"> & {
  pathOptions?: SmoothStepPathOptions;
};

export type Place = {
  x: number;
  y: number;
  row: number;
  col: number;
  stacked: boolean;
};

export function isLongWrap(from: Place, to: Place): boolean {
  return to.row > from.row && from.col - to.col > 1;
}

function wrapSourceHandle(from: Place): "out-right" | "out-bottom" {
  return from.stacked ? "out-right" : "out-bottom";
}

function edgeHandles(
  from: Place,
  to: Place,
): { sourceHandle: string; targetHandle: string } {
  if (isLongWrap(from, to)) {
    if (to.col === 0) {
      return { sourceHandle: wrapSourceHandle(from), targetHandle: "in-left" };
    }
    return { sourceHandle: wrapSourceHandle(from), targetHandle: "in-top" };
  }
  if (to.row > from.row) {
    return { sourceHandle: wrapSourceHandle(from), targetHandle: "in-left" };
  }
  if (to.row < from.row) {
    return { sourceHandle: "out-top", targetHandle: "in-bottom" };
  }
  // Same-row skip: arc above the chips so the wrap gutter below stays free.
  if (Math.abs(to.col - from.col) > 1) {
    return { sourceHandle: "out-top", targetHandle: "in-top" };
  }
  if (to.col >= from.col) {
    return { sourceHandle: "out-right", targetHandle: "in-left" };
  }
  return { sourceHandle: "out-left", targetHandle: "in-right" };
}

export function styleCompactEdge(
  edge: SkillEdge,
  from: Place | undefined,
  to: Place | undefined,
  wrapMeta?: CompactWrapData,
): CompactEdge {
  const pending = edge.label === "pending";
  const low = edge.confidence === "low" || edge.inferred || pending || edge.label === "parallel";
  const showLabel =
    edge.label === "Bug | Change" ||
    edge.label === "Question" ||
    edge.label === "handoff" ||
    edge.label === "conditional" ||
    edge.label === "shape" ||
    edge.label === "slots";
  const color = pending
    ? "var(--accent)"
    : low
      ? "color-mix(in srgb, var(--muted) 30%, var(--fg))"
      : "color-mix(in srgb, var(--edge) 45%, var(--fg))";

  const wrap = Boolean(from && to && to.row > from.row);
  const longWrap = Boolean(from && to && isLongWrap(from, to));
  const skip = Boolean(from && to && to.row === from.row && Math.abs(to.col - from.col) > 1);
  const handles =
    from && to
      ? edgeHandles(from, to)
      : { sourceHandle: "out-right", targetHandle: "in-left" };

  return {
    id: `${edge.from}-${edge.to}`,
    source: edge.from,
    target: edge.to,
    sourceHandle: handles.sourceHandle,
    targetHandle: handles.targetHandle,
    type: longWrap ? "compactWrap" : "smoothstep",
    data: longWrap && wrapMeta ? wrapMeta : undefined,
    label: showLabel ? edge.label : undefined,
    className: pending
      ? "edge-pending edge-compact"
      : low
        ? "edge-inferred edge-compact"
        : "edge-explicit edge-compact",
    animated: pending,
    pathOptions: {
      borderRadius: 16,
      offset: wrap ? 24 : skip ? 28 : 12,
    },
    style: {
      stroke: color,
      strokeWidth: low ? 2.2 : 2.6,
      strokeDasharray: low ? "6 5" : undefined,
    },
    labelStyle: { fill: "var(--fg)", fontSize: 10, fontWeight: 650 },
    labelBgStyle: { fill: "var(--bg)", fillOpacity: 0.92 },
    labelBgPadding: [4, 2] as [number, number],
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 16,
      height: 16,
      color,
    },
  };
}

export function handlePositions(
  id: string,
  place: Place,
  edges: SkillEdge[],
  places: Map<string, Place>,
): { sourcePosition: Position; targetPosition: Position } {
  const outs = edges.filter((edge) => edge.from === id);
  const ins = edges.filter((edge) => edge.to === id);

  let sourcePosition = Position.Right;
  let targetPosition = Position.Left;

  const outDown = outs.some((edge) => {
    const other = places.get(edge.to);
    return other && other.row > place.row;
  });
  const outRight = outs.some((edge) => {
    const other = places.get(edge.to);
    return other && other.row === place.row && other.col > place.col;
  });
  const inFromAbove = ins.some((edge) => {
    const other = places.get(edge.from);
    return other && other.row < place.row;
  });
  const inFromLeft = ins.some((edge) => {
    const other = places.get(edge.from);
    return other && other.row === place.row && other.col < place.col;
  });

  if (outDown && !outRight) {
    sourcePosition = Position.Bottom;
  }
  if (inFromAbove && !inFromLeft) {
    targetPosition = Position.Top;
  }

  return { sourcePosition, targetPosition };
}

export function placeNodes(rows: Column[][]): { places: Map<string, Place>; rowBottoms: number[] } {
  const places = new Map<string, Place>();
  const rowHeights: number[] = rows.map((row) =>
    Math.max(
      ...row.map(
        (column) =>
          column.nodes.length * COMPACT_NODE_H +
          Math.max(0, column.nodes.length - 1) * COMPACT_STACK_GAP,
      ),
      COMPACT_NODE_H,
    ),
  );

  const rowBottoms: number[] = [];
  let yCursor = COMPACT_MARGIN;
  rows.forEach((row, rowIndex) => {
    const rowH = rowHeights[rowIndex];
    row.forEach((column, colIndex) => {
      const stackH =
        column.nodes.length * COMPACT_NODE_H +
        Math.max(0, column.nodes.length - 1) * COMPACT_STACK_GAP;
      let y = yCursor + (rowH - stackH) / 2;
      const x = COMPACT_MARGIN + colIndex * (COMPACT_NODE_W + COMPACT_COL_GAP);
      for (const node of column.nodes) {
        places.set(node.id, {
          x,
          y,
          row: rowIndex,
          col: colIndex,
          stacked: column.nodes.length > 1,
        });
        y += COMPACT_NODE_H + COMPACT_STACK_GAP;
      }
    });
    rowBottoms[rowIndex] = yCursor + rowH;
    yCursor += rowH + COMPACT_ROW_GAP;
  });
  return { places, rowBottoms };
}

export function compactNodeBoxesOverlap(
  nodes: { id: string; position: { x: number; y: number } }[],
): boolean {
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i].position;
      const b = nodes[j].position;
      const overlap =
        a.x < b.x + COMPACT_NODE_W &&
        a.x + COMPACT_NODE_W > b.x &&
        a.y < b.y + COMPACT_NODE_H &&
        a.y + COMPACT_NODE_H > b.y;
      if (overlap) {
        return true;
      }
    }
  }
  return false;
}
