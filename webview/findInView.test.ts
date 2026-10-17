import { describe, expect, it } from "vitest";
import type { SkillNode } from "@shared/protocol";
import {
  filterCatalogNodes,
  isFindShortcut,
  rankSteps,
  stepFocusOptions,
  stepNumberAndTitle,
} from "./findInView";

function node(partial: Pick<SkillNode, "id" | "label"> & Partial<SkillNode>): SkillNode {
  return {
    kind: "script",
    path: `/skills/${partial.id}`,
    summary: "",
    uses: [],
    ...partial,
  };
}

const catalog = [
  node({
    id: "skill-md",
    label: "SKILL.md",
    kind: "skill",
    path: "/skills/review/SKILL.md",
    summary: "Review a change using its source evidence.",
    isEntry: true,
  }),
  node({
    id: "scripts/resolve.py",
    label: "resolve.py",
    path: "/skills/review/scripts/resolve.py",
    summary: "Parses the ticket queue.",
  }),
  node({
    id: "skill:handoff-target",
    label: "handoff-target",
    kind: "skill",
    path: "/skills/handoff-target/SKILL.md",
    summary: "Writes the customer reply.",
  }),
];

const steps = [
  node({ id: "step:1", label: "1. Read request", kind: "skill" }),
  node({ id: "step:2", label: "2. Gather files", kind: "reference" }),
  node({ id: "step:20", label: "20. Archive the review", kind: "script" }),
  node({ id: "step:N2a", label: "N2a. Research the ticket", kind: "agent" }),
  node({ id: "step:N2b", label: "N2b. Verify the ticket", kind: "agent" }),
];

describe("filterCatalogNodes", () => {
  it("returns every node when the query is blank", () => {
    expect(filterCatalogNodes(catalog, "  ")).toEqual(catalog);
  });

  it("matches file name, path, and description without case", () => {
    expect(filterCatalogNodes(catalog, "RESOLVE").map((item) => item.id)).toEqual(["scripts/resolve.py"]);
    expect(filterCatalogNodes(catalog, "scripts/").map((item) => item.id)).toEqual(["scripts/resolve.py"]);
    expect(filterCatalogNodes(catalog, "customer reply").map((item) => item.id)).toEqual(["skill:handoff-target"]);
  });

  it("returns no nodes when nothing matches", () => {
    expect(filterCatalogNodes(catalog, "missing-file")).toEqual([]);
  });
});

describe("rankSteps", () => {
  it("reads the number and title from a numbered label", () => {
    expect(stepNumberAndTitle(steps[3])).toEqual({ number: "N2a", title: "Research the ticket" });
  });

  it("prefers an exact number over a longer number and a title hit", () => {
    expect(rankSteps(steps, "2").map((item) => item.id)).toEqual(["step:2"]);
    expect(rankSteps(steps, "n2a").map((item) => item.id)).toEqual(["step:N2a"]);
  });

  it("offers N2a and N2b for the shared prefix, in source order", () => {
    expect(rankSteps(steps, "N2").map((item) => item.id)).toEqual(["step:N2a", "step:N2b"]);
  });

  it("matches a title substring and ignores a blank or unknown query", () => {
    expect(rankSteps(steps, "research").map((item) => item.id)).toEqual(["step:N2a"]);
    expect(rankSteps(steps, "  ")).toEqual([]);
    expect(rankSteps(steps, "not-a-step")).toEqual([]);
  });

  it("uses the step id when the label has no number, and an exact title", () => {
    const bare = node({ id: "step:3", label: "Compare edits" });
    expect(stepNumberAndTitle(bare)).toEqual({ number: "3", title: "Compare edits" });
    expect(stepNumberAndTitle(node({ id: "skill-md", label: "SKILL.md", kind: "skill" })).number).toBe("");
    expect(rankSteps(steps, "gather files").map((item) => item.id)).toEqual(["step:2"]);
    expect(rankSteps(steps, "1. read").map((item) => item.id)).toEqual(["step:1"]);
    expect(rankSteps([bare], "3").map((item) => item.id)).toEqual(["step:3"]);
  });
});

describe("isFindShortcut", () => {
  const base = { key: "f", metaKey: false, ctrlKey: false, altKey: false, shiftKey: false };

  it("accepts Ctrl+F and Cmd+F only", () => {
    expect(isFindShortcut({ ...base, ctrlKey: true })).toBe(true);
    expect(isFindShortcut({ ...base, key: "F", metaKey: true })).toBe(true);
    expect(isFindShortcut({ ...base, ctrlKey: true, shiftKey: true })).toBe(false);
    expect(isFindShortcut({ ...base, ctrlKey: true, altKey: true })).toBe(false);
    expect(isFindShortcut(base)).toBe(false);
  });
});

describe("stepFocusOptions", () => {
  it("centers one node with a modest zoom", () => {
    expect(stepFocusOptions("step:2")).toEqual({
      nodes: [{ id: "step:2" }],
      padding: 0.45,
      duration: 180,
      minZoom: 0.2,
      maxZoom: 1.2,
    });
  });
});
