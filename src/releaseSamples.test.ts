import * as path from "node:path";
import { expect, it } from "vitest";
import { parseProcedure } from "./parseProcedure";
import { parseSkill } from "./parseSkill";
const base = path.resolve(__dirname, "../fixtures/release-samples");
// Manually specified before executing the parser; never regenerated from its output.
const expected = [
  ["numbered-review", "high", 6, 5, "SKILL.md", [7, 8, 9, 10, 11, 12]],
  ["prose-translator", "none", 0, 0, "SKILL.md", []],
  ["linked-checklist", "high", 3, 2, "references/operations.md", [1, 3, 5]],
  ["asset-report", "high", 3, 2, "SKILL.md", [7, 8, 9]],
  ["explicit-routing", "high", 4, 4, "workflow.md", [3, 4, 5, 6]],
  ["prose-pn-routing", "high", 8, 9, "workflow.md", [4, 5, 6, 7, 8, 9, 10, 11]],
  ["ambiguous-route", "partial", 2, 0, "SKILL.md", [8, 9]],
] as const;
it.each(expected)("reviews %s against independent expectations", (name, confidence, count, edgeCount, source, lines) => {
  const root = path.join(base, name), result = parseProcedure({ skillRoot: root, catalog: [] });
  const steps = result.graph.nodes.filter(n => n.id.startsWith("step:"));
  const edges = result.graph.edges.filter(e => e.from.startsWith("step:"));
  expect(result.diagnosis.confidence).toBe(confidence);
  expect(steps).toHaveLength(count); expect(edges).toHaveLength(edgeCount);
  expect(steps.map(n => n.source?.startLine)).toEqual(lines);
  expect(steps.every(n => n.source?.path === path.join(root, source))).toBe(true);
  expect(edges.every(e => e.relationship === "explicit" && !!e.source)).toBe(true);
  const catalog = parseSkill({ skillRoot: root, catalog: [] });
  expect(catalog.nodes.some(n => n.isEntry)).toBe(true);
  if (name === "asset-report") {
    expect(steps[0].resourcePath).toBe(path.join(root, "assets/template.md"));
    expect(steps[1].resourcePath).toBe(path.join(root, "scripts/report.py"));
    expect(catalog.nodes.map(n => n.label)).toEqual(expect.arrayContaining(["template.md", "report.py"]));
  }
  if (name === "explicit-routing") expect(edges.map(e => [e.from, e.to, e.label])).toEqual([
    ["step:N1", "step:N2", "question"], ["step:N1", "step:N3", "change"], ["step:N2", "step:N4", undefined], ["step:N3", "step:N4", undefined],
  ]);
  if (name === "prose-pn-routing") expect(edges.map(e => [e.from, e.to, e.label])).toEqual([
    ["step:P", "step:N1", undefined], ["step:N1", "step:N2a", undefined], ["step:N1", "step:N2b", undefined],
    ["step:N2a", "step:N3", undefined], ["step:N2b", "step:N3", undefined], ["step:N3", "step:N4", "if the request is a question"],
    ["step:N3", "step:N5", "otherwise"], ["step:N4", "step:N6", undefined], ["step:N5", "step:N6", undefined],
  ]);
});
