import { normalizePath } from "./pendingGraph";

export function isWatchedChange(
  filePath: string,
  skillRoot: string | undefined,
  extraFiles: string[],
): boolean {
  const file = normalizePath(filePath);
  if (skillRoot) {
    const root = normalizePath(skillRoot);
    if (file === root || file.startsWith(`${root}/`)) {
      return true;
    }
  }
  return extraFiles.some((item) => normalizePath(item) === file);
}

export function extraWatchFiles(nodePaths: string[]): string[] {
  const unique = new Set<string>();
  for (const filePath of nodePaths) {
    if (filePath) {
      unique.add(normalizePath(filePath));
    }
  }
  return [...unique];
}
