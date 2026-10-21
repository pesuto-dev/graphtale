import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { numberedLists, skipTitle, titleLine, type NumberedList } from "./procedureLists";
import type { Vocabulary } from "./procedureVocabulary";
import { backupSteps } from "./repairBackup";
import { ownershipFacts } from "./repairOwnership";
import { DONE_BANNER, WORKFLOW_LINK, renderSteps, workflowSteps, type PlanStep } from "./repairWorkflow";
import type { CatalogSkill } from "./shared/protocol";
import { linkHrefs } from "./text";

export { DONE_BANNER, WORKFLOW_LINK } from "./repairWorkflow";

/** What produced the diagnosis, so the plan targets the file Flow actually read. */
export interface RepairOrigin {
  shape: "steps" | "pn" | "router" | "headings" | "linked" | "none";
  /** Absolute path of the file Flow read. */
  sourcePath: string;
  sourceText: string;
  /** Flow read an explicit order; only warnings keep it partial. */
  explicit: boolean;
  /** The diagnosis names what is wrong (P/N findings). */
  named: boolean;
  /** Step lists of the source file when the caller already scanned it. */
  lists?: NumberedList[];
}

/** The plan, and a shorter one without the skeleton for prompts that would pass the copy limit. */
export interface RepairPlanText { full: string; compact: string }

export interface RepairInput {
  skillName: string;
  skillRoot: string;
  skillFile: string;
  skillText: string;
  vocabulary: Vocabulary;
  catalog: CatalogSkill[];
  homedir: string;
  origin: RepairOrigin;
  /** An existing workflow.md among the instruction files, absolute. */
  workflowFile?: string;
}

type Change =
  | { kind: "none" }
  | { kind: "line"; file: string; line: number }
  | { kind: "workflow"; target: string; exists: boolean; link: boolean; listFile: string }
  | { kind: "pn"; file: string }
  | { kind: "agreed" };

interface Recipe { steps: PlanStep[]; after?: string[]; change: Change }

/**
 * One concrete repair for this skill, so any model can follow it without exploring.
 * docs/skill-standard.md is the structure it repairs towards.
 */
export function repairPlan(input: RepairInput): RepairPlanText {
  const facts = ownershipFacts(input);
  const recipe = chooseRecipe(input);
  const check = verifier(input, recipe.change);
  const body = [
    ...facts, ...(facts.length > 0 ? [""] : []),
    ...backupSteps(input), "",
    "Repair (do exactly this):",
    ...renderSteps(recipe.steps),
    ...(check.length > 0 ? ["", ...check] : []),
  ];
  const skeleton = recipe.after ?? [];
  const compact = skeleton.length > 0 ? [...body, "", "The skeleton is left out because this skill is large. Write one row per step from the lists named above, in the format the checks describe."] : body;
  return { full: [...body, ...(skeleton.length > 0 ? ["", ...skeleton] : [])].join("\n"), compact: compact.join("\n") };
}

function chooseRecipe(input: RepairInput): Recipe {
  const { origin } = input;
  if (origin.explicit) return warningRecipe();
  if (origin.shape === "pn") return pnRecipe(relative(input, origin.sourcePath), origin.named);
  const hidden = origin.shape === "steps" || origin.shape === "router" ? undefined : hidingTitle(input);
  if (hidden) return titleRecipe(hidden);
  const { lists, file } = listsFor(input);
  if (origin.shape === "router") return routerRecipe(lists, file);
  if (lists.length === 0) return askRecipe("The skill has no numbered steps. It may be a reference or a mode skill, which has no order.");
  const single = renameCandidate(lists);
  return single ? renameRecipe(single, file) : workflowRecipe(input, lists, file);
}

function warningRecipe(): Recipe {
  return { change: { kind: "none" }, steps: [
    { text: "Flow already reads an explicit step order. Do not restructure the skill." },
    { text: "Fix only the warning in Observed and Also observed, for example the languages file, the frontmatter, or a file Flow could not read." },
    { text: "Show the diff and wait for approval. Done when the warning no longer appears in the Flow banner." },
  ] };
}

function pnRecipe(file: string, named: boolean): Recipe {
  const fix = named
    ? `Open ${file}. Fix only the rows and arrows named under Observed. Do not add or remove steps.`
    : `Open ${file}. Flow reads its rows but not every row is connected. Add the arrows the skill's text states, so every row appears in at least one arrow. Where the text does not say, ask the user. Do not add or remove steps.`;
  return { change: { kind: "pn", file }, steps: [
    { text: fix },
    { text: `Run the checks below, then show the diff and wait for approval. Done when the Flow banner says: "${DONE_BANNER}"` },
  ] };
}

interface HidingTitle { file: string; line: number; title: string }

/** A skip word in the # title of the file Flow read, or of SKILL.md, hides the steps under it. */
function hidingTitle(input: RepairInput): HidingTitle | undefined {
  for (const [file, text] of [[input.origin.sourcePath, input.origin.sourceText], [input.skillFile, input.skillText]]) {
    const found = skipTitle(text, input.vocabulary);
    if (found) return { file: relative(input, file), ...found };
  }
  return undefined;
}

function titleRecipe(hidden: HidingTitle): Recipe {
  return { change: { kind: "line", file: hidden.file, line: hidden.line }, steps: [
    { text: `The # title on line ${String(hidden.line)} of ${hidden.file}, \`# ${hidden.title}\`, contains a word Flow treats as a section to skip (Examples, Alternatives, Options, Appendix, Notes, Reference or Choices). Flow then ignores the whole file. This is a Flow limitation, not a fault in the skill.` },
    { text: "Ask the user whether to retitle it without that word. If yes: change only that line, run the checks below, show the diff, and after approval copy the new fix prompt for the rest. If no: change nothing." },
  ] };
}

function askRecipe(shape: string, ifYes = "If yes: ask the user for the order, then follow docs/skill-standard.md: references/workflow.md with P/N rows, linked from SKILL.md. Do not guess the order from the headings."): Recipe {
  return { change: { kind: "agreed" }, steps: [
    { text: shape },
    { text: "Ask the user one question: does this skill run its parts in a fixed order?" },
    { text: "If no: change nothing. Tell the user the banner is informational for this skill." },
    { text: ifYes },
  ] };
}

function routerRecipe(lists: NumberedList[], file: string): Recipe {
  const shape = "The skill routes to separate files. That is a valid shape: each route is its own branch.";
  const plain = lists.filter((list) => !list.fromHeadings && !list.stepLike && list.level > 0);
  if (plain.length === 0) return askRecipe(shape);
  const named = plain.map((list) => `"${list.raw}" (${file} line ${String(list.line)})`).join(", ");
  return askRecipe(shape, `If yes: ask whether one of these numbered lists is that order: ${named}. If it is, change only its heading so it starts with "Workflow: ". Otherwise ask the user for the order. Do not guess it.`);
}

function renameRecipe(list: NumberedList, file: string): Recipe {
  const level = "#".repeat(list.level);
  return { change: { kind: "line", file, line: list.line }, steps: [
    { text: `In ${file}, change line ${String(list.line)} from \`${level} ${list.raw}\` to \`${level} Workflow: ${list.raw}\`. Change nothing else.`, sub: [
      `If that heading is not English and the user wants to keep it, do not edit the skill. Add "${list.raw}" to "steps" for that language in the languages file instead (format under option B).`,
    ] },
    { text: `Run the checks below, then show the diff and wait for approval. Done when the Flow banner says: "${DONE_BANNER}"` },
  ] };
}

function workflowRecipe(input: RepairInput, lists: NumberedList[], listFile: string): Recipe {
  const target = input.workflowFile ? relative(input, input.workflowFile) : "references/workflow.md";
  const exists = input.workflowFile !== undefined;
  const link = !linkHrefs(input.skillText).some((href) => href.split("#")[0].toLowerCase().endsWith("workflow.md"));
  const { steps, skeleton } = workflowSteps({
    skillName: input.skillName,
    skillRoot: input.skillRoot,
    lists,
    listFile,
    target: { file: target, exists },
    linkAfter: link ? titleLine(input.skillText, input.vocabulary) : undefined,
  });
  return { steps, after: skeleton, change: { kind: "workflow", target, exists, link, listFile } };
}

/** Lists from the file Flow read, falling back to SKILL.md when that file has none. */
function listsFor(input: RepairInput): { lists: NumberedList[]; file: string } {
  const { origin } = input;
  if (origin.lists && origin.lists.length > 0) return { lists: origin.lists, file: relative(input, origin.sourcePath) };
  const fromSource = origin.sourcePath === input.skillFile ? [] : numberedLists(origin.sourceText, input.vocabulary);
  if (fromSource.length > 0) return { lists: fromSource, file: relative(input, origin.sourcePath) };
  return { lists: numberedLists(input.skillText, input.vocabulary), file: "SKILL.md" };
}

/** One plain list under an unrecognized heading only needs that heading renamed. */
function renameCandidate(lists: NumberedList[]): NumberedList | undefined {
  const single = lists.length === 1 ? lists[0] : undefined;
  if (!single || single.read || single.recognized || single.fromHeadings || single.stepLike || single.level === 0) return undefined;
  return single.items.some((item) => item.condition) ? undefined : single;
}

function relative(input: RepairInput, file: string): string {
  return path.relative(input.skillRoot, file).split(path.sep).join("/");
}

const PN_CHECKS = [
  "Format: rows only inside a plain ``` block, arrows only inside a ```text block under ## Connections. No other line starts with P or N followed by a space or a number; put explanations in your reply, not in the file. No row title contains -> or →.",
  "Ids: the first row is P, the others N<number> with an optional letter, each id used once. Every arrow uses ids that exist as rows, and every row appears in at least one arrow.",
];

/** Checks the repairing model runs on its own result; a second agent may run them independently. */
function verifier(input: RepairInput, change: Change): string[] {
  if (change.kind === "none") return [];
  return [
    change.kind === "agreed" ? "If you edit anything, verify before you show the diff:" : "Verify before you show the diff. Run every check; if one fails, fix it and run all checks again.",
    "If you can start a second agent or reviewer, let it run these checks on your result independently.",
    `0. Before you edit, record the SHA-256 of every file in the skill folder (macOS/Linux: shasum -a 256 <file>; Windows: Get-FileHash <file>). SKILL.md is now ${fileHash(input.skillFile) ?? "(unreadable)"}.`,
    ...changeChecks(change),
  ];
}

function changeChecks(change: Exclude<Change, { kind: "none" }>): string[] {
  const trace = (file: string): string => `Same meaning: in your reply, give for each row and each arrow label the line in ${file} it comes from. Remove anything you cannot trace to a line: that is new work, and agents would now follow it.`;
  const pn = PN_CHECKS.map((check, index) => `${String(index + 2)}. ${check}`);
  switch (change.kind) {
    case "line":
      return [`1. Only allowed changes: ${change.file} differs only on line ${String(change.line)}, and only in its heading text. If you used the languages file instead, no file in the skill folder changed. Every other file still has its recorded hash.`];
    case "agreed":
      return ["1. Only the changes the user agreed to; every other file still has its recorded hash.", `2. ${trace("the skill")}`];
    case "pn":
      return [`1. Only allowed changes: only ${change.file} changed, and only its rows and arrows.`, ...pn, `4. ${trace("the skill")}`];
    case "workflow":
      return [`1. Only allowed changes: ${workflowAllowed(change)}. Every other file still has its recorded hash. Show this with a diff.`, ...pn, `4. ${trace(change.listFile)}`];
  }
}

function workflowAllowed(change: Extract<Change, { kind: "workflow" }>): string {
  const skill = change.link ? `SKILL.md differs only by the empty line and the line "${WORKFLOW_LINK}"` : "SKILL.md is unchanged";
  const target = change.exists ? `${change.target} differs only by the block added at its end` : `${change.target} is new`;
  return `${skill}, and ${target}`;
}

function fileHash(file: string): string | undefined {
  try {
    return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  } catch {
    return undefined;
  }
}
