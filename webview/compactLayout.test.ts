import { describe, expect, it } from "vitest";
import { groupInventory } from "./inventoryGroups";
import { compactNodeBoxesOverlap } from "./compactGeometry";
import { toCompactFlow } from "./compactLayout";
import {
  assertHealthyCompact,
  demoSkillNames,
  node,
  parseFixture,
} from "./compactTestHelpers";

describe("compactLayout", () => {
  it("keeps unsupported P/N rows visible without inventing support relationships", () => {
    const result = parseFixture("../fixtures/analyse-ticket-pn");
    expect(result.diagnosis.confidence).toBe("partial");
    const flow = assertHealthyCompact(result.graph.nodes, result.graph.edges);
    expect(flow.nodes.filter(n => n.id.startsWith("step:"))).toHaveLength(12);
    expect(flow.edges.some(e => e.source.startsWith("step:"))).toBe(false);
    expect(flow.nodes.some(n => n.id.startsWith("support:"))).toBe(false);
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
describe.each(demoSkillNames)("demo-skills/%s", (name) => {
  it("parses high-confidence and packs without overlap or invented edges", () => {
    const result = parseFixture(`../fixtures/demo-skills/${name}`);
    expect(result.diagnosis.confidence).toBe("high");
    expect(result.graph.nodes.length).toBeGreaterThan(2);
    assertHealthyCompact(result.graph.nodes, result.graph.edges);
  });
});
  it("keeps the explicitly sequential review fixture sequential", () => {
    const result = parseFixture("../fixtures/demo-skills/pair-support");
    const flow = assertHealthyCompact(result.graph.nodes, result.graph.edges);
    expect(flow.edges.some(e => e.source === "step:N5" && e.target === "step:N5v")).toBe(true);
    expect(flow.edges.some(e => e.source === "step:N5v" && e.target === "step:N6")).toBe(true);
    expect(flow.nodes.some(n => n.id.startsWith("support:"))).toBe(false);
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
});
