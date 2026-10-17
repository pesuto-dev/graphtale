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
  if (!(source.startsWith("---\n") || source.startsWith("---\r\n"))) return false;
  return !source.split(/\r?\n/).slice(1).some((line) => FRONTMATTER_CLOSER.test(line));
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
