/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { emptyGraph } from "./appConfig";
import { node } from "./compactTestHelpers";
import { directionAfterSwitch, entryAfterSwitch, nodeClickIntent } from "./viewCommands";

describe("entryAfterSwitch", () => {
  it("picks the procedure entry when Flow opens", () => {
    const procedure = {
      ...emptyGraph,
      nodes: [node("step:1", "reference"), node("skill-md", "skill", { isEntry: true })],
    };
    expect(entryAfterSwitch("flow", emptyGraph, procedure)?.id).toBe("skill-md");
  });

  it("picks the catalog entry when Catalog opens", () => {
    const graph = { ...emptyGraph, nodes: [node("agents/review.md", "agent", { isEntry: true })] };
    expect(entryAfterSwitch("catalog", graph, emptyGraph)?.id).toBe("agents/review.md");
  });
});

describe("directionAfterSwitch", () => {
  it("turns a wide Flow back to top-to-bottom", () => {
    expect(directionAfterSwitch("flow", "LR", false)).toBe("TB");
  });

  it("leaves Compact Flow on its current direction", () => {
    expect(directionAfterSwitch("flow", "LR", true)).toBeNull();
  });
});

describe("nodeClickIntent", () => {
  it("expands when the click starts on the uses control", () => {
    const step = document.createElement("div");
    const expand = document.createElement("button");
    expand.dataset.expand = "step:1";
    step.append(expand);
    expect(nodeClickIntent(expand, "step:1")).toEqual({ type: "expand", id: "step:1" });
  });

  it("follows a use chip to its target", () => {
    const chip = document.createElement("span");
    chip.dataset.targetId = "agents/review.md";
    expect(nodeClickIntent(chip, "step:1")).toEqual({ type: "follow", id: "agents/review.md" });
  });

  it("selects the node itself for a plain click", () => {
    expect(nodeClickIntent(document.createElement("div"), "step:2")).toEqual({ type: "select", id: "step:2" });
  });
});
