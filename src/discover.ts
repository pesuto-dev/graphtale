import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { parse as parseYaml } from "yaml";
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
};

export type Frontmatter = {
  name: string;
  description: string;
  error?: string;
};

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

  const byPath = new Map<string, CatalogSkill>();
  for (const root of roots) {
    for (const skill of listSkillsIn(root)) {
      const key = path.resolve(skill.rootPath);
      if (!byPath.has(key)) {
        byPath.set(key, skill);
      }
    }
  }
  return [...byPath.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function listSkillsIn(root: string): CatalogSkill[] {
  if (!isDirectory(root)) {
    return [];
  }
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const skills: CatalogSkill[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const skillRoot = path.join(root, entry.name);
    const skillFile = path.join(skillRoot, SKILL_FILE);
    if (!fs.existsSync(skillFile)) {
      continue;
    }
    const meta = readFrontmatter(skillFile);
    const description = meta.error
      ? `Invalid SKILL.md frontmatter: ${meta.error}`
      : meta.description;
    skills.push({
      id: meta.name || entry.name,
      name: meta.name || entry.name,
      description,
      rootPath: skillRoot,
      frontmatterError: meta.error,
    });
  }
  return skills;
}

export function readFrontmatter(skillFile: string): Frontmatter {
  try {
    const text = fs.readFileSync(skillFile, "utf8");
    return parseFrontmatter(text);
  } catch (err) {
    return {
      name: "",
      description: "",
      error: err instanceof Error ? err.message : "Could not read SKILL.md",
    };
  }
}

export function parseFrontmatter(text: string): Frontmatter {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    return { name: "", description: "" };
  }
  let parsed: unknown;
  try {
    parsed = parseYaml(match[1]);
  } catch (err) {
    return {
      name: "",
      description: "",
      error: err instanceof Error ? err.message : "Invalid YAML frontmatter",
    };
  }
  if (!parsed || typeof parsed !== "object") {
    return { name: "", description: "" };
  }
  const record = parsed as Record<string, unknown>;
  return {
    name: typeof record.name === "string" ? record.name : "",
    description: typeof record.description === "string" ? record.description : "",
  };
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
