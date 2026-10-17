const DIRECTORY_REOPEN = `!${"*"}/`;
const MEDIA_DIR = "docs/media";
const STAR = "*";

export function activeLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

/** Negated ship paths. The npm-only directory reopen is not a path. */
export function shipPatterns(text: string): string[] {
  return activeLines(text)
    .filter((line) => line.startsWith("!") && line !== DIRECTORY_REOPEN)
    .map((line) => line.slice(1).replace(/^\//, ""))
    .sort();
}

export function isMediaExclusion(line: string): boolean {
  const tree = `${MEDIA_DIR}/${STAR}${STAR}`;
  return line === MEDIA_DIR || line === `${MEDIA_DIR}/` || line === tree;
}

export function shipsMedia(pattern: string): boolean {
  const docsTree = `docs/${STAR}${STAR}`;
  return pattern === MEDIA_DIR || pattern.startsWith(`${MEDIA_DIR}/`) || pattern === docsTree;
}

export function excludesMedia(text: string): boolean {
  if (!activeLines(text).some(isMediaExclusion)) return false;
  return !shipPatterns(text).some(shipsMedia);
}
