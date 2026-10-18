import { HEADING, popParentsAtOrAbove, visibleLines } from "./procedureLines";
import type { Vocabulary } from "./procedureVocabulary";
import type { SourceRange } from "./shared/protocol";

/** Wording that makes a step conditional, so Flow draws no edge into or out of it. */
export const CONDITIONAL = /\b(if|otherwise|unless|parallel|concurrently|alternatively|choose one|one of|go to|skip|repeat|until)\b/i;

const NUMBERED = /^(\d+[a-z]?)\.\s+(.+)$/i;
/** Also "Step 1: Gather" and "Phase 2 — Fix"; only the repair plan reads these. */
const STEP_NUMBERED = /^(?:(?:step|phase|stage|gate)\s+)?(\d+[a-z]?)(?:\.|\s*[:—–-])\s+(.+)$/i;
const LIST_ITEM = /^(\d+[a-z]?)\.\s+(.*\S)\s*$/i;

export interface DetectedStep { display: string; title: string; body: string; source: SourceRange; resource?: string }

/** The heading a group sits under. */
export interface Section { title: string; line: number; level: number }

export interface StepGroup {
  steps: DetectedStep[];
  kind: "numbered headings" | "numbered list";
  ambiguous?: boolean;
  section?: Section;
  /** Numbered as "Step 1:" rather than "1."; Flow never reads these. */
  stepLike?: boolean;
}

/**
 * Options for the repair plan only. Flow always scans with none, so what it draws never changes.
 * `everySection` reads lists under any heading that is not skipped; `stepHeadings` reads "Step 1:" headings.
 */
export interface ScanOptions { everySection?: boolean; stepHeadings?: boolean }

interface NumberedScan {
  sourcePath: string;
  original: string[];
  groups: StepGroup[];
  parents: { level: number; excluded: boolean }[];
  active: boolean;
  context: string;
  group?: StepGroup;
  headingLevel?: number;
  section?: Section;
  vocabulary: Vocabulary;
  options: ScanOptions;
}

/** Numbered lists and numbered headings as Flow reads them, grouped and with step bodies. */
export function scanGroups(text: string, sourcePath: string, vocabulary: Vocabulary, options: ScanOptions = {}): StepGroup[] {
  const lines = visibleLines(text, false, vocabulary);
  const scan: NumberedScan = { sourcePath, original: text.split(/\r?\n/), groups: [], parents: [], active: true, context: "", vocabulary, options };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines.at(index) ?? "";
    const heading = HEADING.exec(line);
    if (heading) takeHeading(scan, index, heading);
    else takeListLine(scan, index, line);
  }
  finishOpenStep(scan, lines.length);
  return scan.groups.filter(group => group.steps.length > 0);
}

/** The first conditional word in a step and the source line it is on. */
export function conditionalWord(step: DetectedStep): { word: string; line: number } | undefined {
  const lines = visibleLines(step.body);
  const index = lines.findIndex(line => CONDITIONAL.test(line));
  const word = index >= 0 ? CONDITIONAL.exec(lines[index])?.[1] : undefined;
  return word ? { word, line: step.source.startLine + index } : undefined;
}

function finishOpenStep(scan: NumberedScan, end: number): void {
  const last = scan.group?.steps.at(-1);
  if (!last) return;
  last.source.endLine = Math.max(last.source.startLine, end);
  last.body = scan.original.slice(last.source.startLine - 1, last.source.endLine).join("\n").trim();
}

function numberedTitle(scan: NumberedScan, title: string, level: number): { match: RegExpExecArray; stepLike: boolean } | undefined {
  if (level < 2) return undefined;
  const strict = NUMBERED.exec(title);
  if (strict) return { match: strict, stepLike: false };
  const loose = scan.options.stepHeadings ? STEP_NUMBERED.exec(title) : null;
  return loose ? { match: loose, stepLike: true } : undefined;
}

function takeHeading(scan: NumberedScan, index: number, heading: RegExpMatchArray): void {
  const level = heading[1].length;
  const title = heading[2];
  scan.context = "";
  popParentsAtOrAbove(scan.parents, level);
  const instruction = numberedTitle(scan, title, level);
  const excluded = headingExcluded(instruction, title, scan);
  scan.parents.push({ level, excluded });
  if (keepsNestedHeading(scan, level)) return;
  finishOpenStep(scan, index);
  const numbered = excluded ? undefined : instruction;
  if (!numbered) {
    scan.group = undefined;
    scan.headingLevel = undefined;
    scan.active = !excluded && (scan.options.everySection === true || scan.vocabulary.isStepSection(title));
    scan.section = { title, line: index + 1, level };
    return;
  }
  const group = numberedGroup(scan, level, numbered.stepLike);
  scan.headingLevel = level;
  group.steps.push({
    display: numbered.match[1],
    title: numbered.match[2],
    body: "",
    source: { path: scan.sourcePath, startLine: index + 1, endLine: index + 1 },
  });
}

function headingExcluded(instruction: unknown, title: string, scan: NumberedScan): boolean {
  return (!instruction && scan.vocabulary.isSkipSection(title)) || scan.parents.some(parent => parent.excluded);
}

function keepsNestedHeading(scan: NumberedScan, level: number): boolean {
  return scan.group?.kind === "numbered headings" && scan.headingLevel !== undefined && level > scan.headingLevel;
}

function numberedGroup(scan: NumberedScan, level: number, stepLike: boolean): StepGroup {
  const current = scan.group;
  if (current?.kind === "numbered headings" && scan.headingLevel === level) return current;
  const group: StepGroup = { steps: [], kind: "numbered headings", section: scan.section, ...(stepLike ? { stepLike } : {}) };
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
  const group: StepGroup = { steps: [], kind: "numbered list", ambiguous: CONDITIONAL.test(scan.context), section: scan.section };
  scan.groups.push(group);
  scan.group = group;
  return group;
}
