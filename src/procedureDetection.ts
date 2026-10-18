import { extractPn } from "./procedurePn";
import { HEADING, popParentsAtOrAbove, visibleLines } from "./procedureLines";
import { CONDITIONAL } from "./procedureLists";
import { ENGLISH, type Vocabulary } from "./procedureVocabulary";
import type { SourceRange } from "./shared/protocol";

const MAX_NAMED_STEPS = 4;

export interface DetectedStep { display: string; title: string; body: string; source: SourceRange; resource?: string }
export interface DetectedLink { from: number; to: number; label?: string; source: SourceRange }
export interface Detection {
  steps: DetectedStep[];
  links: DetectedLink[];
  relationships: "explicit" | "unresolved";
  sourceKind: "numbered headings" | "numbered list" | "P/N rows";
  /** Named reasons a flow is partial. Empty when every drawn edge is explicit. */
  findings?: string[];
}

const NUMBERED = /^(\d+[a-z]?)\.\s+(.+)$/i;
const LIST_ITEM = /^(\d+[a-z]?)\.\s+(.*\S)\s*$/i;

interface StepGroup { steps: DetectedStep[]; kind: Detection["sourceKind"]; ambiguous?: boolean }
interface NumberedScan {
  sourcePath: string;
  original: string[];
  groups: StepGroup[];
  parents: { level: number; excluded: boolean }[];
  active: boolean;
  context: string;
  group?: StepGroup;
  headingLevel?: number;
  vocabulary: Vocabulary;
}

export function detectSteps(text: string, sourcePath: string, vocabulary: Vocabulary = ENGLISH): Detection | undefined {
  const lines = visibleLines(text, false, vocabulary);
  const scan: NumberedScan = {
    sourcePath,
    original: text.split(/\r?\n/),
    groups: [],
    parents: [],
    active: true,
    context: "",
    vocabulary,
  };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines.at(index) ?? "";
    const heading = HEADING.exec(line);
    if (heading) takeHeading(scan, index, heading);
    else takeListLine(scan, index, line);
  }
  finishOpenStep(scan, lines.length);
  const usable = scan.groups.filter(group => group.steps.length > 0);
  return usable.length > 0 ? detectionFromGroups(usable) : extractPn(text, sourcePath, vocabulary);
}

function finishOpenStep(scan: NumberedScan, end: number): void {
  const last = scan.group?.steps.at(-1);
  if (!last) return;
  last.source.endLine = Math.max(last.source.startLine, end);
  last.body = scan.original.slice(last.source.startLine - 1, last.source.endLine).join("\n").trim();
}

function takeHeading(scan: NumberedScan, index: number, heading: RegExpMatchArray): void {
  const level = heading[1].length;
  const title = heading[2];
  scan.context = "";
  popParentsAtOrAbove(scan.parents, level);
  const instruction = level >= 2 ? NUMBERED.exec(title) : null;
  const excluded = headingExcluded(instruction, title, scan);
  scan.parents.push({ level, excluded });
  if (keepsNestedHeading(scan, level)) return;
  finishOpenStep(scan, index);
  const numbered = excluded ? null : instruction;
  if (!numbered) {
    scan.group = undefined;
    scan.headingLevel = undefined;
    scan.active = !excluded && scan.vocabulary.isStepSection(title);
    return;
  }
  const group = numberedGroup(scan, level);
  scan.headingLevel = level;
  group.steps.push({
    display: numbered[1],
    title: numbered[2],
    body: "",
    source: { path: scan.sourcePath, startLine: index + 1, endLine: index + 1 },
  });
}

function headingExcluded(instruction: RegExpMatchArray | null, title: string, scan: NumberedScan): boolean {
  return (!instruction && scan.vocabulary.isSkipSection(title)) || scan.parents.some(parent => parent.excluded);
}

function keepsNestedHeading(scan: NumberedScan, level: number): boolean {
  return scan.group?.kind === "numbered headings" && scan.headingLevel !== undefined && level > scan.headingLevel;
}

function numberedGroup(scan: NumberedScan, level: number): StepGroup {
  const current = scan.group;
  if (current?.kind === "numbered headings" && scan.headingLevel === level) return current;
  const group: StepGroup = { steps: [], kind: "numbered headings" };
  scan.groups.push(group);
  scan.group = group;
  return group;
}

function takeListLine(scan: NumberedScan, index: number, line: string): void {
  if (!scan.active || scan.group?.kind === "numbered headings" || scan.parents.some(parent => parent.excluded)) return;
  const item = LIST_ITEM.exec(line);
  if (!item) {
    notePlainLine(scan, index, line);
    return;
  }
  finishOpenStep(scan, index);
  const group = scan.group ?? openListGroup(scan);
  group.steps.push({
    display: item[1],
    title: item[2],
    body: "",
    source: { path: scan.sourcePath, startLine: index + 1, endLine: index + 1 },
  });
}

function notePlainLine(scan: NumberedScan, index: number, line: string): void {
  scan.context += `\n${line}`;
  if (!/\b(?:for example|example:)\s*$/i.test(line)) return;
  finishOpenStep(scan, index);
  scan.group = undefined;
  scan.active = false;
}

function openListGroup(scan: NumberedScan): StepGroup {
  const group: StepGroup = { steps: [], kind: "numbered list", ambiguous: CONDITIONAL.test(scan.context) };
  scan.groups.push(group);
  scan.group = group;
  return group;
}

function detectionFromGroups(usable: StepGroup[]): Detection {
  const steps = usable.flatMap(group => group.steps);
  const links: DetectedLink[] = [];
  const conditional: string[] = [];
  let offset = 0;
  let uncertain = usable.length > 1;
  for (const group of usable) {
    uncertain = linkGroup(group, offset, { links, conditional }) || uncertain;
    offset += group.steps.length;
  }
  const sourceKind = usable.at(0)?.kind ?? "numbered list";
  const findings = [...groupFindings(usable), ...conditionalFindings(conditional)];
  return { steps, links, sourceKind, relationships: uncertain ? "unresolved" : "explicit", findings };
}

function groupFindings(usable: StepGroup[]): string[] {
  const start = (group: StepGroup): string => String(group.steps.at(0)?.source.startLine ?? 0);
  const findings = usable.filter(group => group.ambiguous)
    .map(group => `The list at line ${start(group)} is introduced as a choice, so Flow draws no edges in it.`);
  if (usable.length < 2) return findings;
  const lines = usable.map(group => `line ${start(group)}`).join(", ");
  return [...findings, `${String(usable.length)} separate step lists (${lines}); Flow does not connect them.`];
}

function conditionalFindings(conditional: string[]): string[] {
  if (conditional.length === 0) return [];
  const named = conditional.slice(0, MAX_NAMED_STEPS).join("; ");
  const more = conditional.length > MAX_NAMED_STEPS ? ` and ${String(conditional.length - MAX_NAMED_STEPS)} more` : "";
  return [`Conditional wording gives these steps no edge in or out: ${named}${more}.`];
}

/** The first conditional word in a step and the source line it is on. */
function conditionalWord(step: DetectedStep): { word: string; line: number } | undefined {
  const lines = visibleLines(step.body);
  const index = lines.findIndex(line => CONDITIONAL.test(line));
  const word = index >= 0 ? CONDITIONAL.exec(lines[index])?.[1] : undefined;
  return word ? { word, line: step.source.startLine + index } : undefined;
}

/** Records a conditional step for the diagnosis; true when the step is conditional. */
function noteConditional(step: DetectedStep, conditional: string[]): boolean {
  const found = conditionalWord(step);
  if (found) conditional.push(`step ${step.display} (line ${String(found.line)}, "${found.word}")`);
  return found !== undefined;
}

function linkGroup(group: StepGroup, offset: number, out: { links: DetectedLink[]; conditional: string[] }): boolean {
  let uncertain = !!group.ambiguous;
  for (let index = 0; index < group.steps.length; index += 1) {
    const step = group.steps.at(index);
    const next = group.steps.at(index + 1);
    if (!step) continue;
    const ambiguous = !!group.ambiguous || noteConditional(step, out.conditional);
    if (ambiguous) uncertain = true;
    const nextConditional = next !== undefined && conditionalWord(next) !== undefined;
    if (next && !ambiguous && !nextConditional) out.links.push({ from: offset + index, to: offset + index + 1, source: step.source });
  }
  return uncertain;
}
