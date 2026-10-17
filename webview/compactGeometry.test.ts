import { describe, expect, it } from "vitest";
import { compactNodeBoxesOverlap } from "./compactGeometry";
import { toCompactFlow } from "./compactLayout";
import { assertHealthyCompact, node, spineEdges, spineNodes } from "./compactTestHelpers";
import type { SkillEdge } from "@shared/protocol";

describe("compactGeometry", () => {
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
