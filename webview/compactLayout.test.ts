import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  columnsFromLevels,
  compactLevels,
  compactNodeBoxesOverlap,
  COMPACT_COLS,
  filterForCompact,
  packCompactRows,
  toCompactFlow,
} from "./compactLayout";
import { dagreLrRanks, toFlow } from "./layout";
import type { SkillEdge, SkillNode } from "@shared/protocol";
import { groupInventory } from "./CatalogInventory";
import { parseProcedure } from "../src/parseProcedure";

function node(
  id: string,
  kind: SkillNode["kind"],
  extra: Partial<SkillNode> = {},
): SkillNode {
  return {
    id,
    label: id,
    kind,
    path: `/${id}`,
    summary: "",
    uses: [],
    ...extra,
  };
}

const spineNodes: SkillNode[] = [
  node("skill-md", "skill", { isEntry: true, label: "SKILL.md" }),
  node("procedure-source", "reference", { label: "workflow.md" }),
  node("step:P", "script", { label: "P · context.py" }),
  node("step:N1", "script", { label: "N1 · resolve.py" }),
  node("step:N2a", "script"),
  node("step:N2b", "agent"),
  node("step:N2c", "script"),
  node("step:N3", "agent"),
  node("gate:question", "gate"),
  node("step:N4", "agent"),
  node("step:N4v", "script"),
  node("step:N5", "agent"),
  node("step:N7", "script"),
  node("skill:handoff-target", "skill", { label: "handoff-target" }),
];

const spineEdges: SkillEdge[] = [
  { from: "skill-md", to: "procedure-source", label: "read on invoke" },
  { from: "procedure-source", to: "step:P" },
  { from: "step:P", to: "step:N1" },
  { from: "step:N1", to: "step:N2a", label: "parallel" },
  { from: "step:N1", to: "step:N2b", label: "parallel" },
  { from: "step:N1", to: "step:N2c", label: "parallel" },
  { from: "step:N2a", to: "step:N3" },
  { from: "step:N2b", to: "step:N3" },
  { from: "step:N2c", to: "step:N3" },
  { from: "step:N3", to: "gate:question" },
  { from: "gate:question", to: "step:N4", label: "Bug | Change" },
  { from: "gate:question", to: "step:N5", label: "Question", confidence: "low" },
  { from: "step:N4", to: "step:N4v" },
  { from: "step:N4v", to: "step:N5" },
  { from: "step:N5", to: "step:N7" },
  { from: "step:N7", to: "skill:handoff-target", label: "handoff", confidence: "low", inferred: true },
];

const emptyHome = path.resolve(__dirname, "../fixtures/empty-home");

function rankIds(ranks: SkillNode[][]): string[][] {
  return ranks.map((rank) => rank.map((n) => n.id));
}

function rowIds(columns: ReturnType<typeof columnsFromLevels>[]): string[][][] {
  return columns.map((row) => row.map((c) => c.nodes.map((n) => n.id)));
}

function parseFixture(rel: string) {
  return parseProcedure({
    skillRoot: path.resolve(__dirname, rel),
    catalog: [
      {
        id: "handoff-target",
        name: "handoff-target",
        description: "handoff",
        rootPath: path.resolve(__dirname, "../fixtures/project/.claude/skills/handoff-target"),
      },
    ],
    homedir: emptyHome,
  });
}

function assertHealthyCompact(nodes: SkillNode[], edges: SkillEdge[]): ReturnType<typeof toCompactFlow> {
  const filtered = filterForCompact(nodes, edges);
  const flow = toCompactFlow(nodes, edges);
  expect(compactNodeBoxesOverlap(flow.nodes)).toBe(false);
  expect(rankIds(compactLevels(filtered.nodes, filtered.edges))).toEqual(
    rankIds(dagreLrRanks(filtered.nodes, filtered.edges)),
  );
  const allowed = new Set(filtered.edges.map((edge) => `${edge.from}->${edge.to}`));
  for (const edge of flow.edges) {
    expect(allowed.has(`${edge.source}->${edge.target}`)).toBe(true);
  }
  expect(flow.nodes.map((n) => n.id).sort()).toEqual(filtered.nodes.map((n) => n.id).sort());
  return flow;
}

const demoRoot = path.resolve(__dirname, "../fixtures/demo-skills");
const demoSkillNames = fs
  .readdirSync(demoRoot, { withFileTypes: true })
  .filter(
    (entry) => entry.isDirectory() && fs.existsSync(path.join(demoRoot, entry.name, "SKILL.md")),
  )
  .map((entry) => entry.name)
  .sort();

describe("compactLayout", () => {
  it("filters dangling support satellites but keeps in-flow siblings", () => {
    const nodes = [
      node("skill-md", "skill", { isEntry: true }),
      node("procedure-source", "reference"),
      node("step:P", "script"),
      node("step:N5", "agent"),
      node("step:N5v", "agent"),
      node("support:schemas/analysis.schema.json", "reference", { label: "analysis.schema.json" }),
      node("support:references/output-template.md", "reference", { label: "output-template.md" }),
      node("support:references/classify.md", "reference"),
    ];
    const edges: SkillEdge[] = [
      { from: "skill-md", to: "procedure-source" },
      { from: "procedure-source", to: "step:P" },
      { from: "step:P", to: "support:references/classify.md", confidence: "low", inferred: true },
      { from: "step:N5", to: "step:N5v", label: "conditional", confidence: "low", inferred: true },
      { from: "step:N5", to: "support:schemas/analysis.schema.json", label: "shape", inferred: true },
      { from: "step:N5", to: "support:references/output-template.md", label: "slots", inferred: true },
    ];
    const filtered = filterForCompact(nodes, edges);
    expect(filtered.nodes.map((n) => n.id)).toEqual([
      "skill-md",
      "procedure-source",
      "step:P",
      "step:N5",
      "step:N5v",
      "support:schemas/analysis.schema.json",
      "support:references/output-template.md",
    ]);
    expect(filtered.edges).toHaveLength(5);
  });

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

  it("stacks parallel siblings and keeps real fork edges", () => {
    const flow = toCompactFlow(spineNodes, spineEdges);
    expect(flow.nodes.every((n) => n.data.compact)).toBe(true);
    expect(flow.nodes.every((n) => n.data.direction === "LR")).toBe(true);

    const n2a = flow.nodes.find((n) => n.id === "step:N2a")!;
    const n2b = flow.nodes.find((n) => n.id === "step:N2b")!;
    const n2c = flow.nodes.find((n) => n.id === "step:N2c")!;
    const n3 = flow.nodes.find((n) => n.id === "step:N3")!;
    const p = flow.nodes.find((n) => n.id === "step:P")!;
    const gate = flow.nodes.find((n) => n.id === "gate:question")!;

    expect(n2a.position.x).toBe(n2b.position.x);
    expect(n2b.position.x).toBe(n2c.position.x);
    const n2ys = [n2a.position.y, n2b.position.y, n2c.position.y].sort((a, b) => a - b);
    expect(n2ys[0]).toBeLessThan(n2ys[1]);
    expect(n2ys[1]).toBeLessThan(n2ys[2]);
    expect(n3.position.x).toBeGreaterThan(n2a.position.x);
    expect(p.position.y).toBeLessThan(gate.position.y);

    const wrap = flow.edges.find((e) => e.source === "step:N3" && e.target === "gate:question");
    expect(wrap?.sourceHandle).toBe("out-bottom");
    expect(wrap?.targetHandle).toBe("in-left");
    expect(wrap?.type).toBe("compactWrap");

    const skip = flow.edges.find((e) => e.source === "gate:question" && e.target === "step:N5");
    expect(skip?.sourceHandle).toBe("out-top");
    expect(skip?.targetHandle).toBe("in-top");

    const ids = new Set(flow.edges.map((e) => `${e.source}->${e.target}`));
    expect(ids.has("gate:question->step:N4")).toBe(true);
    expect(ids.has("gate:question->step:N5")).toBe(true);
    expect(ids.has("skill-md->skill:handoff-target")).toBe(false);
    expect(compactNodeBoxesOverlap(flow.nodes)).toBe(false);
    expect(flow.edges.some((e) => e.label === "parallel")).toBe(false);
  });

  it("keeps unsupported P/N rows visible without inventing support relationships", () => {
    const result = parseFixture("../fixtures/analyse-ticket-pn");
    expect(result.diagnosis.confidence).toBe("partial");
    const flow = assertHealthyCompact(result.graph.nodes, result.graph.edges);
    expect(flow.nodes.filter(n => n.id.startsWith("step:"))).toHaveLength(12);
    expect(flow.edges.some(e => e.source.startsWith("step:"))).toBe(false);
    expect(flow.nodes.some(n => n.id.startsWith("support:"))).toBe(false);
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

  it("keeps the gate-skip Question fork without a support cluster", () => {
    const result = parseFixture("../fixtures/demo-skills/gate-skip");
    expect(result.diagnosis.confidence).toBe("high");
    const flow = toCompactFlow(result.graph.nodes, result.graph.edges);
    expect(compactNodeBoxesOverlap(flow.nodes)).toBe(false);
    expect(flow.nodes.some((n) => n.id === "step:N3")).toBe(true);
    expect(flow.nodes.some((n) => n.id.startsWith("support:"))).toBe(false);
    const ids = new Set(flow.edges.map((e) => `${e.source}->${e.target}`));
    expect(ids.has("step:N3->step:N4")).toBe(true);
    expect(ids.has("step:N3->step:N5")).toBe(true);
    expect(ids.has("step:N3->step:N4")).toBe(true);
    expect(ids.has("step:N4->step:N5")).toBe(true);
    expect(flow.edges.some((e) => e.label === "Question")).toBe(true);
    expect(flow.edges.some((e) => e.label === "Bug | Change")).toBe(true);
  });

  it("keeps the explicit review chain without turning schema references into steps", () => {
    const result = parseFixture("../fixtures/demo-skills/support-handoff");
    expect(result.diagnosis.confidence).toBe("high");
    const flow = assertHealthyCompact(result.graph.nodes, result.graph.edges);
    expect(flow.edges.filter(e => e.source === "step:N5v" && e.target === "step:N6")).toHaveLength(1);
    expect(flow.nodes.some(n => n.id.startsWith("support:"))).toBe(false);
    expect(flow.edges.some(e => e.label === "handoff")).toBe(false);
  });
});

describe.each(demoSkillNames)("demo-skills/%s", (name) => {
  it("parses high-confidence and packs without overlap or invented edges", () => {
    const result = parseFixture(`../fixtures/demo-skills/${name}`);
    expect(result.diagnosis.confidence).toBe("high");
    expect(result.graph.nodes.length).toBeGreaterThan(2);
    assertHealthyCompact(result.graph.nodes, result.graph.edges);
  });
});

describe("generic compact DAGs", () => {
  it("keeps the explicitly sequential review fixture sequential", () => {
    const result = parseFixture("../fixtures/demo-skills/pair-support");
    const flow = assertHealthyCompact(result.graph.nodes, result.graph.edges);
    expect(flow.edges.some(e => e.source === "step:N5" && e.target === "step:N5v")).toBe(true);
    expect(flow.edges.some(e => e.source === "step:N5v" && e.target === "step:N6")).toBe(true);
    expect(flow.nodes.some(n => n.id.startsWith("support:"))).toBe(false);
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

  it("keeps fan-out and a Question gate on the same DAG", () => {
    const result = parseFixture("../fixtures/demo-skills/gate-and-fanout");
    const ids = new Set(result.graph.nodes.map((n) => n.id));
    expect(ids.has("step:N2a")).toBe(true);
    expect(ids.has("step:N2b")).toBe(true);
    expect(ids.has("step:N3")).toBe(true);
    const flow = assertHealthyCompact(result.graph.nodes, result.graph.edges);
    expect(flow.edges.some((e) => e.label === "Question")).toBe(true);
    expect(flow.edges.some((e) => e.label === "Bug | Change")).toBe(true);
  });

  it("wraps a P/N chain that has a workflow.md entry strip", () => {
    const result = parseFixture("../fixtures/demo-skills/pn-chain");
    expect(result.graph.nodes.some((n) => n.id === "procedure-source")).toBe(true);
    const flow = assertHealthyCompact(result.graph.nodes, result.graph.edges);
    expect(flow.edges.some((e) => e.type === "compactWrap")).toBe(true);
  });

  it("stacks two fan-outs in one synthetic DAG", () => {
    const nodes = [
      node("skill-md", "skill", { isEntry: true }),
      node("a", "script"),
      node("b1", "script"),
      node("b2", "script"),
      node("c", "script"),
      node("d1", "agent"),
      node("d2", "agent"),
      node("e", "script"),
    ];
    const edges: SkillEdge[] = [
      { from: "skill-md", to: "a" },
      { from: "a", to: "b1" },
      { from: "a", to: "b2" },
      { from: "b1", to: "c" },
      { from: "b2", to: "c" },
      { from: "c", to: "d1" },
      { from: "c", to: "d2" },
      { from: "d1", to: "e" },
      { from: "d2", to: "e" },
    ];
    const flow = assertHealthyCompact(nodes, edges);
    const b1 = flow.nodes.find((n) => n.id === "b1")!;
    const b2 = flow.nodes.find((n) => n.id === "b2")!;
    const d1 = flow.nodes.find((n) => n.id === "d1")!;
    const d2 = flow.nodes.find((n) => n.id === "d2")!;
    expect(b1.position.x).toBe(b2.position.x);
    expect(d1.position.x).toBe(d2.position.x);
    expect(b1.position.y).not.toBe(b2.position.y);
    expect(d1.position.y).not.toBe(d2.position.y);
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

  it("stacks eight parallel siblings without overlap", () => {
    const kids = ["a", "b", "c", "d", "e", "f", "g", "h"].map((id) => node(id, "script"));
    const nodes = [node("skill-md", "skill", { isEntry: true }), node("src", "script"), ...kids, node("join", "script")];
    const edges: SkillEdge[] = [
      { from: "skill-md", to: "src" },
      ...kids.map((kid) => ({ from: "src", to: kid.id })),
      ...kids.map((kid) => ({ from: kid.id, to: "join" })),
    ];
    const flow = assertHealthyCompact(nodes, edges);
    const xs = kids.map((kid) => flow.nodes.find((n) => n.id === kid.id)!.position.x);
    expect(new Set(xs).size).toBe(1);
    const ys = kids.map((kid) => flow.nodes.find((n) => n.id === kid.id)!.position.y).sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i += 1) {
      expect(ys[i]).toBeGreaterThan(ys[i - 1]);
    }
  });

  it("routes a skip over a wrapped row without inventing edges", () => {
    const nodes = [
      node("skill-md", "skill", { isEntry: true }),
      node("a", "script"),
      node("b", "script"),
      node("c", "script"),
      node("d", "script"),
      node("e", "script"),
      node("f", "script"),
    ];
    const edges: SkillEdge[] = [
      { from: "skill-md", to: "a" },
      { from: "a", to: "b" },
      { from: "b", to: "c" },
      { from: "c", to: "d" },
      { from: "d", to: "e" },
      { from: "e", to: "f" },
      { from: "c", to: "f", label: "skip", confidence: "low" },
    ];
    const flow = assertHealthyCompact(nodes, edges);
    expect(flow.edges.some((edge) => edge.source === "c" && edge.target === "f")).toBe(true);
  });
});

describe("groupInventory", () => {
  it("groups catalog nodes by kind for the inventory list", () => {
    const groups = groupInventory([
      node("skill-md", "skill", { isEntry: true, label: "SKILL.md" }),
      node("agent:worker-evidence", "agent", { label: "worker-evidence" }),
      node("scripts/resolve.py", "script", { label: "resolve.py" }),
      node("references/workflow.md", "reference", { label: "workflow.md" }),
      node("skill:handoff-target", "skill", { label: "handoff-target" }),
    ]);
    expect(groups.map((g) => g.id)).toEqual([
      "entry",
      "agents",
      "scripts",
      "references",
      "handoffs",
    ]);
  });
});
