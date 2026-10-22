import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, expect, it } from "vitest";
import { copyFixPrompt, parseProcedure } from "./parseProcedure";
import { DONE_BANNER, WORKFLOW_LINK } from "./repairPlan";
import { COPY_TEXT_LIMIT } from "./shared/protocol";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function skill(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "repair-plan-"));
  roots.push(root);
  for (const [name, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), body);
  }
  return root;
}

function parse(root: string) {
  return parseProcedure({ skillRoot: root, catalog: [], homedir: root });
}

function copied(root: string): string {
  return copyFixPrompt({ skillRoot: root, catalog: [], homedir: root });
}

function plan(files: Record<string, string>): string {
  return copied(skill(files));
}

const lanes = [
  "---", "name: lanes", "description: Two lanes.", "---", "", "# Lanes", "",
  "## Gate workflow (new art)", "", "1. Stop creating pixels.", "2. Write a handoff.", "   If docs/ is missing, use a temp path.", "3. Wait for sources, then the Integration lane.", "",
  "## Integration workflow", "", "1. Place sources.", "2. Run bake if present.", "3. Run audits.",
].join("\n");

it("names unread lists and their conditional wording in the heading diagnosis", () => {
  const { diagnosis } = parse(skill({ "SKILL.md": lanes }));
  expect(diagnosis.message).toContain('"Gate workflow (new art)" (line 8, 3 items), "Integration workflow" (line 15, 3 items)');
  expect(diagnosis.message).toContain("renaming alone leaves steps without edges");
});

it("plans a new linked workflow file with a prefilled skeleton for conditional lists", () => {
  const prompt = plan({ "SKILL.md": lanes });
  expect(prompt).toContain("1. Create references/workflow.md next to SKILL.md with the skeleton below.");
  expect(prompt).toContain(`Insert two lines after line 6 of SKILL.md: an empty line, then exactly: ${WORKFLOW_LINK}`);
  expect(prompt).toContain('- N1 (step at line 11, condition at line 12): "If docs/ is missing, use a temp path."');
  expect(prompt).toContain("The lists are not connected yet.");
  expect(prompt).toContain("```text\nP -> N1\nN1 -> N2\nN3 -> N4\nN4 -> N5\n```");
  expect(prompt).toContain("Background, only needed if the repair above does not fit. Options:");
});

it("numbers the plan without gaps", () => {
  const prompt = plan({ "SKILL.md": lanes });
  const steps = prompt.slice(prompt.indexOf("Repair (do exactly this):"), prompt.indexOf("Verify before")).match(/^\d+(?=\. )/gm) ?? [];
  expect(steps).toEqual(steps.map((_step, index) => String(index + 1)));
});

it("puts a verifier with the current SKILL.md hash in the plan", () => {
  const root = skill({ "SKILL.md": lanes });
  const hash = createHash("sha256").update(fs.readFileSync(path.join(root, "SKILL.md"))).digest("hex");
  const prompt = copied(root);
  expect(parse(root).diagnosis.fixPrompt).not.toContain("SKILL.md is now");
  expect(prompt).toContain(`SKILL.md is now ${hash}.`);
  expect(prompt).toContain("Copy the prompt again after editing SKILL.md.");
  expect(prompt).toContain(`1. Only allowed changes: SKILL.md differs only by the empty line and the line "${WORKFLOW_LINK}", and references/workflow.md is new.`);
  expect(prompt).toContain("4. Same meaning:");
});

it("reaches an explicit flow when the planned file and link are written", () => {
  const text = ["# One", "", "## Process", "", "1. Plan the work.", "2. Build if approved.", "3. Ship."].join("\n");
  const root = skill({ "SKILL.md": text });
  expect(copied(root)).toContain("Create references/workflow.md");
  const workflow = ["# Workflow", "", "```", "P   Plan the work      this loop", "N1  Build              this loop", "N2  Ship               this loop", "```", "", "## Connections", "", "```text", "P -> N1 (approved)", "P -> N2 (not approved)", "N1 -> N2", "```"].join("\n");
  fs.writeFileSync(path.join(root, "SKILL.md"), text.replace("# One", `# One\n\n${WORKFLOW_LINK}`));
  fs.mkdirSync(path.join(root, "references"));
  fs.writeFileSync(path.join(root, "references", "workflow.md"), workflow);
  const { diagnosis } = parse(root);
  expect(diagnosis.confidence).toBe("high");
  expect(diagnosis.message).toContain(DONE_BANNER);
});

it("adds to an existing linked workflow file instead of creating one", () => {
  const prompt = plan({
    "SKILL.md": ["# Linked", "", WORKFLOW_LINK, "", "Rules."].join("\n"),
    "references/workflow.md": ["# Workflow", "", "## Gate", "", "1. Stop.", "2. Hand off if asked."].join("\n"),
  });
  expect(prompt).toContain("1. Add the skeleton below, from its first ``` block to the end, at the end of references/workflow.md. Keep the existing text of that file unchanged.");
  expect(prompt).toContain("SKILL.md already links this file. Change nothing in SKILL.md.");
  expect(prompt).toContain('"Gate" (references/workflow.md line 3)');
  expect(prompt).toContain("SKILL.md is unchanged, and references/workflow.md differs only by the block added at its end");
});

it("plans a heading rename for one plain list under an unrecognized heading", () => {
  const prompt = plan({ "SKILL.md": ["# Plain", "", "## Werkwijze", "", "1. Lees.", "2. Schrijf."].join("\n") });
  expect(prompt).toContain("1. In SKILL.md, change line 3 from `## Werkwijze` to `## Workflow: Werkwijze`. Change nothing else.");
  expect(prompt).toContain('Add "Werkwijze" to "steps" for that language in the languages file instead');
  expect(prompt).toContain("SKILL.md differs only on line 3, and only in its heading text");
});

it("quotes the heading exactly as written", () => {
  const prompt = plan({ "SKILL.md": ["# Plain", "", "## Process `fast` **now**", "", "1. Plan.", "2. Build."].join("\n") });
  expect(prompt).toContain("from `## Process `fast` **now**` to `## Workflow: Process `fast` **now**`");
});

it("leaves 3a and 3b unchained and asks how they relate", () => {
  const text = ["# Routes", "", "## 1. Prepare", "", "Read.", "", "## 3a. Form route", "", "Open the form.", "", "## 3b. API route", "", "Call the API if asked.", "", "## 4. Report", "", "Tell the user."].join("\n");
  const prompt = plan({ "SKILL.md": text });
  expect(prompt).toContain("- N1 and N2 (3a, 3b) share one step number. If the skill presents them as alternatives");
  expect(prompt).toContain("```text\nP -> N1\nN2 -> N3\n```");
});

it("turns a list of questions into one choice row without arrows in its title", () => {
  const text = ["# Tree", "", "## Decision tree", "", "1. Sources exist? → Integration.", "2. New art? → Gate.", "", "## Gate workflow", "", "1. Stop.", "2. Hand off if asked."].join("\n");
  const prompt = plan({ "SKILL.md": text });
  expect(prompt).toContain('- P is the choice "Decision tree" (questions on lines 5, 6).');
  expect(prompt).toContain("P   Decision tree ");
  const skeleton = prompt.slice(prompt.indexOf("Skeleton for"));
  const rows = skeleton.slice(skeleton.indexOf("```\n") + 4, skeleton.indexOf("\n```", skeleton.indexOf("```\n") + 4));
  expect(rows).not.toMatch(/->|→/);
});

it("tells Flow's warning apart from a missing order", () => {
  const root = skill({ "SKILL.md": ["# Fine", "", "## Workflow", "", "1. Plan.", "2. Build."].join("\n"), ".graphtale/languages.json": "{ broken" });
  const { diagnosis } = parse(root);
  expect(diagnosis.confidence).toBe("partial");
  const prompt = copied(root);
  expect(prompt).toContain("1. Flow already reads an explicit step order. Do not restructure the skill.");
  expect(prompt).not.toContain("Create references/workflow.md");
  expect(diagnosis.fixPrompt).not.toContain("Repair (do exactly this):");
});

it("repairs P/N rows in the file that holds them", () => {
  const text = ["# Workflow", "", "```", "P   start     this loop", "N1  middle    this loop", "N2  end       this loop", "```", "", "```text", "P -> N1", "```"].join("\n");
  const prompt = plan({ "SKILL.md": text });
  expect(prompt).toContain("1. Open SKILL.md. Flow reads its rows but not every row is connected.");
  expect(prompt).toContain("1. Only allowed changes: only SKILL.md changed, and only its rows and arrows.");
});

it("says a skip word in the title hides the skill instead of claiming no steps", () => {
  const prompt = plan({ "SKILL.md": ["# Release notes", "", "## Process", "", "1. Collect.", "2. Write."].join("\n") });
  expect(prompt).toContain("1. The # title on line 1 of SKILL.md, `# Release notes`, contains a word Flow treats as a section to skip");
  expect(prompt).not.toContain("has no numbered steps");
});

it("puts the link at the top when SKILL.md has no title or frontmatter", () => {
  const prompt = plan({ "SKILL.md": ["## Process", "", "1. Plan.", "2. Build if approved."].join("\n") });
  expect(prompt).toContain(`Insert two lines at the top of SKILL.md: an empty line, then exactly: ${WORKFLOW_LINK}`);
});

it("ignores a # line inside a code fence when placing the link", () => {
  const prompt = plan({ "SKILL.md": ["```bash", "# not a title", "```", "", "# Real title", "", "## Process", "", "1. Plan.", "2. Build if approved."].join("\n") });
  expect(prompt).toContain("Insert two lines after line 5 of SKILL.md");
});

it("keeps line numbers right for CRLF files", () => {
  const prompt = plan({ "SKILL.md": lanes.replace(/\n/g, "\r\n") });
  expect(prompt).toContain("Insert two lines after line 6 of SKILL.md");
  expect(prompt).toContain("- N1 (step at line 11, condition at line 12)");
});

it("asks whether a prose skill has an order and verifies only if it edits", () => {
  const prompt = plan({ "SKILL.md": ["# Mode", "", "## Rules", "", "Be brief.", "", "## Persistence", "", "Stay on."].join("\n") });
  expect(prompt).toContain("2. Ask the user one question: does this skill run its parts in a fixed order?");
  expect(prompt).toContain("If you edit anything, verify before you show the diff:");
});

it("keeps a router a valid shape and offers its lists only on request", () => {
  const text = ["# Router", "", "| Verb | File |", "| --- | --- |", "| day | [day](recipes/day.md) |", "| week | [week](recipes/week.md) |", "", "## Limits", "", "1. Never send mail.", "2. Never delete."].join("\n");
  const prompt = plan({ "SKILL.md": text, "recipes/day.md": "Day.", "recipes/week.md": "Week." });
  expect(prompt).toContain("The skill routes to separate files. That is a valid shape");
  expect(prompt).toContain('ask whether one of these numbered lists is that order: "Limits" (SKILL.md line 8)');
});

it("names scripts the skill already has as runners", () => {
  const prompt = plan({ "SKILL.md": lanes, "create-pr.sh": "echo", "scripts/bake.mjs": "" });
  expect(prompt).toContain("(this skill has: create-pr.sh, scripts/bake.mjs)");
});

it("adds no plan when Flow is already explicit", () => {
  const prompt = plan({ "SKILL.md": ["# Fine", "", "## Workflow", "", "1. Plan.", "2. Build."].join("\n") });
  expect(prompt).not.toContain("Repair (do exactly this):");
});

it("fixes the step Flow read instead of a skip word in the SKILL.md title", () => {
  const prompt = plan({
    "SKILL.md": ["# API Reference helper", "", WORKFLOW_LINK].join("\n"),
    "references/workflow.md": ["## Workflow", "", "1. Read.", "2. If empty, stop.", "3. Write."].join("\n"),
  });
  expect(prompt).not.toContain("The # title on line");
  expect(prompt).toContain("Add the skeleton below");
});

it("plans from a numbered list that comes before any heading", () => {
  const prompt = plan({ "SKILL.md": ["---", "name: top", "description: Top list.", "---", "1. Read the file.", "2. If it is empty, stop.", "3. Write output."].join("\n") });
  expect(prompt).not.toContain("has no numbered steps");
  expect(prompt).toContain('"the top of the file" (SKILL.md line 5): P to N2');
});

it("names Step-numbered headings instead of asking to rename a recognized heading", () => {
  const { diagnosis } = parse(skill({ "SKILL.md": ["# Steps", "", "## Workflow", "", "### Step 1: Read", "", "Read it.", "", "### Step 2: Write", "", "Write it."].join("\n") }));
  expect(diagnosis.message).toContain('numbers headings as "Step 1:" or "Phase 1:" under "Workflow" (from line 5, 2 steps)');
  expect(diagnosis.message).not.toContain("A step heading must start with a recognized name");
});

it("does not count a list introduced as an example", () => {
  const { diagnosis } = parse(skill({ "SKILL.md": ["# Ex", "", "## Notes on use", "", "Text.", "", "## Usage tips", "", "For example:", "1. Read.", "2. Write."].join("\n") }));
  expect(diagnosis.message).not.toContain("numbered lists under headings");
});

it("keeps every numbered heading, even one with a skip word", () => {
  const text = ["# Pick", "", "## Process", "", "### 1. Read", "", "Read.", "", "### 2. Pick options", "", "Pick if needed.", "", "### 3. Write", "", "Write.", "", "### 4. Ship", "", "Ship."].join("\n");
  const prompt = plan({ "SKILL.md": text });
  expect(prompt).toContain('"Process" (SKILL.md line 3): P to N3');
  expect(prompt).toContain("N1  Pick options ");
});

it("offers a router only plain lists to rename", () => {
  const text = ["# Router", "", "| Verb | File |", "| --- | --- |", "| day | [day](recipes/day.md) |", "| week | [week](recipes/week.md) |", "", "## Release", "", "### Step 1: Tag", "", "Tag it.", "", "### Step 2: Publish", "", "Publish it."].join("\n");
  const prompt = plan({ "SKILL.md": text, "recipes/day.md": "Day.", "recipes/week.md": "Week." });
  expect(prompt).toContain("If yes: ask the user for the order, then follow docs/skill-standard.md");
  expect(prompt).not.toContain('"Release" (SKILL.md');
});

it("keeps the fix prompt under the copy limit for a large skill", () => {
  const sections = Array.from({ length: 30 }, (_value, s) => [`## Part ${String(s)} process`, "", ...Array.from({ length: 25 }, (_v, i) => `${String(i + 1)}. Do item ${String(i)} of part ${String(s)} if the earlier item has finished and the data is valid.`), ""].join("\n"));
  const prompt = plan({ "SKILL.md": ["# Big", "", ...sections].join("\n") });
  expect(prompt.length).toBeLessThanOrEqual(COPY_TEXT_LIMIT);
  expect(prompt).toContain("Shows the first 60 of");
});

it("has the model back up the real skill folder outside every skills folder before editing", () => {
  const root = skill({ "SKILL.md": lanes });
  const prompt = copied(root);
  const folder = fs.realpathSync(root);
  const target = path.join(root, ".graphtale", "backups", "lanes");
  expect(prompt).toContain("Backup (make it yourself before you change any file; do not ask the user to do it):");
  expect(prompt).toContain(`mkdir -p '${target}' && cp -R '${folder}' '${target}'/$(date +%Y%m%d-%H%M%S)`);
  expect(prompt).toContain(`Copy-Item -Recurse '${folder}'`);
  expect(prompt).toContain("Never put the backup inside a skills folder or the skill itself.");
  expect(prompt.indexOf("Backup (make it yourself")).toBeLessThan(prompt.indexOf("Repair (do exactly this):"));
});

it("gives the backup folder a name that is safe on every platform", () => {
  const prompt = plan({ "SKILL.md": ["---", "name: My Skill (v2)!", "description: Spaces.", "---", "", "# Odd", "", "## Process", "", "1. Plan.", "2. Build if ready."].join("\n") });
  expect(prompt).toContain(path.join(".graphtale", "backups", "my-skill-v2"));
});
