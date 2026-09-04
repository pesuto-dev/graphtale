import { describe, expect, it } from "vitest";
import { selectionAfterReload } from "./reload";

const nodes = [
  { id: "skill-md", isEntry: true },
  { id: "workflow.md" },
];

describe("selectionAfterReload", () => {
  it("keeps the selected node when the same skill is refreshed", () => {
    expect(selectionAfterReload("/repo/analyse-ticket", "/repo/analyse-ticket", "workflow.md", nodes)).toEqual({
      resetView: false,
      selectedId: "workflow.md",
    });
  });

  it("falls back to the entry when the old node disappeared", () => {
    expect(selectionAfterReload("/repo/analyse-ticket", "/repo/analyse-ticket", "gone", nodes)).toEqual({
      resetView: false,
      selectedId: "skill-md",
    });
  });

  it("resets the view when a different skill is opened", () => {
    expect(selectionAfterReload("/repo/analyse-ticket", "/repo/other", "workflow.md", nodes)).toEqual({
      resetView: true,
      selectedId: "skill-md",
    });
  });
});
