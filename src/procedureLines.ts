import { ENGLISH, type Vocabulary } from "./procedureVocabulary";
import { maskFrontmatter } from "./text";

export interface Heading { level: number; title: string }

/**
 * P/N rows, arrow prose and diagram markers are short. Their lazy patterns are quadratic
 * on long lines, so longer lines are never read as one.
 */
export const PATTERN_LINE_LIMIT = 1000;

const HEADING_OPEN = /^(#{1,6})\s/;
const WHITESPACE = /\s/;
const LINE_BREAK = /[\n\r\u2028\u2029]/;

/**
 * Same result as `/^(#{1,6})\s+(.+?)\s*#*$/`, in linear time: that regex is quadratic
 * on long lines and froze the host on a crafted SKILL.md.
 */
export function matchHeading(line: string): Heading | undefined {
  const open = HEADING_OPEN.exec(line);
  if (!open) return undefined;
  const level = open[1].length;
  const rest = line.slice(level);
  let gap = 0;
  while (gap < rest.length && WHITESPACE.test(rest[gap])) gap++;
  const title = gap < rest.length ? titleBeforeClose(rest.slice(gap)) : titleInGap(rest, gap);
  return title === undefined ? undefined : { level, title };
}

/** Shortest non-empty prefix whose remainder is spaces then closing `#`s. */
function titleBeforeClose(text: string): string | undefined {
  let close = text.length;
  while (close > 0 && text[close - 1] === "#") close--;
  while (close > 0 && WHITESPACE.test(text[close - 1])) close--;
  const title = text.slice(0, Math.max(1, close));
  return LINE_BREAK.test(title) ? undefined : title;
}

/** A line of hashes and spaces only: the regex keeps one space as the title. */
function titleInGap(rest: string, gap: number): string | undefined {
  for (let index = gap - 1; index >= 1; index--) {
    if (!LINE_BREAK.test(rest[index])) return rest[index];
  }
  return undefined;
}

const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;

interface Fence { char: string; length: number; allow: boolean }

/** Drop enclosing headings whose level is the same or deeper than `level`. */
export function popParentsAtOrAbove<T extends { level: number }>(parents: T[], level: number): T[] {
  while (parents.length > 0) {
    const parent = parents.at(-1);
    if (!parent || parent.level < level) return parents;
    parents.pop();
  }
  return parents;
}

function fenceMatch(line: string): RegExpMatchArray | undefined {
  return (FENCE.exec(line)) ?? undefined;
}

function closesFence(fence: Fence, delimiter: RegExpMatchArray | undefined): boolean {
  const marker = delimiter?.[1];
  if (!delimiter || !marker) return false;
  return marker.startsWith(fence.char) && marker.length >= fence.length && delimiter[2].trim() === "";
}

function fenceAllows(info: string, excluded: boolean, pn: boolean): boolean {
  return pn && !excluded && /^(|text|plaintext|workflow)$/.test(info.trim());
}

function openFence(delimiter: RegExpMatchArray, excluded: boolean, pn: boolean): Fence | undefined {
  const marker = delimiter[1];
  if (!marker) return undefined;
  return { char: marker[0], length: marker.length, allow: fenceAllows(delimiter[2], excluded, pn) };
}

function fencedLine(delimiter: RegExpMatchArray | undefined, fence: Fence, close: () => void): string | undefined {
  if (!closesFence(fence, delimiter)) return fence.allow ? undefined : "";
  close();
  return "";
}

/**
 * Keep original line offsets. Blank hidden lines stay in place.
 * `pn` keeps plain-text fences that can hold a P/N table.
 */
export function visibleLines(text: string, pn = false, vocabulary: Vocabulary = ENGLISH): string[] {
  let fence: Fence | undefined;
  let excluded = false;
  return maskFrontmatter(text).map((line) => {
    const delimiter = fenceMatch(line);
    if (fence) {
      const hidden = fencedLine(delimiter, fence, () => { fence = undefined; });
      return hidden ?? line;
    }
    const heading = matchHeading(line);
    if (heading) excluded = vocabulary.isSkipSection(heading.title);
    if (!delimiter) return line;
    fence = openFence(delimiter, excluded, pn);
    return "";
  });
}
