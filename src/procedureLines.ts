export const HEADING = /^(#{1,6})\s+(.+?)\s*#*$/;
export const EXCLUDED = /\b(examples?|alternatives?|options?|appendix|notes|reference|choices)\b/i;

const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const FRONTMATTER_END = /^(---|\.\.\.)\s*$/;

type Fence = { char: string; length: number; allow: boolean };

/** Drop enclosing headings whose level is the same or deeper than `level`. */
export function popParentsAtOrAbove<T extends { level: number }>(parents: T[], level: number): void {
  while (parents.length > 0) {
    const parent = parents[parents.length - 1];
    if (!parent || parent.level < level) return;
    parents.pop();
  }
}

function startsFrontmatter(text: string): boolean {
  return text.startsWith("---\n") || text.startsWith("---\r\n");
}

function endsFrontmatter(line: string, index: number): boolean {
  return index > 0 && FRONTMATTER_END.test(line);
}

function fenceMatch(line: string): RegExpMatchArray | undefined {
  return line.match(FENCE) ?? undefined;
}

function closesFence(fence: Fence, delimiter: RegExpMatchArray | undefined): boolean {
  const marker = delimiter?.[1];
  if (!delimiter || !marker) return false;
  return marker[0] === fence.char && marker.length >= fence.length && delimiter[2].trim() === "";
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
  let frontmatter = startsFrontmatter(text);
  let excluded = false;
  return text.split(/\r?\n/).map((line, index) => {
    if (frontmatter) {
      if (endsFrontmatter(line, index)) frontmatter = false;
      return "";
    }
    const delimiter = fenceMatch(line);
    if (fence) {
      const hidden = fencedLine(delimiter, fence, () => { fence = undefined; });
      return hidden === undefined ? line : hidden;
    }
    const heading = line.match(HEADING);
    if (heading) excluded = EXCLUDED.test(heading[2]);
    if (!delimiter) return line;
    fence = openFence(delimiter, excluded, pn);
    return "";
  });
}
