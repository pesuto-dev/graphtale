import { HEADING, popParentsAtOrAbove, visibleLines } from "./procedureLines";
import type { Vocabulary } from "./procedureVocabulary";

/** Wording that makes a step conditional, so Flow draws no edge into or out of it. */
export const CONDITIONAL = /\b(if|otherwise|unless|parallel|concurrently|alternatively|choose one|one of|go to|skip|repeat|until)\b/i;

const ITEM = /^(\d+[a-z]?)\.\s+(.*\S)\s*$/i;
const STEP_HEADING = /^(?:(?:step|phase|stage|gate)\s+)?(\d+[a-z]?)(?:\.|\s*[:—–-])\s+(.*\S)\s*$/i;
const CHOICE = /\?|→|->/;

export interface ListItem {
  number: string;
  title: string;
  line: number;
  condition?: string;
  conditionLine?: number;
}

/** A numbered list, or a run of numbered sub-headings, outside skip sections. */
export interface NumberedList {
  heading: string;
  /** The heading text exactly as written, for a rename the model can find on that line. */
  raw: string;
  line: number;
  level: number;
  recognized: boolean;
  fromHeadings: boolean;
  /** Most items are questions or arrows: a choice between lanes, not steps in a row. */
  decision: boolean;
  items: ListItem[];
}

interface Scan {
  vocabulary: Vocabulary;
  parents: { level: number; excluded: boolean }[];
  titles: string[];
  lists: NumberedList[];
  current?: NumberedList;
  item?: ListItem;
}

/** Every numbered list with at least two items, with the first line that makes each item conditional. */
export function numberedLists(text: string, vocabulary: Vocabulary): NumberedList[] {
  const scan: Scan = { vocabulary, parents: [], titles: [], lists: [] };
  visibleLines(text, false, vocabulary).forEach((line, index) => {
    const heading = HEADING.exec(line);
    if (heading) takeHeading(scan, heading, index + 1);
    else takeLine(scan, line, index + 1);
  });
  for (const list of scan.lists) list.decision = isDecision(list);
  return scan.lists.filter((list) => list.items.length >= 2);
}

function takeHeading(scan: Scan, heading: RegExpExecArray, line: number): void {
  const level = heading[1].length;
  const title = cleanText(heading[2]);
  if (scan.current?.fromHeadings && level > scan.current.level + 1) return;
  popParentsAtOrAbove(scan.parents, level);
  // A skip word in the # title hides the whole file from Flow; skipTitle() reports that case.
  const excluded = (level >= 2 && scan.vocabulary.isSkipSection(heading[2])) || scan.parents.some((parent) => parent.excluded);
  scan.parents.push({ level, excluded });
  scan.titles[level] = title;
  scan.titles.length = level + 1;
  scan.item = undefined;
  const numbered = level >= 2 && !excluded ? STEP_HEADING.exec(heading[2]) : null;
  if (numbered) {
    takeNumberedHeading(scan, numbered, level, line);
    return;
  }
  scan.current = excluded ? undefined : openList(scan, { heading: title, raw: heading[2].trim(), line, level, recognized: scan.vocabulary.isStepSection(heading[2]), fromHeadings: false });
}

function takeNumberedHeading(scan: Scan, numbered: RegExpExecArray, level: number, line: number): void {
  if (!scan.current?.fromHeadings || scan.current.level !== level - 1) {
    const parent = scan.titles.slice(0, level).filter(Boolean).at(-1) ?? `numbered headings from line ${String(line)}`;
    scan.current = openList(scan, { heading: parent, raw: parent, line, level: level - 1, recognized: false, fromHeadings: true });
  }
  scan.item = { number: numbered[1], title: shortTitle(numbered[2]), line };
  scan.current.items.push(scan.item);
}

function openList(scan: Scan, list: Omit<NumberedList, "items" | "decision">): NumberedList {
  const opened: NumberedList = { ...list, decision: false, items: [] };
  scan.lists.push(opened);
  return opened;
}

function takeLine(scan: Scan, line: string, lineNumber: number): void {
  const match = ITEM.exec(line);
  if (scan.current && match && !scan.current.fromHeadings) {
    scan.item = { number: match[1], title: shortTitle(match[2]), line: lineNumber };
    scan.current.items.push(scan.item);
  }
  if (scan.item && !scan.item.condition && CONDITIONAL.test(line)) {
    scan.item.condition = cleanText(line).slice(0, 120);
    scan.item.conditionLine = lineNumber;
  }
}

function isDecision(list: NumberedList): boolean {
  const choices = list.items.filter((entry) => CHOICE.test(entry.title + (entry.condition ?? "")));
  return choices.length >= list.items.length / 2;
}

export function cleanText(text: string): string {
  return text.replace(/\*\*|__|`/g, "").replace(/\s+/g, " ").trim();
}

/** The step name before its first sentence break or arrow, at most six words; P/N rows cannot hold arrows. */
function shortTitle(text: string): string {
  const named = cleanText(text).replace(/^(?:step|phase)\s+\d+\S*\s*/i, "").split(/\s*(?:->|→)\s*/)[0] ?? "";
  const first = named.split(/(?<=[a-z0-9)])[.:;]\s| — | – /i)[0] ?? "";
  const words = first.split(" ");
  return (words.length > 6 ? `${words.slice(0, 6).join(" ")}…` : first).replace(/\.$/, "");
}

/** A # title containing a skip word: Flow skips everything under it. */
export function skipTitle(text: string, vocabulary: Vocabulary): { line: number; title: string } | undefined {
  const lines = visibleLines(text, false, vocabulary);
  const index = lines.findIndex((line) => /^#\s+\S/.test(line));
  const title = index >= 0 ? HEADING.exec(lines[index])?.[2] : undefined;
  return title && vocabulary.isSkipSection(title) ? { line: index + 1, title: title.trim() } : undefined;
}

/** The line after which a link belongs: the first # title outside fences, else the frontmatter end, else 0. */
export function titleLine(text: string, vocabulary: Vocabulary): number {
  const visible = visibleLines(text, false, vocabulary);
  const title = visible.findIndex((line) => /^#\s+\S/.test(line));
  if (title >= 0) return title + 1;
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return 0;
  const end = lines.findIndex((line, index) => index > 0 && (line.trim() === "---" || line.trim() === "..."));
  return end >= 0 ? end + 1 : 0;
}
