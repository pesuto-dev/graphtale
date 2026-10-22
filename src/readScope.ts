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

/** `.cursor/skills`, `.claude/skills`, `.agents/skills`, or `.codex/skills`. */
const KNOWN_SKILL_PARENT = /(?:^|[/\\])\.(?:cursor|claude|agents|codex)[/\\]skills$/i;
/** `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/skills`, where plugin skills are discovered. */
const PLUGIN_SKILL_PARENT = /(?:^|[/\\])\.claude[/\\]plugins[/\\]cache[/\\][^/\\]+[/\\][^/\\]+[/\\][^/\\]+[/\\]skills$/i;

/** The skill, open workspace folders, every known skills folder, and the agent folders. */
export function readScope(input: ReadScopeInput): ReadScope {
  const catalog = input.catalog ?? [];
  const roots = [
    input.skillRoot,
    ...(input.workspaceFolders ?? []),
    ...USER_SKILL_DIRS.map((dir) => path.join(input.homedir, dir)),
    path.join(input.homedir, ".claude", "agents"),
    path.join(input.homedir, ".codex", "agents"),
    ...catalog.flatMap((skill) => skillScopeRoots(skill.rootPath)),
  ];
  return { skillRoot: input.skillRoot, homedir: input.homedir, roots: [...new Set(roots.map(realKey))] };
}

/** The skill folder, plus its parent only when that parent is a known skills directory. */
function skillScopeRoots(skillRoot: string): string[] {
  const parent = path.dirname(skillRoot);
  return isKnownSkillsFolder(parent) ? [skillRoot, parent] : [skillRoot];
}

function isKnownSkillsFolder(dir: string): boolean {
  return KNOWN_SKILL_PARENT.test(dir) || PLUGIN_SKILL_PARENT.test(dir);
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
