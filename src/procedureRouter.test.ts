import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, expect, it } from "vitest";
import { parseProcedure } from "./parseProcedure";
import { ROUTER_HEURISTIC } from "./procedureRouter";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function parse(files: Record<string, string>) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "router-"));
  roots.push(root);
  for (const [name, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), body);
  }
  return { root, ...parseProcedure({ skillRoot: root, catalog: [], homedir: root }) };
}

const TABLE_SKILL = [
  "---", "name: router", "description: Routes verbs.", "---", "",
  "# Router", "", "## Verbs", "",
  "| Verb | One-liner | Recipe |",
  "|------|-----------|--------|",
  "| `day` | Plan the day | `recipes/day.md` |",
  "| `close` | Close the day | `recipes/close.md` |",
  "", "## Rules", "", "1. Never write outside the inbox.", "",
].join("\n");

it("shows a table that routes to local files as unordered branches", () => {
  const result = parse({ "SKILL.md": TABLE_SKILL, "recipes/day.md": "# Day\n", "recipes/close.md": "# Close\n" });
  const steps = result.graph.nodes.filter(node => node.id.startsWith("step:"));
  expect(steps.map(node => [node.label, node.summary, node.source?.startLine])).toEqual([
    ["day", "Plan the day", 12],
    ["close", "Close the day", 13],
  ]);
  expect(steps.map(node => node.resourcePath)).toEqual([
    path.join(result.root, "recipes/day.md"),
    path.join(result.root, "recipes/close.md"),
  ]);
  expect(result.graph.edges.every(edge => edge.from === "skill-md" && edge.confidence === "low")).toBe(true);
  expect(result.diagnosis.confidence).toBe("partial");
  expect(result.diagnosis.message).toContain(ROUTER_HEURISTIC);
});

it("reads a bullet list of markdown links as routes", () => {
  const skill = "# Router\n\n## Modes\n\n- [Review](references/review.md): check a diff\n- [Write](references/write.md): draft text\n";
  const result = parse({ "SKILL.md": skill, "references/review.md": "x", "references/write.md": "y" });
  expect(result.graph.nodes.filter(node => node.id.startsWith("step:")).map(node => [node.label, node.summary])).toEqual([
    ["Review", "check a diff"],
    ["Write", "draft text"],
  ]);
});

it("ignores routes whose files do not exist or that point to one file only", () => {
  const skill = "# Router\n\n## Verbs\n\n| Verb | Recipe |\n|--|--|\n| a | `recipes/a.md` |\n| b | `recipes/missing.md` |\n";
  const result = parse({ "SKILL.md": skill, "recipes/a.md": "x" });
  expect(result.diagnosis.message).not.toContain(ROUTER_HEURISTIC);
});

it("keeps numbered steps ahead of a routing table", () => {
  const skill = `${TABLE_SKILL}\n## Workflow\n\n1. Pick a verb.\n2. Run its recipe.\n`;
  const result = parse({ "SKILL.md": skill, "recipes/day.md": "x", "recipes/close.md": "y" });
  expect(result.diagnosis.confidence).toBe("high");
  expect(result.diagnosis.message).not.toContain(ROUTER_HEURISTIC);
});

it("skips a routing table under an excluded heading", () => {
  const skill = TABLE_SKILL.replace("## Verbs", "## Examples");
  const result = parse({ "SKILL.md": skill, "recipes/day.md": "x", "recipes/close.md": "y" });
  expect(result.diagnosis.message).not.toContain(ROUTER_HEURISTIC);
});

it("accepts backslash route paths and CRLF line endings", () => {
  const skill = TABLE_SKILL.replace("`recipes/day.md`", "`recipes\\day.md`").replace(/\n/g, "\r\n");
  const result = parse({ "SKILL.md": skill, "recipes/day.md": "x", "recipes/close.md": "y" });
  const steps = result.graph.nodes.filter(node => node.id.startsWith("step:"));
  expect(steps.map(node => [node.label, node.summary])).toEqual([["day", "Plan the day"], ["close", "Close the day"]]);
  expect(steps[0].resourcePath).toBe(path.join(result.root, "recipes", "day.md"));
});

it("never routes to SKILL.md itself, whatever its case", () => {
  const skill = "# R\n\n## Modes\n\n- [Self](skill.md): loop\n- [A](a.md): one\n- [B](b.md): two\n";
  const result = parse({ "SKILL.md": skill, "a.md": "x", "b.md": "y" });
  expect(result.graph.nodes.filter(node => node.id.startsWith("step:")).map(node => node.label)).not.toContain("Self");
});

it("finds a bare route path followed by a full stop", () => {
  const result = parse({
    "SKILL.md": "# Router\n\n- Billing: see refs/billing.md.\n- Support: refs/support.md\n",
    "refs/billing.md": "# Billing\n",
    "refs/support.md": "# Support\n",
  });
  const routes = result.graph.nodes.filter(node => node.id.startsWith("step:")).map(node => node.resourcePath);
  expect(routes).toEqual([path.join(result.root, "refs/billing.md"), path.join(result.root, "refs/support.md")]);
});
