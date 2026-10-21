import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, expect, it } from "vitest";
import { parseProcedure } from "./parseProcedure";
import { parseSkill } from "./parseSkill";

// Each body is close to the 256 KiB read limit. A quadratic regex takes tens of seconds
// here; linear parsing stays far under the budget, which leaves room for slow CI runners.
const SIZE = 240_000;
const BUDGET_MS = 1500;
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function repeatTo(unit: string): string {
  return unit.repeat(Math.ceil(SIZE / unit.length)).slice(0, SIZE);
}

const BODIES: Record<string, string> = {
  "a heading padded with spaces": `# a${" ".repeat(SIZE)}#z\n`,
  "a heading of hashes": `# ${"#".repeat(SIZE)}x\n`,
  "unclosed link openers": `${repeatTo("[a](")}\n`,
  "nested link openers": `${repeatTo("[a]([a")}\n`,
  "a bare path without .md": `- ${repeatTo("1.1.")}\n`,
  "a long word in a table": `| ${repeatTo("a")}.mx |\n`,
  "a route bullet padded with spaces": `- [a](a.md) a${" ".repeat(SIZE)}b\n- [b](b.md) b\n`,
  "a P/N row cut by a carriage return": `# Workflow\nP a${repeatTo("  b")}\rx\nP start\nN1 go\n`,
  "a diagram line cut by a carriage return": `# Workflow\nP start\n↓\nN1 next\na${" ".repeat(SIZE)}\rx\n`,
  "a diagram bypass of dashes": `# Workflow\nP start\n↓\nN1 next\na${" ─".repeat(SIZE / 4)}\n`,
  "arrow prose padded with spaces": `# Workflow\nP start\nN1 next\nFrom N1, run a${" ".repeat(SIZE)}x\n`,
};

function skillWith(body: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pathological-"));
  roots.push(root);
  fs.writeFileSync(path.join(root, "SKILL.md"), `---\nname: slow\ndescription: d\n---\n${body}`);
  for (const route of ["a.md", "b.md"]) fs.writeFileSync(path.join(root, route), "# Route\n");
  return root;
}

it.each(Object.entries(BODIES))("parses a SKILL.md with %s within the time budget", (_name, body) => {
  const root = skillWith(body);
  const started = performance.now();
  parseProcedure({ skillRoot: root, catalog: [], homedir: root });
  parseSkill({ skillRoot: root, catalog: [], homedir: root });
  expect(performance.now() - started).toBeLessThan(BUDGET_MS);
});
