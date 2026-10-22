import * as fs from "node:fs";
import * as path from "node:path";
import { languagesFile } from "./procedureVocabulary";
import { trimChar } from "./text";

export interface BackupInput { skillName: string; skillFile: string; homedir: string }

/**
 * Backup the repairing model makes itself before any edit, outside every skills folder:
 * a copied SKILL.md inside one would load as a second skill with the same name.
 */
export function backupSteps(input: BackupInput): string[] {
  const folder = realFolder(input.skillFile);
  const name = safeName(input.skillName);
  const target = path.join(input.homedir, ".graphtale", "backups", name);
  const languages = languagesFile(input.homedir);
  return [
    "Backup (make it yourself before you change any file; do not ask the user to do it):",
    `1. Copy the whole skill folder ${folder} to a new folder named after the current date and time under ${target}.`,
    `   macOS/Linux: mkdir -p ${posixSingleQuote(target)} && cp -R ${posixSingleQuote(folder)} ${posixSingleQuote(target)}/$(date +%Y%m%d-%H%M%S)`,
    `   Windows (PowerShell): $b = Join-Path ${powershellSingleQuote(target)} (Get-Date -Format yyyyMMdd-HHmmss); New-Item -ItemType Directory -Force ${powershellSingleQuote(target)} | Out-Null; Copy-Item -Recurse ${powershellSingleQuote(folder)} $b`,
    "   Never put the backup inside a skills folder or the skill itself.",
    `2. Before you change ${languages}, copy it next to itself as languages.json.<date-time>.bak.`,
    "3. Check that every file in the backup has the same SHA-256 as the original. Do not edit until it does.",
    "4. In your reply, give the backup path and the command that restores it.",
    "If you repair a plugin's source repository or an upstream skill instead, back up that folder the same way. If you cannot run commands, say so before you change anything.",
  ];
}

function realFolder(skillFile: string): string {
  const folder = path.dirname(path.resolve(skillFile));
  try {
    return fs.realpathSync(folder);
  } catch {
    return folder;
  }
}

/** POSIX single quotes. A quote inside the path is `'\''`, so `$(…)`, backticks and `$var` stay literal. */
function posixSingleQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

/** PowerShell single quotes. A quote inside the path is doubled, and nothing else expands. */
function powershellSingleQuote(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

/** A folder name that is safe on every platform. */
function safeName(skillName: string): string {
  const dashed = skillName.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
  const name = trimChar(dashed, "-");
  return name || "skill";
}
