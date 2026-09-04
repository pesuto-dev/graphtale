import { describe, expect, it } from "vitest";
import { dagreLrRanks, toFlow } from "./layout";
import type { SkillGraph } from "@shared/protocol";

const graph: SkillGraph = {
  skillId: "demo",
  skillName: "demo",
  rootPath: "/demo",
  nodes: [
    {
      id: "skill-md",
      label: "SKILL.md",
      kind: "skill",
      path: "/demo/SKILL.md",
      summary: "Entry",
      uses: [{ label: "classify.md", targetId: "prompts/classify.md" }],
      isEntry: true,
    },
    {
      id: "prompts/classify.md",
      label: "classify.md",
      kind: "agent",
      path: "/demo/prompts/classify.md",
      summary: "Classify",
      uses: [],
      isBlock: true,
    },
  ],
  edges: [
    { from: "skill-md", to: "prompts/classify.md", label: "classify" },
    {
      from: "skill-md",
      to: "pending:x",
      inferred: true,
      label: "pending",
    },
  ],
};

describe("toFlow", () => {
  it("marks inferred pending edges dashed and keeps expanded node class", () => {
    const flow = toFlow(graph.nodes, graph.edges, "LR", ["skill-md"]);
    const entry = flow.nodes.find((node) => node.id === "skill-md");
    const pending = flow.edges.find((edge) => edge.label === "pending");
    const explicit = flow.edges.find((edge) => edge.label === "classify");

    expect(entry?.data.expanded).toBe(true);
    expect(entry?.className).toBe("rf-expanded");
    expect(pending?.className).toBe("edge-pending");
    expect(pending?.style?.strokeDasharray).toBe("5 4");
    expect(explicit?.className).toBe("edge-explicit");
  });
});

describe("dagreLrRanks", () => {
  it("groups nodes in the same left-to-right order as toFlow LR", () => {
    const ranks = dagreLrRanks(graph.nodes, graph.edges).map((rank) => rank.map((n) => n.id));
    const flow = toFlow(graph.nodes, graph.edges, "LR", []);
    const byX = [...flow.nodes].sort(
      (a, b) => a.position.x - b.position.x || a.position.y - b.position.y || a.id.localeCompare(b.id),
    );
    expect(ranks.flat()).toEqual(byX.map((n) => n.id));
    expect(ranks[0]?.[0]).toBe("skill-md");
  });
});
