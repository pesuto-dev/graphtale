import { expect, it } from "vitest";
import { ENGLISH } from "./procedureVocabulary";
import { conditionalWord, scanGroups } from "./procedureScan";

it("reads a numbered list under a workflow heading", () => {
  const groups = scanGroups("## Workflow\n1. Read the file.\n2. Write the file.\n", "SKILL.md", ENGLISH);
  expect(groups).toHaveLength(1);
  expect(groups[0]?.kind).toBe("numbered list");
  expect(groups[0]?.steps.map((step) => step.title)).toEqual(["Read the file.", "Write the file."]);
});

it("skips a numbered list under Notes", () => {
  expect(scanGroups("## Notes\n1. An aside.\n", "SKILL.md", ENGLISH)).toEqual([]);
});

it("reads a list under any heading when every section is requested", () => {
  const groups = scanGroups("## Custom\n1. Do the work.\n", "SKILL.md", ENGLISH, { everySection: true });
  expect(groups[0]?.steps[0]?.title).toBe("Do the work.");
});

it("reads Step headings only when that scan is requested", () => {
  const text = "## Workflow\n### Step 1: Read\n### Step 2: Write\n";
  expect(scanGroups(text, "SKILL.md", ENGLISH)).toEqual([]);
  const groups = scanGroups(text, "SKILL.md", ENGLISH, { stepHeadings: true });
  expect(groups[0]?.stepLike).toBe(true);
  expect(groups[0]?.steps.map((step) => step.display)).toEqual(["1", "2"]);
});

it("names the conditional word and the line it is on", () => {
  const groups = scanGroups("## Workflow\n1. Stop if empty.\n", "SKILL.md", ENGLISH);
  expect(groups).toHaveLength(1);
  expect(conditionalWord(groups[0].steps[0])).toEqual({ word: "if", line: 2 });
});
