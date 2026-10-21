import * as fs from "node:fs";
import * as path from "node:path";
import { USER_SKILL_DIRS } from "./discover";
import type { CatalogSkill } from "./shared/protocol";

/** Folders whose files the viewer reads without a click. Anything else is listed, not read. */
export interface ReadScope {
  skillRoot: string;
  homedir: string;
  roots: string[];
}

export interface ReadScopeInput {
  skillRoot: string;
  homedir: string;
  workspaceFolders?: string[];
  catalog?: CatalogSkill[];
}

export const OUTSIDE_SCOPE_SUMMARY = "Outside the skill and workspace folders. Select it to preview.";
export const OUTSIDE_SCOPE_NOTICE = "This file is outside the skill and workspace folders.";

/** The skill, open workspace folders, every known skills folder, and the agent folders. */
export function readScope(input: ReadScopeInput): ReadScope {
  const catalog = input.catalog ?? [];
  const roots = [
    input.skillRoot,
    ...(input.workspaceFolders ?? []),
    ...USER_SKILL_DIRS.map((dir) => path.join(input.homedir, dir)),
    path.join(input.homedir, ".claude", "agents"),
    path.join(input.homedir, ".codex", "agents"),
    ...catalog.flatMap((skill) => [skill.rootPath, path.dirname(skill.rootPath)]),
  ];
  return { skillRoot: input.skillRoot, homedir: input.homedir, roots: [...new Set(roots.map(realKey))] };
}

/** Real paths on both sides, so a symlink inside the skill that points elsewhere counts as elsewhere. */
export function inReadScope(filePath: string, scope: ReadScope): boolean {
  const file = realKey(filePath);
  return scope.roots.some((root) => file === root || file.startsWith(root.endsWith(path.sep) ? root : root + path.sep));
}

/** Windows paths compare case-insensitively. */
function realKey(value: string): string {
  let resolved = path.resolve(value);
  try {
    resolved = fs.realpathSync.native(resolved);
  } catch {
    // A missing path keeps its resolved spelling; it cannot be read either way.
  }
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}
