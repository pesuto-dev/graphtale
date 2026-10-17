import { EXCLUDED, HEADING } from "./detectionPatterns";
import type { DetectedLink, Detection } from "./detectionTypes";
import { extractPn } from "./pnDetection";
import { visibleLines } from "./visibleLines";

export type { DetectedLink, DetectedStep, Detection } from "./detectionTypes";

const SECTIONS = /^(workflow|first steps|procedure|bootstrap|how it runs|operations|instructions|usage|steps|getting started)(?:\b|$)/i;
const CONDITIONAL = /\b(if|otherwise|unless|parallel|concurrently|alternatively|choose one|one of|go to|skip|repeat|until)\b/i;
const NUMBERED = /^(\d+[a-z]?)\.\s+(.+)$/i;

type Parent = { level: number; excluded: boolean };
type Group = { steps: Detection["steps"]; kind: Detection["sourceKind"]; ambiguous?: boolean };
type Scan = {
  groups: Group[];
  parents: Parent[];
  active: boolean;
  context: string;
  group?: Group;
  headingLevel?: number;
  original: string[];
  sourcePath: string;
};

export function detectSteps(text: string, sourcePath: string): Detection | undefined {
  const original = text.split(/\r?\n/);
  const groups = scanGroups(visibleLines(text), original, sourcePath);
  return linkNumbered(groups) ?? extractPn(text, sourcePath);
}

function scanGroups(lines: string[], original: string[], sourcePath: string): Group[] {
  const scan: Scan = { groups: [], parents: [], active: true, context: "", original, sourcePath };
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? "";
    if (handleHeading(scan, line, index)) continue;
    handleListLine(scan, line, index);
  }
  finishStep(scan, lines.length);
  return scan.groups;
}

function finishStep(scan: Scan, end: number): void {
  const last = scan.group?.steps.at(-1);
  if (!last) return;
  last.source.endLine = Math.max(last.source.startLine, end);
  last.body = scan.original.slice(last.source.startLine - 1, last.source.endLine).join("\n").trim();
}

function handleHeading(scan: Scan, line: string, index: number): boolean {
  const heading = line.match(HEADING);
  if (!heading) return false;
  const level = heading[1]?.length ?? 1;
  const title = heading[2] ?? "";
  scan.context = "";
  popParents(scan.parents, level);
  const instruction = level >= 2 ? title.match(NUMBERED) : null;
  const excluded = headingExcluded(instruction, title, scan.parents);
  scan.parents.push({ level, excluded });
  if (isNestedHeading(scan, level)) return true;
  finishStep(scan, index);
  if (instruction && !excluded) {
    pushNumberedHeading(scan, instruction, level, index);
    return true;
  }
  closeHeading(scan, excluded, title);
  return true;
}

function headingExcluded(instruction: RegExpMatchArray | null, title: string, parents: Parent[]): boolean {
  const own = instruction ? false : EXCLUDED.test(title);
  return own || parents.some((parent) => parent.excluded);
}

function closeHeading(scan: Scan, excluded: boolean, title: string): void {
  scan.group = undefined;
  scan.headingLevel = undefined;
  scan.active = !excluded && SECTIONS.test(title);
}

function isNestedHeading(scan: Scan, level: number): boolean {
  return scan.group?.kind === "numbered headings" && scan.headingLevel !== undefined && level > scan.headingLevel;
}

function popParents(parents: Parent[], level: number): void {
  while (parents.length > 0) {
    const parent = parents.at(-1);
    if (!parent || parent.level < level) return;
    parents.pop();
  }
}

function pushNumberedHeading(scan: Scan, numbered: RegExpMatchArray, level: number, index: number): void {
  const sameLevel = scan.group?.kind === "numbered headings" && scan.headingLevel === level;
  if (!sameLevel || !scan.group) {
    scan.group = { steps: [], kind: "numbered headings" };
    scan.groups.push(scan.group);
  }
  scan.headingLevel = level;
  scan.group.steps.push({
    display: numbered[1] ?? "",
    title: numbered[2] ?? "",
    body: "",
    source: { path: scan.sourcePath, startLine: index + 1, endLine: index + 1 },
  });
}

function handleListLine(scan: Scan, line: string, index: number): void {
  const inHeadingGroup = scan.group?.kind === "numbered headings";
  const excludedParent = scan.parents.some((parent) => parent.excluded);
  if (!scan.active || inHeadingGroup || excludedParent) return;
  const item = line.match(/^(\d+[a-z]?)\.\s+(.*\S)\s*$/i);
  if (!item) {
    rememberContext(scan, line, index);
    return;
  }
  finishStep(scan, index);
  if (!scan.group) {
    scan.group = { steps: [], kind: "numbered list", ambiguous: CONDITIONAL.test(scan.context) };
    scan.groups.push(scan.group);
  }
  scan.group.steps.push({
    display: item[1] ?? "",
    title: item[2] ?? "",
    body: "",
    source: { path: scan.sourcePath, startLine: index + 1, endLine: index + 1 },
  });
}

function rememberContext(scan: Scan, line: string, index: number): void {
  scan.context += `\n${line}`;
  if (!/\b(?:for example|example:)\s*$/i.test(line)) return;
  finishStep(scan, index);
  scan.group = undefined;
  scan.active = false;
}

function linkNumbered(groups: Group[]): Detection | undefined {
  const usable = groups.filter((group) => group.steps.length > 0);
  const first = usable[0];
  if (!first) return undefined;
  const steps = usable.flatMap((group) => group.steps);
  const links: DetectedLink[] = [];
  let offset = 0;
  let uncertain = usable.length > 1;
  for (const group of usable) {
    const linked = linkGroup(group, offset);
    links.push(...linked.links);
    uncertain = uncertain || linked.uncertain;
    offset += group.steps.length;
  }
  return { steps, links, sourceKind: first.kind, relationships: uncertain ? "unresolved" : "explicit" };
}

function linkGroup(group: Group, offset: number): { links: DetectedLink[]; uncertain: boolean } {
  const links: DetectedLink[] = [];
  let uncertain = false;
  for (let index = 0; index < group.steps.length; index++) {
    const step = group.steps[index];
    const next = group.steps[index + 1];
    if (!step) continue;
    const ambiguous = Boolean(group.ambiguous) || CONDITIONAL.test(visibleLines(step.body).join("\n"));
    if (ambiguous) uncertain = true;
    if (!next || ambiguous || CONDITIONAL.test(visibleLines(next.body).join("\n"))) continue;
    links.push({ from: offset + index, to: offset + index + 1, source: step.source });
  }
  return { links, uncertain };
}
