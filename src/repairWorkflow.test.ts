import { expect, it } from "vitest";
import type { NumberedList } from "./procedureLists";
import { DONE_BANNER, WORKFLOW_LINK, renderSteps, workflowSteps } from "./repairWorkflow";

function lists(): NumberedList[] {
  return [{
    heading: "Process",
    raw: "Process",
    line: 3,
    level: 2,
    recognized: false,
    fromHeadings: false,
    stepLike: false,
    read: false,
    decision: false,
    items: [
      { number: "1", title: "Read the file.", line: 5 },
      { number: "2", title: "Write if asked.", line: 6, condition: "if asked", conditionLine: 6 },
    ],
  }];
}

function planned(exists: boolean, linkAfter: number | undefined): { steps: string; skeleton: string } {
  const { steps, skeleton } = workflowSteps({
    skillName: "demo",
    skillRoot: "/missing-skill-root",
    lists: lists(),
    listFile: "SKILL.md",
    target: { file: "references/workflow.md", exists },
    ...(linkAfter === undefined ? {} : { linkAfter }),
  });
  return { steps: renderSteps(steps).join("\n"), skeleton: skeleton.join("\n") };
}

it("numbers a step and indents its detail", () => {
  expect(renderSteps([{ text: "Do the work.", sub: ["Keep the meaning."] }])).toEqual([
    "1. Do the work.",
    "   Keep the meaning.",
  ]);
});

it("asks for a new workflow file and a link after the title", () => {
  const { steps, skeleton } = planned(false, 4);
  expect(steps).toContain("1. Create references/workflow.md next to SKILL.md with the skeleton below.");
  expect(steps).toContain(`Insert two lines after line 4 of SKILL.md: an empty line, then exactly: ${WORKFLOW_LINK}`);
  expect(steps).toContain(`Done when the Flow banner says: "${DONE_BANNER}"`);
  expect(skeleton).toContain("P   Read the file.");
  expect(skeleton).toContain("P -> N1");
});

it("appends to an existing workflow and leaves SKILL.md when it already links", () => {
  const { steps } = planned(true, undefined);
  expect(steps).toContain("Add the skeleton below, from its first ``` block to the end, at the end of references/workflow.md.");
  expect(steps).toContain("SKILL.md already links this file. Change nothing in SKILL.md.");
});

it("names a conditional step and its line", () => {
  const { steps } = planned(false, 1);
  expect(steps).toContain('- N1 (step at line 6, condition at line 6): "if asked"');
});
