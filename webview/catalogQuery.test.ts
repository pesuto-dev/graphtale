import { describe, expect, it } from "vitest";
import type { SkillNode } from "@shared/protocol";
import { catalogMatchStatus, catalogQueryClears, filterCatalogNodes } from "./catalogQuery";

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

describe("filterCatalogNodes", () => {
  it("returns every node when the query is blank", () => {
    expect(filterCatalogNodes(catalog, "  ")).toEqual(catalog);
  });

  it("matches a file name without case", () => {
    expect(filterCatalogNodes(catalog, "RESOLVE").map((item) => item.id)).toEqual(["scripts/resolve.py"]);
  });

  it("matches a path", () => {
    expect(filterCatalogNodes(catalog, "scripts/").map((item) => item.id)).toEqual(["scripts/resolve.py"]);
  });

  it("matches a description", () => {
    expect(filterCatalogNodes(catalog, "customer reply").map((item) => item.id)).toEqual(["skill:handoff-target"]);
  });

  it("returns no nodes when nothing matches", () => {
    expect(filterCatalogNodes(catalog, "missing-file")).toEqual([]);
  });
});

describe("catalogMatchStatus", () => {
  it("stays quiet for a blank query", () => {
    expect(catalogMatchStatus("  ", 0, 3)).toBe("");
  });

  it("reports a miss", () => {
    expect(catalogMatchStatus("missing", 0, 3)).toBe('No files match "missing".');
  });

  it("reports how many files remain", () => {
    expect(catalogMatchStatus("resolve", 1, 3)).toBe("1 of 3 files");
  });
});

describe("catalogQueryClears", () => {
  it("clears on Escape when the query has text", () => {
    expect(catalogQueryClears("Escape", "resolve")).toBe(true);
  });

  it("leaves an empty query alone on Escape", () => {
    expect(catalogQueryClears("Escape", "")).toBe(false);
  });

  it("ignores keys other than Escape", () => {
    expect(catalogQueryClears("Enter", "resolve")).toBe(false);
  });
});
