import { expect, it } from "vitest";
import { numberedLists } from "./procedureLists";
import { ENGLISH } from "./procedureVocabulary";

it("finds numbered lists under any heading with their source lines", () => {
  const text = ["# Skill", "", "## Gate workflow", "", "1. Stop.", "2. Write the handoff."].join("\n");
  const [list] = numberedLists(text, ENGLISH);
  expect(list).toMatchObject({ heading: "Gate workflow", line: 3, level: 2, recognized: false, fromHeadings: false });
  expect(list.items.map((item) => [item.number, item.title, item.line])).toEqual([["1", "Stop", 5], ["2", "Write the handoff", 6]]);
});

it("records the first conditional line of an item", () => {
  const text = ["## Workflow", "", "1. Write the handoff.", "   If docs/ is missing, use a temp path.", "2. Wait."].join("\n");
  const [list] = numberedLists(text, ENGLISH);
  expect(list.recognized).toBe(true);
  expect(list.items[0]).toMatchObject({ condition: "If docs/ is missing, use a temp path.", conditionLine: 4 });
  expect(list.items[1]?.condition).toBeUndefined();
});

it("reads numbered and Step N headings as one list named after their parent", () => {
  const text = ["## Before you start", "", "### Step 1: Gather", "", "1. Ask for the port.", "2. Ask for the user.", "", "### Step 2: Detect", "", "Check the folder."].join("\n");
  const lists = numberedLists(text, ENGLISH);
  expect(lists).toHaveLength(1);
  expect(lists[0]).toMatchObject({ heading: "Before you start", fromHeadings: true });
  expect(lists[0]?.items.map((item) => item.title)).toEqual(["Gather", "Detect"]);
});

it("skips lists under skip sections", () => {
  const text = ["## Examples", "", "1. One.", "2. Two."].join("\n");
  expect(numberedLists(text, ENGLISH)).toEqual([]);
});

it("marks a list of questions as a decision", () => {
  const text = ["## Decision tree", "", "1. Sources exist? → Integration.", "2. New art needed? → Gate."].join("\n");
  expect(numberedLists(text, ENGLISH)[0]?.decision).toBe(true);
});
