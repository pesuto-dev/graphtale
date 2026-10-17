/** UTF-8 BOM. It is not a line, but it hides a leading frontmatter fence. */
export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

const FRONTMATTER_CLOSER = /^(---|\.\.\.)\s*$/;

export function stripFrontmatter(text: string): string {
  return stripBom(text).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

/** A leading `---` block that never meets a closing `---` or `...` line. */
export function frontmatterNeverCloses(text: string): boolean {
  const source = stripBom(text);
  if (!opensFrontmatter(source)) return false;
  return !source.split(/\r?\n/).slice(1).some((line) => FRONTMATTER_CLOSER.test(line));
}

function opensFrontmatter(text: string): boolean {
  return text.startsWith("---\n") || text.startsWith("---\r\n");
}

/** A heading, numbered item, P/N row, or fence ends an unclosed frontmatter block. */
function instructionStart(line: string): boolean {
  return /^(?:#{2,6}\s+\S|\d+[a-z]?\.\s+\S|\s*(?:P|N\d+[a-z]?)\s+\S| {0,3}(?:`{3,}|~{3,}))/.test(line);
}

/** Blank a leading frontmatter block and keep the instruction line that ends an unclosed one. */
export function maskFrontmatter(text: string): string[] {
  const source = stripBom(text);
  const lines = source.split(/\r?\n/);
  if (!opensFrontmatter(source)) return lines;
  const closed = !frontmatterNeverCloses(source);
  const masked: string[] = [];
  let hiding = true;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? "";
    const kept = frontmatterLine(line, index, hiding, closed);
    if (kept.reveal) hiding = false;
    masked.push(kept.text);
  }
  return masked;
}

function frontmatterLine(line: string, index: number, hiding: boolean, closed: boolean): { text: string; reveal: boolean } {
  if (!hiding) return { text: line, reveal: false };
  if (index > 0 && FRONTMATTER_CLOSER.test(line)) return { text: "", reveal: true };
  if (!closed && index > 0 && instructionStart(line)) return { text: line, reveal: true };
  return { text: "", reveal: false };
}

export function firstParagraph(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("|") && line !== "---");
  return (lines[0] ?? "").slice(0, 220);
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
