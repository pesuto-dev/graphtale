import { MarkerType, Position, type Edge, type SmoothStepPathOptions } from "@xyflow/react";
import type { SkillEdge, SkillNode } from "@shared/protocol";
import type { CompactWrapData } from "./CompactWrapEdge";
import { dagreLrRanks } from "./layout";
import type { SkillFlowNode } from "./SkillNodeView";

/**
 * Compact = same Flow DAG as LR, packed into wrap-rows.
 *
 * Ranks come from the same dagre LR run as the normal view.
 * Entry (SKILL → procedure source) sits on its own strip.
 * Runtime then wraps every ~4 columns so row 1 matches the first LR
 * runtime segment (e.g. P → N1 → N2∥ → N3).
 */
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

type Column = { nodes: SkillNode[] };

type CompactEdge = Edge<Record<string, unknown> | CompactWrapData, "smoothstep" | "compactWrap"> & {
  pathOptions?: SmoothStepPathOptions;
};

type Place = {
  x: number;
  y: number;
  row: number;
  col: number;
  stacked: boolean;
};

/** Keep in-flow support siblings (N5 → N5v ∥ schema ∥ template). Drop dangling satellites. */
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

function predecessors(id: string, edges: SkillEdge[]): string[] {
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

/** Same LR ranks as `toFlow(..., "LR")`. */
export function compactLevels(nodes: SkillNode[], edges: SkillEdge[]): SkillNode[][] {
  return dagreLrRanks(nodes, edges);
}

/** Same predecessor set → one stacked column (e.g. N2a/b/c). Preserves rank order. */
export function columnsFromLevels(levels: SkillNode[][], edges: SkillEdge[]): Column[] {
  const columns: Column[] = [];
  for (const rank of levels) {
    const groups = new Map<string, SkillNode[]>();
    const order: string[] = [];
    for (const node of rank) {
      const key = predecessors(node.id, edges).join("|") || `solo:${node.id}`;
      const list = groups.get(key);
      if (!list) {
        order.push(key);
        groups.set(key, [node]);
      } else {
        list.push(node);
      }
    }
    for (const key of order) {
      columns.push({ nodes: groups.get(key) ?? [] });
    }
  }
  return columns;
}

function isEntryColumn(column: Column): boolean {
  return column.nodes.every(
    (node) => node.isEntry || node.id === "skill-md" || node.id === "procedure-source",
  );
}

function columnFeedsStack(source: Column, next: Column | undefined, edges: SkillEdge[]): boolean {
  if (!next || next.nodes.length < 2) {
    return false;
  }
  const ids = new Set(source.nodes.map((node) => node.id));
  return next.nodes.every((node) => predecessors(node.id, edges).some((pred) => ids.has(pred)));
}

/** Stack members that both reach the next column (schema + N5v → N6) stay with that join. */
function stackFeedsJoin(stack: Column | undefined, join: Column | undefined, edges: SkillEdge[]): boolean {
  if (!stack || stack.nodes.length < 2 || !join || join.nodes.length !== 1) {
    return false;
  }
  const stackIds = new Set(stack.nodes.map((node) => node.id));
  const hits = predecessors(join.nodes[0].id, edges).filter((pred) => stackIds.has(pred));
  return hits.length >= 2;
}

function clusterSlots(
  col: Column,
  next: Column | undefined,
  after: Column | undefined,
  edges: SkillEdge[],
): number {
  if (!columnFeedsStack(col, next, edges)) {
    return 1;
  }
  return stackFeedsJoin(next, after, edges) ? 3 : 2;
}

/**
 * Entry strip first (SKILL → procedure), then runtime in rows of `colsPerRow`.
 * A fan-out stack stays on the same row as its source, and with its join
 * target when several stacked nodes feed that node (N5 → stack → N6).
 */
export function packCompactRows(
  columns: Column[],
  colsPerRow: number,
  edges: SkillEdge[] = [],
): Column[][] {
  let split = 0;
  while (split < columns.length && isEntryColumn(columns[split])) {
    split += 1;
  }

  const rows: Column[][] = [];
  if (split > 0) {
    rows.push(columns.slice(0, split));
  }

  const runtime = columns.slice(split);
  const row: Column[] = [];
  for (let i = 0; i < runtime.length; i += 1) {
    const col = runtime[i];
    const next = runtime[i + 1];
    const after = runtime[i + 2];
    const slots = clusterSlots(col, next, after, edges);
    if (row.length > 0 && row.length + slots > colsPerRow) {
      rows.push(row.splice(0, row.length));
    }
    row.push(col);
  }
  if (row.length > 0) {
    rows.push(row);
  }
  return rows;
}

export function chunkColumns(columns: Column[], colsPerRow: number, edges: SkillEdge[] = []): Column[][] {
  return packCompactRows(columns, colsPerRow, edges);
}

function isLongWrap(from: Place, to: Place): boolean {
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

function styleCompactEdge(
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

function handlePositions(
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

function placeNodes(rows: Column[][]): { places: Map<string, Place>; rowBottoms: number[] } {
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
    return {
      id: node.id,
      type: "skill",
      position: { x: placed.x, y: placed.y },
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
