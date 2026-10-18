import { normalizePath } from "./pendingGraph";

export function isWatchedChange(
  filePath: string,
  skillRoot: string | undefined,
  extraFiles: string[],
): boolean {
  const file = watchKey(filePath);
  if (skillRoot) {
    const root = watchKey(skillRoot);
    if (file === root || file.startsWith(`${root}/`)) {
      return true;
    }
  }
  return extraFiles.some((item) => watchKey(item) === file);
}

/** Windows paths compare case-insensitively: VS Code reports `c:\`, os.homedir() returns `C:\`. */
function watchKey(value: string): string {
  const normalized = normalizePath(value);
  return /^[a-z]:\//i.test(normalized) ? normalized.toLowerCase() : normalized;
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
