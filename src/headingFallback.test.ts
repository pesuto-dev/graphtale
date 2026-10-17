import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, expect, it } from "vitest";
import { FLOW_MAX_STEPS } from "./fileAccess";
import { HEADING_HEURISTIC, HEADING_REWRITE_EXAMPLE } from "./headingFallback";
import { parseProcedure } from "./parseProcedure";
import { isHostToWebview } from "./shared/protocol";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function parse(files: Record<string, string>) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "headings-"));
  roots.push(root);
  for (const [name, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), body);
  }
  return { root, ...parseProcedure({ skillRoot: root, catalog: [], homedir: root }) };
}

function steps(result: ReturnType<typeof parse>) {
  return result.graph.nodes.filter((node) => node.id.startsWith("step:"));
}

const fixture = path.resolve(__dirname, "../fixtures/parser-regressions");

it("shows ## and ### headings as unordered source-linked steps", () => {
  const root = path.join(fixture, "heading-heuristic");
  const result = parseProcedure({ skillRoot: root, catalog: [], homedir: root });
  const found = result.graph.nodes.filter((node) => node.id.startsWith("step:"));
  expect(found.map((node) => node.label)).toEqual(["Gather", "Scope", "Classify"]);
  expect(found.map((node) => node.source?.startLine)).toEqual([10, 13, 16]);
  expect(found.every((node) => node.source?.endLine === node.source?.startLine)).toBe(true);
  expect(found.every((node) => node.source?.path === path.join(root, "SKILL.md"))).toBe(true);
  expect(found.map((node) => node.summary)).toEqual([
    "Read the ticket and note the product area.",
    "Stay inside the reported product area.",
    "Decide whether this is a bug or a question.",
  ]);
  expect(result.graph.edges.filter((edge) => edge.from.startsWith("step:"))).toHaveLength(0);
  expect(result.graph.edges.map((edge) => [edge.from, edge.to, edge.relationship])).toEqual([
    ["skill-md", "step:1", "inferred"],
    ["skill-md", "step:2", "inferred"],
    ["skill-md", "step:3", "inferred"],
  ]);
  expect(result.diagnosis.confidence).toBe("partial");
  expect(result.diagnosis.message).toContain(HEADING_HEURISTIC);
  expect(result.diagnosis.rewriteExample).toBe(HEADING_REWRITE_EXAMPLE);
  expect(result.graph.nodes.find((node) => node.isEntry)?.id).toBe("skill-md");
});

it("keeps an empty flow when the prose has no ## or ### headings", () => {
  const root = path.join(fixture, "prose-no-headings");
  const result = parseProcedure({ skillRoot: root, catalog: [], homedir: root });
  expect(result.diagnosis.confidence).toBe("none");
  expect(result.diagnosis.message).toMatch(/No supported step structure/i);
  expect(result.diagnosis.rewriteExample).toBeUndefined();
  expect(result.graph.nodes).toHaveLength(0);
});

it("ignores a title, deeper headings, fences, frontmatter, and excluded sections", () => {
  const result = parse({
    "SKILL.md": [
      "---",
      "name: hidden",
      "description: |",
      "  ## Fake frontmatter",
      "---",
      "",
      "# Title only",
      "",
      "#### Too deep",
      "",
      "```md",
      "## Fenced",
      "```",
      "",
      "## **",
      "## **Gather**",
      "",
      "## Examples",
      "### Nested example",
      "",
      "## Appendix",
      "Notes stay out.",
    ].join("\n"),
  });
  expect(steps(result).map((node) => node.label)).toEqual(["Gather"]);
  expect(steps(result)[0]?.source?.startLine).toBe(16);
  expect(result.diagnosis.rewriteExample).toContain("## First Steps");
});

it("lets a numbered list win over headings in the same skill", () => {
  const result = parse({
    "SKILL.md": "## Gather\nContext.\n\n## Instructions\n1. Read request\n2. Return review\n",
  });
  expect(result.diagnosis.confidence).toBe("high");
  expect(result.diagnosis.rewriteExample).toBeUndefined();
  expect(steps(result).map((node) => node.label)).toEqual(["1. Read request", "2. Return review"]);
  expect(result.graph.edges.filter((edge) => edge.from.startsWith("step:")).map((edge) => edge.to)).toEqual(["step:2"]);
});

it("lets an explicit P/N graph win over prose headings", () => {
  const result = parse({
    "SKILL.md": "## Gather\nSee [workflow](workflow.md).\n",
    "workflow.md": "# Workflow\nN1  Start\nN2  Finish\nN1 -> N2\n",
  });
  expect(result.diagnosis.confidence).toBe("high");
  expect(result.diagnosis.rewriteExample).toBeUndefined();
  expect(steps(result).map((node) => node.label)).toEqual(["N1. Start", "N2. Finish"]);
});

it("uses headings from workflow.md when that file has no procedure", () => {
  const result = parse({
    "SKILL.md": "---\nname: linked\ndescription: test\n---\n\nSee [workflow](workflow.md).\n",
    "workflow.md": "# Background\n\n## Gather\nRead the ticket.\n\n## Classify\nDecide bug or question.\n",
  });
  const found = steps(result);
  expect(found.map((node) => node.label)).toEqual(["Gather", "Classify"]);
  expect(found.map((node) => [node.source?.startLine, node.source?.path.endsWith("workflow.md")])).toEqual([
    [3, true],
    [6, true],
  ]);
  expect(result.graph.edges.map((edge) => [edge.from, edge.to])).toEqual([
    ["skill-md", "procedure-source"],
    ["procedure-source", "step:1"],
    ["procedure-source", "step:2"],
  ]);
  expect(result.graph.edges.every((edge) => edge.relationship === "inferred")).toBe(true);
  expect(result.diagnosis.message).toContain("workflow.md");
});

it("names a heading-only linked file when it has no prose summary", () => {
  const headingsOnly = parse({
    "SKILL.md": "See [workflow](workflow.md).\n",
    "workflow.md": "## Gather\n## Classify\n",
  });
  expect(headingsOnly.graph.nodes.find((node) => node.id === "procedure-source")?.summary).toBe("Flow source");
});

it("prefers SKILL.md headings when a linked workflow has neither a procedure nor headings", () => {
  const result = parse({
    "SKILL.md": "---\nname: thin-link\ndescription: test\n---\n\nSee [workflow.md](workflow.md).\n\n## Gather\nRead the ticket.\n",
    "workflow.md": "# TODO write the real steps\n",
  });
  expect(steps(result).map((node) => node.label)).toEqual(["Gather"]);
  expect(steps(result)[0]?.source?.path.endsWith("SKILL.md")).toBe(true);
  expect(result.diagnosis.message).toContain(HEADING_HEURISTIC);
});

it("stops after the flow step cap and keeps the heading diagnosis", () => {
  const lines = Array.from({ length: 501 }, (_, index) => `## Step ${String(index + 1)}`);
  const result = parse({ "SKILL.md": `${lines.join("\n")}\n` });
  const cap = `Flow shows ${String(FLOW_MAX_STEPS)} of ${String(FLOW_MAX_STEPS + 1)} steps.`;
  expect(steps(result)).toHaveLength(500);
  expect(result.graph.warnings).toContain(cap);
  expect(result.diagnosis.message).toContain(cap);
  expect(result.diagnosis.message).toContain(HEADING_HEURISTIC);
  expect(result.diagnosis.confidence).toBe("partial");
});

it("keeps heading steps when SKILL.md frontmatter never closes", () => {
  const result = parse({
    "SKILL.md": [
      "---",
      "name: unclosed",
      "description: missing closer",
      "",
      "## Gather",
      "Read the ticket.",
      "",
      "## Classify",
      "Decide bug or question.",
    ].join("\n"),
  });
  expect(steps(result).map((node) => node.label)).toEqual(["Gather", "Classify"]);
  expect(result.diagnosis.confidence).toBe("partial");
  expect(result.diagnosis.message).toContain(HEADING_HEURISTIC);
  expect(result.diagnosis.message).toMatch(/SKILL\.md: Frontmatter is missing its closing ---/);
  expect(result.graph.warnings).toContain("SKILL.md: Frontmatter is missing its closing ---.");
  expect(result.diagnosis.rewriteExample).toBe(HEADING_REWRITE_EXAMPLE);
});

it("documents the same rewrite example the banner shows", () => {
  // actions/checkout on Windows writes CRLF; the banner string uses LF.
  const doc = fs.readFileSync(path.resolve(__dirname, "../docs/parser-coverage.md"), "utf8").replace(/\r\n/g, "\n");
  expect(doc).toContain(HEADING_HEURISTIC);
  expect(doc).toContain(HEADING_REWRITE_EXAMPLE);
  expect(HEADING_REWRITE_EXAMPLE).toContain("## Gather");
  expect(HEADING_REWRITE_EXAMPLE).toContain("1. Gather: read the ticket and note the product area.");
  expect(HEADING_REWRITE_EXAMPLE).toContain("2. Classify: decide whether this is a bug or a question.");
});

it("accepts the rewrite example on a host graph message", () => {
  const result = parse({ "SKILL.md": "## Gather\nRead the ticket.\n" });
  const message = { type: "graph" as const, graph: result.graph, procedure: result.graph, diagnosis: result.diagnosis, catalog: [], direction: "TB" as const };
  expect(result.diagnosis.rewriteExample).toBe(HEADING_REWRITE_EXAMPLE);
  expect(isHostToWebview(message)).toBe(true);
});

it("rejects a rewrite example that is not text", () => {
  const result = parse({ "SKILL.md": "## Gather\nRead the ticket.\n" });
  const message = { type: "graph" as const, graph: result.graph, procedure: result.graph, diagnosis: result.diagnosis, catalog: [], direction: "TB" as const };
  expect(isHostToWebview({ ...message, diagnosis: { ...result.diagnosis, rewriteExample: 1 } })).toBe(false);
});
