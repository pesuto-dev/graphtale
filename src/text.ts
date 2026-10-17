/** UTF-8 BOM. It is not a line, but it hides a leading frontmatter fence. */
export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function stripFrontmatter(text: string): string {
  return stripBom(text).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

/** First non-empty line that is not a heading or a frontmatter fence. */
export function firstLine(text: string): string {
  return (text.split(/\r?\n/).map((line) => line.trim()).find((line) => line && !line.startsWith("#") && line !== "---") ?? "").slice(0, 220);
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
