import { describe, expect, it } from "vitest";
import type { SkillEdge } from "@shared/protocol";
import { filterForCompact } from "./compactFilter";
import { node } from "./compactTestHelpers";

describe("compactFilter", () => {
  it("filters dangling support satellites but keeps in-flow siblings", () => {
    const nodes = [
      node("skill-md", "skill", { isEntry: true }),
      node("procedure-source", "reference"),
      node("step:P", "script"),
      node("step:N5", "agent"),
      node("step:N5v", "agent"),
      node("support:schemas/analysis.schema.json", "reference", { label: "analysis.schema.json" }),
      node("support:references/output-template.md", "reference", { label: "output-template.md" }),
      node("support:references/classify.md", "reference"),
    ];
    const edges: SkillEdge[] = [
      { from: "skill-md", to: "procedure-source" },
      { from: "procedure-source", to: "step:P" },
      { from: "step:P", to: "support:references/classify.md", confidence: "low", inferred: true },
      { from: "step:N5", to: "step:N5v", label: "conditional", confidence: "low", inferred: true },
      { from: "step:N5", to: "support:schemas/analysis.schema.json", label: "shape", inferred: true },
      { from: "step:N5", to: "support:references/output-template.md", label: "slots", inferred: true },
    ];
    const filtered = filterForCompact(nodes, edges);
    expect(filtered.nodes.map((n) => n.id)).toEqual([
      "skill-md",
      "procedure-source",
      "step:P",
      "step:N5",
      "step:N5v",
      "support:schemas/analysis.schema.json",
      "support:references/output-template.md",
    ]);
    expect(filtered.edges).toHaveLength(5);
  });
});
