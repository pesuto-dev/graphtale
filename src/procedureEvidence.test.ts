import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, expect, it } from "vitest";
import { parseProcedure } from "./parseProcedure";
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => fs.rmSync(root, { recursive: true, force: true })));
function parse(text: string, extras: Record<string, string> = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "evidence-")); roots.push(root);
  for (const [name, body] of Object.entries({ "SKILL.md": text, ...extras })) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), body);
  }
  return { root, ...parseProcedure({ skillRoot: root, catalog: [], homedir: root }) };
}
it("stops numbered headings at Appendix and includes the instruction heading in ranges", () => {
  const result = parse("## 1. Prepare\nDetails\n## 2. Finish\n## Appendix\n### 1. Example\n### 2. Example\n");
  const steps = result.graph.nodes.filter(n => n.id.startsWith("step:"));
  expect(steps.map(n => n.label)).toEqual(["1. Prepare", "2. Finish"]);
  expect(steps.map(n => [n.source?.startLine, n.source?.endLine])).toEqual([[1, 2], [3, 3]]);
});
it("does not leak Instructions into nested Notes or Examples", () => {
  const result = parse("## Instructions\n1. Prepare\n2. Finish\n### Notes\n1. Example\n2. Example\n");
  expect(result.graph.nodes.filter(n => n.id.startsWith("step:")).map(n => n.label)).toEqual(["1. Prepare", "2. Finish"]);
});
it.each(["Review options", "Compare alternatives", "Write notes", "Check reference", "Review examples", "Update appendix", "Record choices"])("retains numbered instruction %s and its sequence", title => {
  const result = parse(`## 1. Prepare\n## 2. ${title}\n## 3. Finish\n`);
  expect(result.graph.nodes.filter(n => n.id.startsWith("step:")).map(n => n.label)).toEqual(["1. Prepare", `2. ${title}`, "3. Finish"]);
  expect(result.graph.edges.filter(e => e.from.startsWith("step:")).map(e => [e.from, e.to])).toEqual([["step:1", "step:2"], ["step:2", "step:3"]]);
});
it.each(["Examples", "Appendix"])("keeps numbered descendants of %s excluded", section => {
  const result = parse(`## 1. Prepare\n## 2. Finish\n## ${section}\n### Instructions\n#### 1. Review options\n#### 2. Finish\n`);
  expect(result.graph.nodes.filter(n => n.id.startsWith("step:")).map(n => n.label)).toEqual(["1. Prepare", "2. Finish"]);
});
it("does not join separate lists or confidently order conditional choices", () => {
  const result = parse("## Instructions\n1. If input is red, paint it\n2. Otherwise wash it\n## Operations\n1. Finish\n");
  expect(result.diagnosis.confidence).toBe("partial");
  expect(result.graph.edges.filter(e => e.from.startsWith("step:"))).toHaveLength(0);
});
it("skips mixed delimiters inside code fences and frontmatter", () => {
  const result = parse('---\nnotes: |\n  ## 1. Fake\n  ## 2. Fake\n---\n## Instructions\n````md\n```\n1. Fake\n2. Fake\n````\n1. Prepare\n2. Finish');
  expect(result.graph.nodes.filter(n => n.id.startsWith("step:")).map(n => n.label)).toEqual(["1. Prepare", "2. Finish"]);
});
it("keeps a linked resource separate from instruction source and full title", () => {
  const result = parse("## 1. Open: the input\nUse [data](assets/data.txt).\n## 2. Return\n", { "assets/data.txt": "data" });
  const step = result.graph.nodes.find(n => n.id === "step:1")!;
  expect(step.label).toBe("1. Open: the input");
  expect(step.path).toBe(path.join(result.root, "SKILL.md"));
  expect(step.resourcePath).toBe(path.join(result.root, "assets/data.txt"));
});
it("draws only exact P/N arrow statements and records their evidence", () => {
  const result = parse("See [workflow](workflow.md)", { "workflow.md": "# Workflow\n```text\nN3  Choose\nN4  Bake\nN5  Cool\nN3 -> N4 (hot)\nN3 -> N5 (cold)\n```" });
  const edges = result.graph.edges.filter(e => e.from.startsWith("step:"));
  expect(result.diagnosis.confidence).toBe("high");
  expect(edges.map(e => [e.from, e.to, e.label])).toEqual([["step:N3", "step:N4", "hot"], ["step:N3", "step:N5", "cold"]]);
  expect(edges.every(e => e.source?.path === path.join(result.root, "workflow.md") && e.relationship === "explicit")).toBe(true);
});
it("draws source-backed P/N routes stated in workflow prose", () => {
  const result = parse("See [workflow](workflow.md)", { "workflow.md": `# Workflow
\`\`\`text
P   Intake
N1  Split
N2a Research
N2b Verify
N3  Combine
N4  Explain
N5  Investigate
N6  Return
\`\`\`

P then N1.
From N1, run N2a and N2b in parallel.
After N2a and N2b, continue with N3.
From N3, if the request is a question, continue with N4; otherwise, continue with N5.
N4 then N6.
N5 then N6.
` });
  const edges = result.graph.edges.filter(e => e.from.startsWith("step:"));
  expect(result.diagnosis.confidence).toBe("high");
  expect(edges.map(e => [e.from, e.to, e.label, e.source?.startLine])).toEqual([
    ["step:P", "step:N1", undefined, 13],
    ["step:N1", "step:N2a", undefined, 14],
    ["step:N1", "step:N2b", undefined, 14],
    ["step:N2a", "step:N3", undefined, 15],
    ["step:N2b", "step:N3", undefined, 15],
    ["step:N3", "step:N4", "if the request is a question", 16],
    ["step:N3", "step:N5", "otherwise", 16],
    ["step:N4", "step:N6", undefined, 17],
    ["step:N5", "step:N6", undefined, 18],
  ]);
});
it("does not turn P/N mentions or output arrows into routes", () => {
  const result = parse("See [workflow](workflow.md)", { "workflow.md": `# Workflow
\`\`\`text
P   Intake -> Bundle
N1  Split -> Jobs
N2  Return
\`\`\`

N1 produces an output for N2 readers.
The P -> Bundle notation names an output, not a route.
` });
  expect(result.diagnosis.confidence).toBe("partial");
  expect(result.graph.edges.filter(e => e.from.startsWith("step:"))).toHaveLength(0);
});
it("retains P/N row titles that start with routing words", () => {
  const result = parse("See [workflow](workflow.md)", { "workflow.md": `# Workflow
\`\`\`text
N1  Next steps
N2  Continue with deployment
N3  Go to market review
\`\`\`
` });
  const steps = result.graph.nodes.filter(node => node.id.startsWith("step:"));
  expect(steps.map(node => node.label)).toEqual([
    "N1. Next steps", "N2. Continue with deployment", "N3. Go to market review",
  ]);
  expect(result.diagnosis.confidence).toBe("partial");
});
it("draws the routes stated by a P/N diagram's parallel, barrier, and labeled branch markers", () => {
  const result = parse("See [workflow](workflow.md)", { "workflow.md": `# Workflow

The graph, node by node.

\`\`\`
P   Preflight
N1  Resolve
      ── parallel ──
      N2a Attachments
      N2b Evidence
      N2c Prior
      ── barrier ──
N3  Classify
      Question ────────┐
      Bug | Change ↓   │
N4  Forensics
N5  Synthesis          │
      ── join ─────────┘
N6  Validate
\`\`\`
` });
  const edges = result.graph.edges.filter(edge => edge.from.startsWith("step:"));
  expect(edges.map(edge => [edge.from, edge.to, edge.label, edge.source?.startLine])).toEqual([
    ["step:N1", "step:N2a", undefined, 8],
    ["step:N2a", "step:N3", undefined, 12],
    ["step:N1", "step:N2b", undefined, 8],
    ["step:N2b", "step:N3", undefined, 12],
    ["step:N1", "step:N2c", undefined, 8],
    ["step:N2c", "step:N3", undefined, 12],
    ["step:N3", "step:N5", "Question", 14],
    ["step:N3", "step:N4", "Bug | Change", 15],
    ["step:N5", "step:N6", undefined, 18],
    ["step:P", "step:N1", undefined, 7],
    ["step:N4", "step:N5", undefined, 17],
  ]);
  expect(result.diagnosis.confidence).toBe("high");
});
it("does not detect P/N examples in a program fence", () => {
  const result = parse("See [workflow](workflow.md)", { "workflow.md": "# Workflow\n```python\nN3  Bake  scripts/bake.py\nN4  Cool  scripts/cool.py\n```" });
  expect(result.graph.nodes.filter(n => n.id.startsWith("step:"))).toHaveLength(0);
});
it("retains single steps and handles missing files without changing source files", () => {
  const result = parse("## Instructions\n1. Done\n");
  expect(result.graph.nodes.filter(n => n.id.startsWith("step:"))).toHaveLength(1);
  expect(fs.readFileSync(path.join(result.root, "SKILL.md"), "utf8")).toBe("## Instructions\n1. Done\n");
  fs.unlinkSync(path.join(result.root, "SKILL.md"));
  expect(parseProcedure({ skillRoot: result.root, catalog: [] }).diagnosis.confidence).toBe("none");
});
it("resolves operations links relative to their containing document", () => {
  const result = parse("See [operations](references/operations.md)", { "references/operations.md": "## 1. Read\nUse [data](../assets/data.txt)\n## 2. Return\n", "assets/data.txt": "data" });
  expect(result.graph.nodes.find(n => n.id === "step:1")?.resourcePath).toBe(path.join(result.root, "assets/data.txt"));
});
it("does not sequence a choose-one list or an inline example", () => {
  const choices = parse("## Instructions\nChoose one:\n1. Red\n2. Blue\n");
  expect(choices.diagnosis.confidence).toBe("partial");
  expect(choices.graph.edges.filter(e => e.from.startsWith("step:"))).toHaveLength(0);
  const example = parse("## Instructions\nFor example:\n1. Red\n2. Blue\n");
  const exampleLabels = example.graph.nodes.filter(n => n.id.startsWith("step:")).map(n => n.label);
  expect(exampleLabels).not.toContain("1. Red");
  expect(exampleLabels).not.toContain("2. Blue");
  expect(example.graph.edges.filter(e => e.from.startsWith("step:"))).toHaveLength(0);
});
it("omits cycles and ignores arrow examples instead of reporting full coverage", () => {
  const result = parse("See [workflow](workflow.md)", { "workflow.md": "# Workflow\nN1  Start\nN2  Finish\nN1 -> N2\nN2 -> N1\n## Examples\nN1 -> N2 (fake)\n" });
  expect(result.diagnosis.confidence).toBe("partial");
  expect(result.graph.edges.filter(e => e.from.startsWith("step:")).map(e => [e.from, e.to])).toEqual([["step:N1", "step:N2"]]);
});
it("marks disconnected arrow components as partial", () => {
  const result = parse("See [workflow](workflow.md)", { "workflow.md": "# Workflow\nN1  Start\nN2  Finish\nN3  Other\nN4  End\nN1 -> N2\nN3 -> N4\n" });
  expect(result.diagnosis.confidence).toBe("partial");
});
