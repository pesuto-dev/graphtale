import * as fs from "node:fs";
import * as path from "node:path";
import type { CatalogSkill } from "./shared/protocol";

export interface OwnershipInput {
  skillName: string;
  skillFile: string;
  catalog: CatalogSkill[];
  homedir: string;
}

interface LockEntry { source: string; sourceUrl: string; skillPath: string }

/** Facts the repairing model needs before it edits: the real file, who owns it, and other copies. */
export function ownershipFacts(input: OwnershipInput): string[] {
  const real = realPath(input.skillFile);
  const facts: string[] = [];
  if (real && isLinked(input.skillFile, real)) facts.push(`The skill file is a link. Edit the real file: ${real}`);
  facts.push(...upstreamFacts(input, real));
  for (const copy of otherCopies(input, real)) facts.push(`Another copy of this skill exists: ${copy}. Ask the user whether to apply the same repair there.`);
  return facts.length > 0 ? ["Before you edit:", ...facts.map((fact) => `- ${fact}`)] : [];
}

/** The skill folder or file is itself a link; a linked parent such as /var on macOS does not count. */
function isLinked(skillFile: string, real: string): boolean {
  const folder = path.dirname(path.resolve(skillFile));
  const parent = realPath(path.dirname(folder));
  return parent !== undefined && real !== path.join(parent, path.basename(folder), path.basename(skillFile));
}

function upstreamFacts(input: OwnershipInput, real: string | undefined): string[] {
  const installed = realPath(path.join(input.homedir, ".agents", "skills"));
  if (!installed || !real?.startsWith(installed + path.sep)) return [];
  const folder = path.basename(path.dirname(real));
  const lock = lockEntry(input.homedir, input.skillName) ?? lockEntry(input.homedir, folder);
  if (!lock) return [`This skill is in ${installed}, where the skills CLI installs skills. An update may overwrite local edits. Ask the user where it comes from before editing.`];
  return [
    `This skill was installed from ${lock.source} by the skills CLI. A skills update overwrites local edits.`,
    `Ask the user first: repair it upstream (${lock.sourceUrl}, file ${lock.skillPath}) and update, or repair the local copy knowing an update undoes it.`,
  ];
}

function lockEntry(homedir: string, name: string): LockEntry | undefined {
  const parsed = readJson(path.join(homedir, ".agents", ".skill-lock.json"));
  if (typeof parsed !== "object" || parsed === null || !("skills" in parsed)) return undefined;
  const skills = parsed.skills;
  if (typeof skills !== "object" || skills === null) return undefined;
  const entry: unknown = (skills as Record<string, unknown>)[name];
  return isLockEntry(entry) ? entry : undefined;
}

function isLockEntry(entry: unknown): entry is LockEntry {
  if (typeof entry !== "object" || entry === null) return false;
  const record = entry as Record<string, unknown>;
  return typeof record.source === "string" && typeof record.sourceUrl === "string" && typeof record.skillPath === "string";
}

function otherCopies(input: OwnershipInput, real: string | undefined): string[] {
  const copies = input.catalog
    .filter((skill) => skill.name === input.skillName)
    .map((skill) => realPath(path.join(skill.rootPath, "SKILL.md")))
    .filter((file): file is string => file !== undefined && file !== real);
  return [...new Set(copies)];
}

function realPath(file: string): string | undefined {
  try {
    return fs.realpathSync(file);
  } catch {
    return undefined;
  }
}

function readJson(file: string): unknown {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
    return parsed;
  } catch {
    return undefined;
  }
}
