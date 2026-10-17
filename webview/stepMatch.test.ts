import { describe, expect, it } from "vitest";
import type { SkillNode } from "@shared/protocol";
import { nodesPresentOnFlow, rankSteps, stepNumberAndTitle } from "./stepMatch";

function node(partial: Pick<SkillNode, "id" | "label"> & Partial<SkillNode>): SkillNode {
  return {
    kind: "script",
    path: `/skills/${partial.id}`,
    summary: "",
    uses: [],
    ...partial,
  };
}

const steps = [
  node({ id: "step:1", label: "1. Read request", kind: "skill" }),
  node({ id: "step:2", label: "2. Gather files", kind: "reference" }),
  node({ id: "step:20", label: "20. Archive the review", kind: "script" }),
  node({ id: "step:N2a", label: "N2a. Research the ticket", kind: "agent" }),
  node({ id: "step:N2b", label: "N2b. Verify the ticket", kind: "agent" }),
];

describe("stepNumberAndTitle", () => {
  it("reads the number and title from a numbered label", () => {
    expect(stepNumberAndTitle(steps[3])).toEqual({ number: "N2a", title: "Research the ticket" });
  });

  it("uses the step id when the label has no number", () => {
    expect(stepNumberAndTitle(node({ id: "step:3", label: "Compare edits" }))).toEqual({
      number: "3",
      title: "Compare edits",
    });
  });

  it("leaves the number empty when the node is not a step", () => {
    expect(stepNumberAndTitle(node({ id: "skill-md", label: "SKILL.md", kind: "skill" })).number).toBe("");
  });
});

describe("rankSteps", () => {
  it("prefers an exact number over a longer number", () => {
    expect(rankSteps(steps, "2").map((item) => item.id)).toEqual(["step:2"]);
  });

  it("matches an exact number ignoring case", () => {
    expect(rankSteps(steps, "n2a").map((item) => item.id)).toEqual(["step:N2a"]);
  });

  it("offers N2a and N2b for the shared prefix, in source order", () => {
    expect(rankSteps(steps, "N2").map((item) => item.id)).toEqual(["step:N2a", "step:N2b"]);
  });

  it("matches a title substring", () => {
    expect(rankSteps(steps, "research").map((item) => item.id)).toEqual(["step:N2a"]);
  });

  it("matches a title that starts the query", () => {
    expect(rankSteps(steps, "gather files").map((item) => item.id)).toEqual(["step:2"]);
  });

  it("matches the numbered label when the title alone does not", () => {
    expect(rankSteps(steps, "1. read").map((item) => item.id)).toEqual(["step:1"]);
  });

  it("matches a bare step id", () => {
    const bare = node({ id: "step:3", label: "Compare edits" });
    expect(rankSteps([bare], "3").map((item) => item.id)).toEqual(["step:3"]);
  });

  it("returns nothing for a blank query", () => {
    expect(rankSteps(steps, "  ")).toEqual([]);
  });

  it("returns nothing for an unknown query", () => {
    expect(rankSteps(steps, "not-a-step")).toEqual([]);
  });
});

describe("nodesPresentOnFlow", () => {
  it("keeps only nodes that the current flow still draws", () => {
    expect(nodesPresentOnFlow(steps, [{ id: "step:2" }, { id: "step:20" }]).map((item) => item.id)).toEqual([
      "step:2",
      "step:20",
    ]);
  });
});
