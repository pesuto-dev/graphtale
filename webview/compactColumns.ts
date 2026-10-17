import type { SkillEdge, SkillNode } from "@shared/protocol";
import { dagreLrRanks } from "./layout";
import { predecessors } from "./compactFilter";

export type Column = { nodes: SkillNode[] };

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
