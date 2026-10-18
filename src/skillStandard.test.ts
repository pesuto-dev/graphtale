import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, expect, it } from "vitest";
import { parseProcedure } from "./parseProcedure";
import { CONDITIONAL } from "./procedureScan";
import { WORKFLOW_LINK } from "./repairPlan";
import { buildFixPrompt } from "./shared/protocol";

// actions/checkout on Windows writes CRLF; compare with LF.
const standard = fs.readFileSync(path.resolve(__dirname, "../docs/skill-standard.md"), "utf8").replace(/\r\n/g, "\n");
const EXAMPLE = /<!-- example-file: (\S+) -->\n````markdown\n([\s\S]*?)\n````/g;

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function examples(): Map<string, Record<string, string>> {
  const skills = new Map<string, Record<string, string>>();
  for (const [, file, body] of standard.matchAll(EXAMPLE)) {
    const [skill, ...rest] = file.split("/");
    skills.set(skill, { ...skills.get(skill), [rest.join("/")]: `${body}\n` });
  }
  return skills;
}

it("has examples for plain steps and for branches", () => {
  expect([...examples().keys()]).toEqual(["plain", "branches"]);
});

it.each([...examples()])("parses the %s example as an explicit flow", (_name, files) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "skill-standard-"));
  roots.push(root);
  for (const [name, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), body);
  }
  const { diagnosis } = parseProcedure({ skillRoot: root, catalog: [], homedir: root });
  expect(diagnosis.confidence).toBe("high");
});

it("shows the same link line the repair plan asks for", () => {
  expect(standard).toContain(WORKFLOW_LINK);
});

it("lists the same conditional words in the standard and the fix prompt", () => {
  const list = CONDITIONAL.source.replace(/^\\b\(|\)\\b$/g, "").split("|").join(", ");
  expect(standard.replace(/\s+/g, " ")).toContain(`whole words gets no edge into or out of it: ${list}.`);
  expect(buildFixPrompt("demo", "Observed.")).toContain(`whole words gets no edge in or out: ${list}.`);
});

it("points the fix prompt at the standard", () => {
  expect(buildFixPrompt("demo", "Observed.")).toContain("docs/skill-standard.md");
});
