import { describe, expect, it } from "vitest";
import { COMPACT_COLS } from "./compactGeometry";
import { columnsFromLevels, compactLevels, packCompactRows } from "./compactColumns";
import { filterForCompact } from "./compactFilter";
import { compactNodeBoxesOverlap } from "./compactGeometry";
import { toCompactFlow } from "./compactLayout";
import { dagreLrRanks, toFlow } from "./layout";
import {
  assertHealthyCompact,
  node,
  parseFixture,
  rankIds,
  rowIds,
  spineEdges,
  spineNodes,
} from "./compactTestHelpers";
import type { SkillEdge } from "@shared/protocol";

describe("compactColumns", () => {
  it("uses the same rank order as Flow LR (dagre)", () => {
    const { nodes, edges } = filterForCompact(spineNodes, spineEdges);
    expect(rankIds(compactLevels(nodes, edges))).toEqual(rankIds(dagreLrRanks(nodes, edges)));

    const lr = toFlow(nodes, edges, "LR", []);
    const compactIds = compactLevels(nodes, edges).flat().map((n) => n.id);
    const lrIds = [...lr.nodes]
      .sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y || a.id.localeCompare(b.id))
      .map((n) => n.id);
    expect(compactIds).toEqual(lrIds);
  });

  it("packs entry strip then LR runtime rows of four", () => {
    const { nodes, edges } = filterForCompact(spineNodes, spineEdges);
    const rows = packCompactRows(columnsFromLevels(compactLevels(nodes, edges), edges), COMPACT_COLS, edges);
    const packed = rowIds(rows);

    expect(packed[0]).toEqual([["skill-md"], ["procedure-source"]]);
    expect(packed[1]?.[0]).toEqual(["step:P"]);
    expect(packed[1]?.[1]).toEqual(["step:N1"]);
    expect(packed[1]?.[2]).toEqual(expect.arrayContaining(["step:N2a", "step:N2b", "step:N2c"]));
    expect(packed[1]?.[2]).toHaveLength(3);
    expect(packed[1]?.[3]).toEqual(["step:N3"]);
    expect(packed[1]).toHaveLength(4);
    expect(packed[2]?.[0]).toEqual(["gate:question"]);
  });

  it("keeps the same ranks as LR when a criteria feedback edge is present", () => {
    const edges: SkillEdge[] = [
      ...spineEdges,
      { from: "step:N5", to: "step:N3", label: "criteria", confidence: "low", inferred: true },
    ];
    const { nodes, edges: filtered } = filterForCompact(spineNodes, edges);
    expect(rankIds(compactLevels(nodes, filtered))).toEqual(rankIds(dagreLrRanks(nodes, filtered)));
  });
  it("does not wrap a short First Steps skill across extra runtime rows", () => {
    const result = parseFixture("../fixtures/public-skills/first-steps");
    const { nodes, edges } = filterForCompact(result.graph.nodes, result.graph.edges);
    const rows = packCompactRows(columnsFromLevels(compactLevels(nodes, edges), edges), COMPACT_COLS, edges);
    const runtime = rows.slice(1);
    expect(runtime).toHaveLength(1);
    expect(runtime[0].length).toBeLessThanOrEqual(COMPACT_COLS);
    expect(runtime[0].some((col) => col.nodes.some((n) => n.id.startsWith("step:")))).toBe(true);

    const flow = toCompactFlow(result.graph.nodes, result.graph.edges);
    expect(compactNodeBoxesOverlap(flow.nodes)).toBe(false);
  });

  it("keeps numbered Instructions on one runtime row", () => {
    const result = parseFixture("../fixtures/public-skills/instructions-plain");
    const { nodes, edges } = filterForCompact(result.graph.nodes, result.graph.edges);
    const rows = packCompactRows(columnsFromLevels(compactLevels(nodes, edges), edges), COMPACT_COLS, edges);
    expect(rows.slice(1)).toHaveLength(1);

    const flow = toCompactFlow(result.graph.nodes, result.graph.edges);
    expect(compactNodeBoxesOverlap(flow.nodes)).toBe(false);
  });

  it("wraps long-linear First Steps across several runtime rows", () => {
    const result = parseFixture("../fixtures/demo-skills/long-linear");
    expect(result.diagnosis.confidence).toBe("high");
    const { nodes, edges } = filterForCompact(result.graph.nodes, result.graph.edges);
    const rows = packCompactRows(columnsFromLevels(compactLevels(nodes, edges), edges), COMPACT_COLS, edges);
    const runtime = rows.slice(1);
    expect(runtime.length).toBeGreaterThanOrEqual(3);
    expect(runtime[0].length).toBe(COMPACT_COLS);
    expect(nodes.filter((n) => n.id.startsWith("step:")).length).toBe(12);

    const flow = toCompactFlow(result.graph.nodes, result.graph.edges);
    expect(compactNodeBoxesOverlap(flow.nodes)).toBe(false);
    expect(flow.edges.some((e) => e.type === "compactWrap")).toBe(true);
  });

  it("stacks five wide-fanout siblings and wraps after the first runtime row", () => {
    const result = parseFixture("../fixtures/demo-skills/wide-fanout");
    expect(result.diagnosis.confidence).toBe("high");
    const { nodes, edges } = filterForCompact(result.graph.nodes, result.graph.edges);
    const rows = packCompactRows(columnsFromLevels(compactLevels(nodes, edges), edges), COMPACT_COLS, edges);
    const stack = rows
      .flat()
      .find((col) => col.nodes.some((n) => n.id === "step:N2a"));
    expect(stack?.nodes.map((n) => n.id)).toEqual([
      "step:N2a",
      "step:N2b",
      "step:N2c",
      "step:N2d",
      "step:N2e",
    ]);
    expect(rows[1]?.map((c) => c.nodes[0]?.id)).toEqual(["step:P", "step:N1", "step:N2a", "step:N3"]);
    expect(rows[2]?.map((c) => c.nodes.map((n) => n.id))).toEqual([["step:N4"]]);

    const flow = toCompactFlow(result.graph.nodes, result.graph.edges);
    expect(flow.nodes.some((n) => n.id === "gate:question")).toBe(false);
    expect(compactNodeBoxesOverlap(flow.nodes)).toBe(false);
    const ids = new Set(flow.edges.map((e) => `${e.source}->${e.target}`));
    expect(ids.has("step:N1->step:N2a")).toBe(true);
    expect(ids.has("step:N2e->step:N3")).toBe(true);
  });
  it("wraps an odd-length First Steps chain onto a short last row", () => {
    const result = parseFixture("../fixtures/demo-skills/odd-wrap");
    const { nodes, edges } = filterForCompact(result.graph.nodes, result.graph.edges);
    const rows = packCompactRows(columnsFromLevels(compactLevels(nodes, edges), edges), COMPACT_COLS, edges);
    const runtime = rows.slice(1);
    expect(runtime.length).toBe(2);
    expect(runtime[0]).toHaveLength(COMPACT_COLS);
    expect(runtime[1]).toHaveLength(1);
  });

  it("treats an open fan-out stack as the last runtime column", () => {
    const result = parseFixture("../fixtures/demo-skills/fanout-open");
    const { nodes, edges } = filterForCompact(result.graph.nodes, result.graph.edges);
    const rows = packCompactRows(columnsFromLevels(compactLevels(nodes, edges), edges), COMPACT_COLS, edges);
    const runtime = rows.slice(1);
    const last = runtime[runtime.length - 1];
    const lastCol = last[last.length - 1];
    expect(lastCol.nodes.map((n) => n.id)).toEqual(["step:N2a", "step:N2b", "step:N2c"]);
  });

  it("packs a two-wide fan-out without a gate", () => {
    const result = parseFixture("../fixtures/demo-skills/pair-fanout");
    expect(result.graph.nodes.some((n) => n.id === "gate:question")).toBe(false);
    const { nodes, edges } = filterForCompact(result.graph.nodes, result.graph.edges);
    const rows = packCompactRows(columnsFromLevels(compactLevels(nodes, edges), edges), COMPACT_COLS, edges);
    const stack = rows.flat().find((col) => col.nodes.some((n) => n.id === "step:N2a"));
    expect(stack?.nodes.map((n) => n.id)).toEqual(["step:N2a", "step:N2b"]);
  });
  it("places a fan-out after a wrapped prefix", () => {
    const nodes = [
      node("skill-md", "skill", { isEntry: true }),
      node("p", "script"),
      node("n1", "script"),
      node("n2", "script"),
      node("n3", "script"),
      node("fork", "script"),
      node("a", "script"),
      node("b", "script"),
      node("c", "script"),
      node("join", "script"),
    ];
    const edges: SkillEdge[] = [
      { from: "skill-md", to: "p" },
      { from: "p", to: "n1" },
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3" },
      { from: "n3", to: "fork" },
      { from: "fork", to: "a" },
      { from: "fork", to: "b" },
      { from: "fork", to: "c" },
      { from: "a", to: "join" },
      { from: "b", to: "join" },
      { from: "c", to: "join" },
    ];
    const { nodes: kept, edges: filtered } = filterForCompact(nodes, edges);
    const rows = packCompactRows(columnsFromLevels(compactLevels(kept, filtered), filtered), COMPACT_COLS, filtered);
    const runtime = rows.slice(1);
    expect(runtime.length).toBeGreaterThanOrEqual(2);
    const stackRow = runtime.find((row) =>
      row.some((col) => col.nodes.some((n) => n.id === "a") && col.nodes.length === 3),
    );
    expect(stackRow).toBeDefined();
    expect(stackRow?.some((col) => col.nodes.some((n) => n.id === "fork"))).toBe(true);
    expect(stackRow?.some((col) => col.nodes.some((n) => n.id === "join"))).toBe(true);
    assertHealthyCompact(nodes, edges);
  });
});
