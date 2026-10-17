import { maskFrontmatter } from "./text";

export const HEADING = /^(#{1,6})\s+(.+?)\s*#*$/;
export const EXCLUDED = /\b(examples?|alternatives?|options?|appendix|notes|reference|choices)\b/i;

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
export function visibleLines(text: string, pn = false): string[] {
  let fence: Fence | undefined;
  let excluded = false;
  return maskFrontmatter(text).map((line) => {
    const delimiter = fenceMatch(line);
    if (fence) {
      const hidden = fencedLine(delimiter, fence, () => { fence = undefined; });
      return hidden ?? line;
    }
    const heading = HEADING.exec(line);
    if (heading) excluded = EXCLUDED.test(heading[2]);
    if (!delimiter) return line;
    fence = openFence(delimiter, excluded, pn);
    return "";
  });
}
