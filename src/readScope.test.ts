import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, expect, it } from "vitest";
import { parseProcedure } from "./parseProcedure";
import { parseSkill } from "./parseSkill";
import { OUTSIDE_SCOPE_SUMMARY, inReadScope, readScope } from "./readScope";

const SECRET = "TOP-SECRET-VALUE";
const bases: string[] = [];
afterEach(() => {
  for (const base of bases.splice(0)) fs.rmSync(base, { recursive: true, force: true });
});

function layout(files: Record<string, string>): { base: string; skill: string; home: string } {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "read-scope-")));
  bases.push(base);
  for (const [name, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(base, name)), { recursive: true });
    fs.writeFileSync(path.join(base, name), body);
  }
  return { base, skill: path.join(base, "skills", "demo"), home: path.join(base, "home") };
}

function catalogGraph(skill: string, home: string, workspaceFolders: string[] = []): string {
  return JSON.stringify(parseSkill({ skillRoot: skill, catalog: [], homedir: home, workspaceFolders }));
}

it("lists a link outside the skill without reading it", () => {
  const { skill, home } = layout({ "skills/demo/SKILL.md": "See [notes](../../outside/notes.md)\n", "outside/notes.md": `${SECRET}\n` });
  const graph = parseSkill({ skillRoot: skill, catalog: [], homedir: home });
  const node = graph.nodes.find(item => item.label === "notes.md");
  expect(node).toMatchObject({ kind: "shared", summary: OUTSIDE_SCOPE_SUMMARY });
  expect(JSON.stringify(graph)).not.toContain(SECRET);
});

it("does not read a home file that is not a skill or agent folder", () => {
  const { skill, home } = layout({ "skills/demo/SKILL.md": "See [creds](~/.aws/credentials)\n", "home/.aws/credentials": `${SECRET}\n` });
  expect(catalogGraph(skill, home)).not.toContain(SECRET);
});

it("reads links inside the skill, the workspace, and the agent folders", () => {
  const { base, skill, home } = layout({
    "skills/demo/SKILL.md": "See [guide](references/guide.md), [docs](../../ws/docs.md) and agent helper\n",
    "skills/demo/references/guide.md": "Guide summary\n",
    "ws/docs.md": "Workspace summary\n",
    "home/.claude/agents/helper.md": "Helper summary\n",
  });
  const graph = catalogGraph(skill, home, [path.join(base, "ws")]);
  expect(graph).toContain("Guide summary");
  expect(graph).toContain("Workspace summary");
  expect(graph).toContain("Helper summary");
});

it("treats a symlink inside the skill that points outside as outside", () => {
  const { base, skill, home } = layout({ "skills/demo/SKILL.md": "See [link](link.md)\n", "outside/target.md": `${SECRET}\n` });
  try {
    fs.symlinkSync(path.join(base, "outside", "target.md"), path.join(skill, "link.md"));
  } catch {
    return; // Windows without symlink rights: nothing to check.
  }
  expect(inReadScope(path.join(skill, "link.md"), readScope({ skillRoot: skill, homedir: home }))).toBe(false);
  expect(catalogGraph(skill, home)).not.toContain(SECRET);
});

it("does not read an agent definition that is a symlink to elsewhere", () => {
  const { base, skill, home } = layout({ "skills/demo/SKILL.md": "Use agent helper.\n", "outside/creds.md": `${SECRET}\n` });
  fs.mkdirSync(path.join(skill, "agents"));
  try {
    fs.symlinkSync(path.join(base, "outside", "creds.md"), path.join(skill, "agents", "helper.md"));
  } catch {
    return; // Windows without symlink rights: nothing to check.
  }
  expect(catalogGraph(skill, home)).not.toContain(SECRET);
});

it("does not build Flow from a workflow.md outside the read scope", () => {
  const { skill, home } = layout({
    "skills/demo/SKILL.md": "See [workflow](../../outside/workflow.md)\n",
    "outside/workflow.md": `## Instructions\n1. ${SECRET}\n2. Done\n`,
  });
  const result = parseProcedure({ skillRoot: skill, catalog: [], homedir: home });
  expect(JSON.stringify(result.graph.nodes)).not.toContain(SECRET);
  expect(JSON.stringify(result)).toContain("outside the skill and workspace folders");
});
