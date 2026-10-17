import { describe, expect, it } from "vitest";
import { emptyDiagnosis } from "@shared/protocol";
import { deriveAppView, viewHint, type AppViewInput } from "./appModel";
import { emptyGraph } from "./appConfig";
import { node } from "./compactTestHelpers";

function input(overrides: Partial<AppViewInput> = {}): AppViewInput {
  return {
    view: "flow",
    compact: false,
    narrow: false,
    direction: "TB",
    diagnosis: { ...emptyDiagnosis(), confidence: "high" },
    graph: emptyGraph,
    procedure: emptyGraph,
    selectedId: undefined,
    expandedIds: [],
    stale: false,
    ...overrides,
  };
}

describe("view hint", () => {
  it("asks for a refresh when skill files changed", () => {
    expect(viewHint({ stale: true, view: "flow", compact: true })).toMatch(/Refresh/);
  });

  it("describes the catalog as an inventory, not an execution order", () => {
    expect(viewHint({ stale: false, view: "catalog", compact: false })).toMatch(/does not imply execution order/);
  });
});

describe("derived flow view", () => {
  it("hides the diagnosis banner when flow confidence is high", () => {
    expect(deriveAppView(input()).showDiagnosis).toBe(false);
  });

  it("shows the diagnosis banner for an uncertain flow", () => {
    expect(deriveAppView(input({ diagnosis: emptyDiagnosis() })).showDiagnosis).toBe(true);
  });

  it("counts the compact chips that are actually drawn", () => {
    const procedure = {
      ...emptyGraph,
      nodes: [
        node("a", "skill", { label: "SKILL.md" }),
        node("b", "reference", { label: "notes" }),
        node("support:orphan", "reference", { label: "dropped helper" }),
      ],
    };
    const model = deriveAppView(input({ compact: true, procedure }));
    expect(model.display.nodes).toHaveLength(3);
    expect(model.inventoryCount).toBe(2);
  });
});
