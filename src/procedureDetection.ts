import { extractPn } from "./procedurePn";
import { EXCLUDED, HEADING, popParentsAtOrAbove, visibleLines } from "./procedureLines";
import type { SourceRange } from "./shared/protocol";

const SECTIONS = /^(workflow|first steps|procedure|bootstrap|how it runs|operations|instructions|usage|steps|getting started)(?:\b|$)/i;
const CONDITIONAL = /\b(if|otherwise|unless|parallel|concurrently|alternatively|choose one|one of|go to|skip|repeat|until)\b/i;

export type DetectedStep = { display: string; title: string; body: string; source: SourceRange; resource?: string };
export type DetectedLink = { from: number; to: number; label?: string; source: SourceRange };
export type Detection = {
  steps: DetectedStep[];
  links: DetectedLink[];
  relationships: "explicit" | "unresolved";
  sourceKind: "numbered headings" | "numbered list" | "P/N rows";
  /** Named reasons a P/N flow is partial. Empty when every drawn edge is explicit. */
  findings?: string[];
};

const NUMBERED = /^(\d+[a-z]?)\.\s+(.+)$/i;
const LIST_ITEM = /^(\d+[a-z]?)\.\s+(.*\S)\s*$/i;

type StepGroup = { steps: DetectedStep[]; kind: Detection["sourceKind"]; ambiguous?: boolean };
type NumberedScan = {
  sourcePath: string;
  original: string[];
  groups: StepGroup[];
  parents: Array<{ level: number; excluded: boolean }>;
  active: boolean;
  context: string;
  group?: StepGroup;
  headingLevel?: number;
};

export function detectSteps(text: string, sourcePath: string): Detection | undefined {
  const lines = visibleLines(text);
  const scan: NumberedScan = {
    sourcePath,
    original: text.split(/\r?\n/),
    groups: [],
    parents: [],
    active: true,
    context: "",
  };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const heading = line.match(HEADING);
    if (heading) takeHeading(scan, index, heading);
    else takeListLine(scan, index, line);
  }
  finishOpenStep(scan, lines.length);
  const usable = scan.groups.filter(group => group.steps.length > 0);
  return usable.length > 0 ? detectionFromGroups(usable) : extractPn(text, sourcePath);
}

function finishOpenStep(scan: NumberedScan, end: number): void {
  const last = scan.group?.steps.at(-1);
  if (!last) return;
  last.source.endLine = Math.max(last.source.startLine, end);
  last.body = scan.original.slice(last.source.startLine - 1, last.source.endLine).join("\n").trim();
}

function takeHeading(scan: NumberedScan, index: number, heading: RegExpMatchArray): void {
  const level = heading[1]?.length ?? 0;
  const title = heading[2] ?? "";
  scan.context = "";
  popParentsAtOrAbove(scan.parents, level);
  const instruction = level >= 2 ? title.match(NUMBERED) : null;
  const excluded = headingExcluded(instruction, title, scan.parents);
  scan.parents.push({ level, excluded });
  if (keepsNestedHeading(scan, level)) return;
  finishOpenStep(scan, index);
  const numbered = excluded ? null : instruction;
  if (!numbered?.[1] || numbered[2] === undefined) {
    scan.group = undefined;
    scan.headingLevel = undefined;
    scan.active = !excluded && SECTIONS.test(title);
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

function headingExcluded(instruction: RegExpMatchArray | null, title: string, parents: Array<{ excluded: boolean }>): boolean {
  return (!instruction && EXCLUDED.test(title)) || parents.some(parent => parent.excluded);
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
  const item = line.match(LIST_ITEM);
  if (!item?.[1] || item[2] === undefined) {
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
  let offset = 0;
  let uncertain = usable.length > 1;
  for (const group of usable) {
    uncertain = linkGroup(group, offset, links) || uncertain;
    offset += group.steps.length;
  }
  const sourceKind = usable[0]?.kind ?? "numbered list";
  return { steps, links, sourceKind, relationships: uncertain ? "unresolved" : "explicit" };
}

function linkGroup(group: StepGroup, offset: number, links: DetectedLink[]): boolean {
  let uncertain = !!group.ambiguous;
  for (let index = 0; index < group.steps.length; index += 1) {
    const step = group.steps[index];
    const next = group.steps[index + 1];
    if (!step) continue;
    const ambiguous = !!group.ambiguous || CONDITIONAL.test(visibleLines(step.body).join("\n"));
    if (ambiguous) uncertain = true;
    const nextConditional = next !== undefined && CONDITIONAL.test(visibleLines(next.body).join("\n"));
    if (next && !ambiguous && !nextConditional) links.push({ from: offset + index, to: offset + index + 1, source: step.source });
  }
  return uncertain;
}
