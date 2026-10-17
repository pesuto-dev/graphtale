import { EXCLUDED, HEADING } from "./detectionPatterns";
import { maskFrontmatter } from "./text";

const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;

type Fence = { char: string; length: number; allow: boolean };

/** Keep original line offsets. Hide frontmatter and respect matching fence lengths. */
export function visibleLines(text: string, pn = false): string[] {
  let fence: Fence | undefined;
  let excluded = false;
  return maskFrontmatter(text).map((line) => {
    const delimiter = line.match(FENCE);
    if (fence) return insideFence(line, delimiter, fence, () => { fence = undefined; });
    const heading = line.match(HEADING);
    if (heading) excluded = EXCLUDED.test(heading[2]);
    if (!delimiter) return line;
    fence = { char: delimiter[1][0] ?? "`", length: delimiter[1].length, allow: pn && !excluded && plainFence(delimiter[2] ?? "") };
    return "";
  });
}

function insideFence(line: string, delimiter: RegExpMatchArray | null, fence: Fence, close: () => void): string {
  if (!delimiter) return fence.allow ? line : "";
  const marker = delimiter[1] ?? "";
  const info = delimiter[2] ?? "";
  if (marker[0] === fence.char && marker.length >= fence.length && info.trim() === "") {
    close();
    return "";
  }
  return fence.allow ? line : "";
}

function plainFence(info: string): boolean {
  return /^(|text|plaintext|workflow)$/.test(info.trim());
}
