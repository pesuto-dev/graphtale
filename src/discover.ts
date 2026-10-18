import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { readJsonFile, readRequiredText, INVENTORY_MAX_FILES, INVENTORY_MAX_ENTRIES } from "./fileAccess";
import { parseFrontmatter, type Frontmatter } from "./frontmatter";
import type { CatalogSkill } from "./shared/protocol";

export const WORKSPACE_SKILL_DIRS = [
  ".cursor/skills",
  ".claude/skills",
  ".agents/skills",
  ".codex/skills",
];

/** User-level roots. Codex canonical is `~/.codex/skills`; `.claude` / `.cursor` / `.agents` stay listed separately. */
export const USER_SKILL_DIRS = [
  ".cursor/skills",
  ".claude/skills",
  ".codex/skills",
  ".agents/skills",
];

const SKILL_FILE = "SKILL.md";

export type DiscoverOptions = {
  workspaceFolders: string[];
  homedir?: string;
  onWarning?: (message: string) => void;
};

export type { Frontmatter } from "./frontmatter";

export function discoverSkills(options: DiscoverOptions): CatalogSkill[] {
  const homedir = options.homedir ?? os.homedir();
  const roots: string[] = [];

  for (const folder of options.workspaceFolders) {
    for (const rel of WORKSPACE_SKILL_DIRS) {
      roots.push(path.join(folder, rel));
    }
  }
  for (const rel of USER_SKILL_DIRS) {
    roots.push(path.join(homedir, rel));
  }
  roots.push(...claudePluginSkillDirs(homedir));

  const byPath = new Map<string, CatalogSkill>();
  for (const root of roots) {
    if (byPath.size >= INVENTORY_MAX_FILES) { options.onWarning?.(`Skill discovery stopped after ${INVENTORY_MAX_FILES} skills.`); break; }
    for (const skill of listSkillsIn(root, options.onWarning)) {
      if (byPath.size >= INVENTORY_MAX_FILES) break;
      const key = discoveryKey(skill.rootPath);
      if (!byPath.has(key)) {
        byPath.set(key, skill);
      }
    }
  }
  return [...byPath.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function claudePluginSkillDirs(homedir: string): string[] {
  const plugins = pluginIndex(readJsonFile(path.join(homedir, ".claude", "plugins", "installed_plugins.json")));
  if (!plugins) return [];
  return Object.values(plugins).flatMap(pluginSkillRoots);
}

function pluginIndex(parsed: unknown): object | undefined {
  if (typeof parsed !== "object" || parsed === null || !("plugins" in parsed)) return undefined;
  const plugins = parsed.plugins;
  if (typeof plugins !== "object" || plugins === null) return undefined;
  return plugins;
}

/** A missing plugin index is normal; only a readable object contributes roots. */

function pluginSkillRoots(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(installSkillRoot);
}

function installSkillRoot(install: unknown): string[] {
  if (typeof install !== "object" || install === null || !("installPath" in install)) return [];
  const installPath = install.installPath;
  if (typeof installPath !== "string" || installPath.length === 0) return [];
  return [path.join(installPath, "skills")];
}

function listSkillsIn(root: string, onWarning?: (message: string) => void): CatalogSkill[] {
  const entries = inventoryEntries(root, onWarning);
  const skills: CatalogSkill[] = [];
  for (const entry of entries) {
    if (skills.length >= INVENTORY_MAX_FILES) {
      onWarning?.(`Skill discovery stopped after ${INVENTORY_MAX_FILES} skills in ${root}.`);
      break;
    }
    const skill = skillFromEntry(root, entry);
    if (skill) skills.push(skill);
  }
  return skills;
}

function inventoryEntries(root: string, onWarning?: (message: string) => void): fs.Dirent[] {
  if (!isDirectory(root)) return [];
  const entries: fs.Dirent[] = [];
  let directory: fs.Dir | undefined;
  try {
    directory = fs.opendirSync(root);
    let entry: fs.Dirent | null;
    while (entries.length < INVENTORY_MAX_ENTRIES && (entry = directory.readSync())) entries.push(entry);
    if (entries.length === INVENTORY_MAX_ENTRIES) onWarning?.(`Skill discovery reached its entry limit in ${root}.`);
  } catch {
    onWarning?.(`Could not discover skills in ${root}.`);
    return [];
  } finally {
    directory?.closeSync();
  }
  return entries;
}

function skillFromEntry(root: string, entry: fs.Dirent): CatalogSkill | undefined {
  if (!entry.isDirectory() && !entry.isSymbolicLink()) return undefined;
  const skillRoot = path.join(root, entry.name);
  if (!isDirectory(skillRoot)) return undefined;
  const skillFile = path.join(skillRoot, SKILL_FILE);
  if (!fs.existsSync(skillFile)) return undefined;
  const meta = readFrontmatter(skillFile);
  return {
    id: meta.name || entry.name,
    name: meta.name || entry.name,
    description: meta.error ? `Invalid SKILL.md frontmatter: ${meta.error}` : meta.description,
    rootPath: skillRoot,
    frontmatterError: meta.error,
  };
}

function discoveryKey(rootPath: string): string {
  try {
    return fs.realpathSync(rootPath);
  } catch {
    return path.resolve(rootPath);
  }
}

export function readFrontmatter(skillFile: string): Frontmatter {
  try {
    const text = readRequiredText(skillFile);
    return parseFrontmatter(text);
  } catch (err) {
    return {
      name: "",
      description: "",
      error: err instanceof Error ? err.message : "Could not read SKILL.md",
    };
  }
}

function isDirectory(dir: string): boolean {
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

function toDisplayPath(value: string): string {
  return value.replaceAll("\\", "/");
}

/** Short label for the skill tree / picker: `~/.codex/skills/foo` or `.cursor/skills/bar`. */
export function skillLocationLabel(
  rootPath: string,
  options: { homedir?: string; workspaceFolders?: string[] } = {},
): string {
  const resolved = path.resolve(rootPath);
  const homedir = path.resolve(options.homedir ?? os.homedir());
  if (resolved === homedir || resolved.startsWith(homedir + path.sep)) {
    return toDisplayPath("~" + resolved.slice(homedir.length));
  }
  for (const folder of options.workspaceFolders ?? []) {
    const workspace = path.resolve(folder);
    if (resolved === workspace) {
      return ".";
    }
    if (resolved.startsWith(workspace + path.sep)) {
      return toDisplayPath(path.relative(workspace, resolved));
    }
  }
  return toDisplayPath(resolved);
}
