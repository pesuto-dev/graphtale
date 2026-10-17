import { describe, expect, it } from "vitest";
import { stepFocusOptions } from "./stepFocus";

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
