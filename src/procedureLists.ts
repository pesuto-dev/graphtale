import { HEADING, visibleLines } from "./procedureLines";
import { conditionalWord, scanGroups, type DetectedStep, type StepGroup } from "./procedureScan";
import type { Vocabulary } from "./procedureVocabulary";

const CHOICE = /\?|→|->/;

export interface ListItem {
  number: string;
  title: string;
  line: number;
  condition?: string;
  conditionLine?: number;
}

/** A group of steps for the repair plan: one Flow reads, or one it would read after a heading change. */
export interface NumberedList {
  heading: string;
  /** The heading text exactly as written, for a rename the model can find on that line. */
  raw: string;
  /** Line of the heading the list sits under, or of its first item at the top of the file. */
  line: number;
  /** Level of that heading; 0 at the top of the file. */
  level: number;
  recognized: boolean;
  fromHeadings: boolean;
  /** Numbered as "Step 1:" headings, which Flow does not read. */
  stepLike: boolean;
  /** Flow already reads these steps. */
  read: boolean;
  /** Most items are questions or arrows: a choice between lanes, not steps in a row. */
  decision: boolean;
  items: ListItem[];
}

/**
 * The step groups Flow reads, plus the groups it would read if every heading were a step section
 * and "Step 1:" headings were numbered. Built from Flow's own scan, so the plan and Flow agree.
 */
export function numberedLists(text: string, vocabulary: Vocabulary): NumberedList[] {
  const read = scanGroups(text, "", vocabulary);
  const readLines = new Set(read.flatMap((group) => group.steps.map((step) => step.source.startLine)));
  const unread = scanGroups(text, "", vocabulary, { everySection: true, stepHeadings: true })
    .filter((group) => group.steps.length >= 2 && !group.steps.some((step) => readLines.has(step.source.startLine)));
  return [...read.map((group) => toList(group, vocabulary, true)), ...unread.map((group) => toList(group, vocabulary, false))]
    .sort((a, b) => (a.items[0]?.line ?? 0) - (b.items[0]?.line ?? 0));
}

function toList(group: StepGroup, vocabulary: Vocabulary, read: boolean): NumberedList {
  const items = group.steps.map(toItem);
  const section = group.section;
  const first = group.steps.at(0)?.source.startLine ?? 0;
  return {
    heading: section ? cleanText(section.title) : "the top of the file",
    raw: section ? section.title.trim() : "",
    line: section ? section.line : first,
    level: section ? section.level : 0,
    recognized: section ? vocabulary.isStepSection(section.title) : true,
    fromHeadings: group.kind === "numbered headings",
    stepLike: group.stepLike === true,
    read,
    decision: items.filter((entry) => CHOICE.test(entry.title + (entry.condition ?? ""))).length >= items.length / 2,
    items,
  };
}

function toItem(step: DetectedStep): ListItem {
  const item: ListItem = { number: step.display, title: shortTitle(step.title), line: step.source.startLine };
  const found = conditionalWord(step);
  if (!found) return item;
  const text = step.body.split(/\r?\n/).at(found.line - step.source.startLine) ?? "";
  return { ...item, condition: cleanText(text).slice(0, 120), conditionLine: found.line };
}

export function cleanText(text: string): string {
  return text.replace(/\*\*|__|`/g, "").replace(/\s+/g, " ").trim();
}

/** The step name before its first sentence break or arrow, at most six words; P/N rows cannot hold arrows. */
function shortTitle(text: string): string {
  const named = cleanText(text).split(/\s*(?:->|→)\s*/)[0] ?? "";
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
