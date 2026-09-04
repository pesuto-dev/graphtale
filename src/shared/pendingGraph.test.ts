import { describe, expect, it } from "vitest";
import {
  findCatalogNode,
  graphWithPending,
  pendingNodeFromCatalog,
} from "./pendingGraph";
import type { CatalogSkill, SkillGraph } from "./protocol";

const handoffTarget: CatalogSkill = {
  id: "handoff-target",
  name: "handoff-target",
  description: "Next skill",
  rootPath: "/repo/.claude/skills/handoff-target",
};

const graph: SkillGraph = {
  skillId: "sample-skill",
  skillName: "sample-skill",
  rootPath: "/repo/sample-skill",
  nodes: [
    {
      id: "skill-md",
      label: "SKILL.md",
      kind: "skill",
      path: "/repo/sample-skill/SKILL.md",
      summary: "A sample skill",
      uses: [],
      isEntry: true,
    },
    {
      id: "skill:handoff-target",
      label: "handoff-target",
      kind: "skill",
      path: "/repo/.claude/skills/handoff-target/SKILL.md",
      summary: "Next skill",
      uses: [],
      inferred: true,
    },
  ],
  edges: [
    {
      from: "skill-md",
      to: "skill:handoff-target",
      inferred: true,
      label: "handoff",
    },
  ],
};

describe("pendingGraph", () => {
  it("finds a catalog skill already on the graph", () => {
    const found = findCatalogNode(graph, handoffTarget);
    expect(found?.id).toBe("skill:handoff-target");
  });

  it("adds a dashed pending edge for a skill that is not linked yet", () => {
    const extra: CatalogSkill = {
      id: "extra-skill",
      name: "extra-skill",
      description: "Another skill",
      rootPath: "/repo/.claude/skills/extra-skill",
    };
    const next = graphWithPending(graph, extra);
    expect(next.nodes.some((node) => node.pending && node.label === "extra-skill")).toBe(true);
    expect(next.edges).toContainEqual({
      from: "skill-md",
      to: pendingNodeFromCatalog(extra).id,
      inferred: true,
      label: "pending",
    });
  });

  it("does not duplicate a skill that is already linked", () => {
    const next = graphWithPending(graph, handoffTarget);
    expect(next.nodes).toHaveLength(graph.nodes.length);
    expect(next.edges).toHaveLength(graph.edges.length);
  });
});
