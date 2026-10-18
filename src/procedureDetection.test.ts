import { expect, it } from "vitest";
import { detectSteps } from "./procedureDetection";

const conditional = [
  "## Workflow",
  "",
  "1. Read the ticket.",
  "2. Run bake if present.",
  "3. Report.",
].join("\n");

it("names the conditional step, its line and the word that blocks its edges", () => {
  const found = detectSteps(conditional, "SKILL.md");
  expect(found?.relationships).toBe("unresolved");
  expect(found?.findings).toEqual(['Conditional wording gives these steps no edge in or out: step 2 (line 4, "if").']);
});

it("names the line of a conditional word inside a step body", () => {
  const text = ["## Workflow", "", "1. Read the ticket.", "   Stop if it is empty.", "2. Report."].join("\n");
  expect(detectSteps(text, "SKILL.md")?.findings).toEqual(['Conditional wording gives these steps no edge in or out: step 1 (line 4, "if").']);
});

it("names separate step lists that Flow does not connect", () => {
  const text = ["## Workflow", "", "1. Plan.", "2. Build.", "", "## Steps", "", "1. Test.", "2. Ship."].join("\n");
  const found = detectSteps(text, "SKILL.md");
  expect(found?.relationships).toBe("unresolved");
  expect(found?.findings).toEqual(["2 separate step lists (line 3, line 8); Flow does not connect them."]);
});

it("keeps findings empty for a plain ordered list", () => {
  const text = ["## Workflow", "", "1. Plan.", "2. Build."].join("\n");
  const found = detectSteps(text, "SKILL.md");
  expect(found?.relationships).toBe("explicit");
  expect(found?.findings).toEqual([]);
});

it("names at most four conditional steps", () => {
  const items = [1, 2, 3, 4, 5, 6].map((n) => `${String(n)}. Do ${String(n)} if needed.`);
  const finding = detectSteps(["## Workflow", "", ...items].join("\n"), "SKILL.md")?.findings?.[0] ?? "";
  expect(finding).toMatch(/step 4 \(line 6, "if"\) and 2 more\.$/);
});
