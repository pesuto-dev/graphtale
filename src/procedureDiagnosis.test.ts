import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, expect, it } from "vitest";
import { FLOW_MAX_STEPS } from "./fileAccess";
import { parseProcedure } from "./parseProcedure";
import type { ProcedureResult } from "./shared/protocol";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => fs.rmSync(root, { recursive: true, force: true })));

function parseWorkflow(workflow: string) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "named-diagnosis-"));
  roots.push(root);
  fs.writeFileSync(path.join(root, "SKILL.md"), "---\nname: sample\ndescription: test\n---\n\nSee [workflow](workflow.md).\n");
  fs.writeFileSync(path.join(root, "workflow.md"), workflow);
  return parseProcedure({ skillRoot: root, catalog: [], homedir: root });
}

function stepEdges(result: ProcedureResult) {
  return result.graph.edges.filter(edge => edge.from.startsWith("step:")).map(edge => [edge.from, edge.to]);
}

it("names a P/N cycle and the edge omitted from the flow", () => {
  const result = parseWorkflow([
    "# Workflow",
    "",
    "N1  Start",
    "N2  Middle",
    "N3  End",
    "N1 -> N2",
    "N2 -> N3",
    "N3 -> N1",
    "",
  ].join("\n"));
  const cycle = "Cycle N1->N2->N3->N1; omitted edge N3->N1.";
  expect(result.diagnosis.confidence).toBe("partial");
  expect(result.diagnosis.message).toContain(cycle);
  expect(result.diagnosis.fixPrompt).toContain(cycle);
  expect(result.diagnosis.message).not.toBe(
    "Flow detected from workflow.md as P/N rows (3 steps). Some relationships are unresolved or only part of the structure is supported.",
  );
  expect(stepEdges(result)).toEqual([["step:N1", "step:N2"], ["step:N2", "step:N3"]]);
});

it("names a duplicate P/N id and the lines that define it", () => {
  const result = parseWorkflow([
    "# Workflow",
    "",
    "N1  Start",
    "N2  Next",
    "N1  Again",
    "N1 -> N2",
    "",
  ].join("\n"));
  const duplicate = "Duplicate step id N1 on lines 3 and 5.";
  expect(result.diagnosis.confidence).toBe("partial");
  expect(result.diagnosis.message).toContain(duplicate);
  expect(result.diagnosis.fixPrompt).toContain(duplicate);
  expect(stepEdges(result)).toEqual([]);

  const three = parseWorkflow([
    "# Workflow",
    "",
    "N1  Start",
    "N2  Next",
    "N1  Again",
    "N1  Third",
    "N2 -> N3",
    "",
  ].join("\n"));
  expect(three.diagnosis.message).toContain("Duplicate step id N1 on lines 3, 5, and 6.");
  expect(three.diagnosis.message).toContain("Arrow to missing id N3 on line 7.");
  expect(stepEdges(three)).toEqual([]);
});

it("names an arrow whose target id is missing and the source line", () => {
  const result = parseWorkflow([
    "# Workflow",
    "",
    "N1  Start",
    "N2  Next",
    "N1 -> N2",
    "N2 -> N9",
    "",
  ].join("\n"));
  const missing = "Arrow to missing id N9 on line 6.";
  expect(result.diagnosis.confidence).toBe("partial");
  expect(result.diagnosis.message).toContain(missing);
  expect(result.diagnosis.fixPrompt).toContain(missing);
  expect(stepEdges(result)).toEqual([["step:N1", "step:N2"]]);
});

it("warns with the total and the shown count when the flow exceeds 500 steps", () => {
  expect(FLOW_MAX_STEPS).toBe(500);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "named-diagnosis-cap-"));
  roots.push(root);
  const steps = Array.from({ length: FLOW_MAX_STEPS + 1 }, (_, index) => `${index + 1}. Step ${index + 1}`).join("\n");
  fs.writeFileSync(path.join(root, "SKILL.md"), `---\nname: long\ndescription: test\n---\n\n## Instructions\n${steps}\n`);
  const result = parseProcedure({ skillRoot: root, catalog: [], homedir: root });
  const warning = `Flow shows ${FLOW_MAX_STEPS} of ${FLOW_MAX_STEPS + 1} steps.`;
  const ids = new Set(result.graph.nodes.map(node => node.id));
  expect(result.diagnosis.confidence).toBe("partial");
  expect(result.diagnosis.message).toContain(warning);
  expect(result.diagnosis.fixPrompt).toContain(warning);
  expect(result.graph.warnings).toContain(warning);
  expect(result.graph.nodes.filter(node => node.id.startsWith("step:"))).toHaveLength(FLOW_MAX_STEPS);
  expect(result.graph.edges.every(edge => ids.has(edge.from) && ids.has(edge.to))).toBe(true);
});
