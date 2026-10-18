import * as fs from "node:fs";
import * as path from "node:path";
import type { ListItem, NumberedList } from "./procedureLists";

export const DONE_BANNER = "The ordered steps are stated in the source.";
export const WORKFLOW_LINK = "Step order: [references/workflow.md](references/workflow.md)";

const SCRIPT_FILE = /\.(?:sh|bash|ps1|py|mjs|cjs|js|ts)$/i;
const MAX_SCRIPTS = 8;
// Keeps the fix prompt well under the copy limit for large skills.
const MAX_ROWS = 60;
const MAX_CONDITIONS = 12;

/** One numbered instruction of a plan, with optional indented details. */
export interface PlanStep { text: string; sub?: string[] }

export function renderSteps(steps: PlanStep[]): string[] {
  return steps.flatMap((step, index) => [`${String(index + 1)}. ${step.text}`, ...(step.sub ?? []).map((line) => `   ${line}`)]);
}

export interface WorkflowArgs {
  skillName: string;
  skillRoot: string;
  lists: NumberedList[];
  /** Where the lists are, relative to the skill folder. */
  listFile: string;
  /** The workflow file to write, relative to the skill folder, and whether it already exists. */
  target: { file: string; exists: boolean };
  /** Line in SKILL.md after which the link goes, or undefined when SKILL.md already links the file. */
  linkAfter?: number;
}

interface Row { id: string; list: NumberedList; item: ListItem }

export function workflowSteps(args: WorkflowArgs): { steps: PlanStep[]; skeleton: string[] } {
  const rows = assignIds(args.lists);
  const conditional = rows.filter((row) => row.item.condition && !row.list.decision);
  const sources = args.lists.map((list) => `"${list.heading}" (${args.listFile} line ${String(list.line)}): ${rangeOf(rows, list)}`).join("; ");
  const steps: PlanStep[] = [
    { text: writeInstruction(args), sub: [...linkInstruction(args.linkAfter), `Rows come from these numbered lists: ${sources}.`] },
    { text: "Drop a whole list, with its rows and arrows, when it holds rules, principles, pitfalls, output sections or examples instead of actions. Keep a row that is an action, even when it says \"do not\"." },
    { text: `Shorten a row title if you like. Keep each row on one line: id, title, two or more spaces, then what runs the step: "this loop", an agent name, or a script the skill already has${scriptHint(args.skillRoot)}.`, sub: [
      "Ids: the first row is always P. Every other row is N plus a number, optionally with a letter (N1, N12, N2a). No other ids are read. Ids do not need to be consecutive.",
      "A row title never contains -> or →.",
    ] },
    ...branchSteps(rows, conditional, args.lists),
    { text: "Every row must appear in at least one arrow, and every arrow must use ids that exist as rows. Arrow labels may use any words, including if and unless." },
    { text: "If you cannot ask the user (for example in an unattended run), stop and report the question instead of guessing." },
    { text: `Run the checks below, then show the diff and wait for approval. Done when the Flow banner says: "${DONE_BANNER}"` },
  ];
  return { steps, skeleton: skeleton(args, rows) };
}

function writeInstruction(args: WorkflowArgs): string {
  return args.target.exists
    ? `Add the skeleton below, from its first \`\`\` block to the end, at the end of ${args.target.file}. Keep the existing text of that file unchanged.`
    : `Create ${args.target.file} next to SKILL.md with the skeleton below.`;
}

function linkInstruction(after: number | undefined): string[] {
  if (after === undefined) return ["SKILL.md already links this file. Change nothing in SKILL.md."];
  const where = after === 0 ? "at the top of SKILL.md" : `after line ${String(after)} of SKILL.md`;
  return [`Insert two lines ${where}: an empty line, then exactly: ${WORKFLOW_LINK}`, "Agents and Graphtale then read the same order. Change nothing else in SKILL.md."];
}

function branchSteps(rows: Row[], conditional: Row[], lists: NumberedList[]): PlanStep[] {
  const steps: PlanStep[] = [];
  if (conditional.length > 0) {
    steps.push({
      text: "These steps have conditional wording. When the condition decides whether the step runs, write it on the arrow into the step as `<from id> -> <to id> (<condition>)`, and add an arrow around the step (from the step before it to the step after it) with the opposite condition. A condition inside a step, such as a fallback path, gets no label and no extra arrow. If the first row is conditional, add the condition to its title.",
      sub: [
        ...conditional.slice(0, MAX_CONDITIONS).map((row) => `- ${row.id} (step at line ${String(row.item.line)}, condition at line ${String(row.item.conditionLine ?? row.item.line)}): "${row.item.condition ?? ""}"`),
        ...(conditional.length > MAX_CONDITIONS ? [`- and ${String(conditional.length - MAX_CONDITIONS)} more: ${conditional.slice(MAX_CONDITIONS).map((row) => row.id).join(", ")}. Read their text in the skill the same way.`] : []),
      ],
    });
  }
  const special = [...alternatives(rows), ...decisions(rows)];
  if (special.length > 0) steps.push({ text: "Branches already visible in the lists:", sub: special });
  if (lists.length > 1) {
    steps.push({ text: "The lists are not connected yet. Find the sentence in the skill that says how one list leads to another, and add that arrow with a label. When two lists are alternative modes of the whole skill (for example a first run and an incremental run), do not chain them: make P the row that picks the mode, with one labelled arrow to the first row of each. If the skill does not say how lists connect, ask the user. Do not guess." });
  }
  return steps;
}

function alternatives(rows: Row[]): string[] {
  return rows.flatMap((row, index) => {
    const next = rows.at(index + 1);
    if (!next || !siblings(row, next)) return [];
    return [`- ${row.id} and ${next.id} (${row.item.number}, ${next.item.number}) share one step number. If the skill presents them as alternatives, draw an arrow from the step before to each and from each to the step after, labelled with when each applies. If they run one after the other, add ${row.id} -> ${next.id}.`];
  });
}

function decisions(rows: Row[]): string[] {
  return rows.filter((row) => row.list.decision).map((row) => {
    const lines = row.list.items.map((item) => String(item.line)).join(", ");
    return `- ${row.id} is the choice "${row.list.heading}" (questions on lines ${lines}). Draw one labelled arrow from it to the first row of each lane its questions name.`;
  });
}

/** 3a and 3b share step 3: alternatives or sub-steps, so the model decides from the text. */
function siblings(row: Row, next: Row): boolean {
  const a = /^(\d+)[a-z]$/i.exec(row.item.number);
  const b = /^(\d+)[a-z]$/i.exec(next.item.number);
  return a?.[1] !== undefined && a[1] === b?.[1] && row.list === next.list;
}

/** A choice list becomes one row; every other item becomes its own row. */
function assignIds(lists: NumberedList[]): Row[] {
  const entries = lists.flatMap((list) => list.decision
    ? [{ list, item: { number: "", title: list.heading, line: list.line } }]
    : list.items.map((item) => ({ list, item })));
  return entries.map((entry, index) => ({ id: index === 0 ? "P" : `N${String(index)}`, ...entry }));
}

function rangeOf(rows: Row[], list: NumberedList): string {
  const ids = rows.filter((row) => row.list === list).map((row) => row.id);
  return ids.length > 1 ? `${ids[0] ?? ""} to ${ids.at(-1) ?? ""}` : (ids[0] ?? "");
}

/** Two rows in a row of the same list, not alternatives. */
function chains(row: Row, next: Row): boolean {
  return next.list === row.list && !siblings(row, next);
}

/** The heading carries no skill name: a name such as release-notes would hit a skip word and hide the file. */
function skeleton(args: WorkflowArgs, rows: Row[]): string[] {
  const shown = rows.slice(0, MAX_ROWS);
  const arrows = shown.flatMap((row, index) => {
    const next = shown.at(index + 1);
    return next && chains(row, next) ? [`${row.id} -> ${next.id}`] : [];
  });
  const intro = args.target.exists ? [] : [
    "# Workflow",
    "",
    `Step order of [SKILL.md](../SKILL.md) for ${args.skillName}. The rules stay in SKILL.md; this file only states the order.`,
    "",
  ];
  const rest = rows.slice(MAX_ROWS);
  return [
    `Skeleton for ${args.target.file}:`,
    ...(rest.length > 0 ? [`(Shows the first ${String(MAX_ROWS)} of ${String(rows.length)} rows. Add ${rest[0]?.id ?? ""} to ${rest.at(-1)?.id ?? ""} the same way, from line ${String(rest[0]?.item.line ?? 0)} on.)`] : []),
    "",
    ...intro,
    "```",
    ...shown.map((row) => `${row.id.padEnd(4)}${row.item.title.padEnd(32)}  this loop`),
    "```",
    "",
    "## Connections",
    "",
    "```text",
    ...arrows,
    "```",
  ];
}

function scriptHint(skillRoot: string): string {
  const scripts = [...listFiles(skillRoot, ""), ...listFiles(skillRoot, "scripts")].filter((file) => SCRIPT_FILE.test(file)).slice(0, MAX_SCRIPTS);
  return scripts.length > 0 ? ` (this skill has: ${scripts.join(", ")})` : "";
}

function listFiles(root: string, folder: string): string[] {
  try {
    return fs.readdirSync(path.join(root, folder), { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => (folder ? `${folder}/${entry.name}` : entry.name));
  } catch {
    return [];
  }
}
