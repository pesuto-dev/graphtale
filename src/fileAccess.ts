import * as fs from "node:fs";
import * as path from "node:path";

/** Largest document used as parser input. SKILL.md above this is rejected. */
export const INPUT_READ_LIMIT_BYTES = 256 * 1024;
/** Largest text returned to a preview pane or used for a catalog excerpt. */
export const PREVIEW_READ_LIMIT_BYTES = 64 * 1024;
/** Keep a malformed skill from making the Catalog walk an unbounded tree. */
export const INVENTORY_MAX_DEPTH = 8;
export const INVENTORY_MAX_FILES = 400;
export const INVENTORY_MAX_ENTRIES = 2000;
export const FLOW_MAX_STEPS = 500;

export class FileAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileAccessError";
  }
}

export type TextFileResult = {
  text: string;
  warning?: string;
  truncated?: boolean;
};

export type FileInventory = {
  files: string[];
  warnings: string[];
};

/**
 * Read at most `limitBytes`, without trusting a pre-read file size. Optional
 * files never throw: callers can keep their current graph and show the warning.
 */
export function readTextFile(filePath: string, limitBytes: number): TextFileResult {
  const label = displayPath(filePath);
  let stat: fs.Stats;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return { text: "", warning: `Could not read ${label}.` };
  }
  if (!stat.isFile()) {
    return { text: "", warning: `${label} is not a regular file.` };
  }
  if (/\.(png|jpe?g|gif|webp|ico|pdf|zip|vsix|woff2?|ttf|exe|dll|mp[34]|wasm|pyc)$/i.test(filePath)) {
    return { text: "", warning: `${label} is a binary resource; preview is unavailable.` };
  }
  try {
    if (stat.size > limitBytes) {
      return {
        text: readPrefix(filePath, limitBytes, label),
        truncated: true,
        warning: `${label} is larger than the ${formatBytes(limitBytes)} read limit; its text was truncated.`,
      };
    }
    return { text: readPrefix(filePath, stat.size, label) };
  } catch (err) {
    return { text: "", warning: err instanceof Error ? err.message : `Could not read ${label}.` };
  }
}

/** Required root input. A caller may retain its last good graph on this error. */
export function readRequiredText(filePath: string, limitBytes = INPUT_READ_LIMIT_BYTES): string {
  const label = displayPath(filePath);
  let stat: fs.Stats;
  try {
    stat = fs.statSync(filePath);
  } catch {
    throw new FileAccessError(`Could not read ${label}. It may have been moved, deleted, or made unavailable.`);
  }
  if (!stat.isFile()) {
    throw new FileAccessError(`${label} is not a regular file.`);
  }
  if (stat.size > limitBytes) {
    throw new FileAccessError(`${label} is larger than the ${formatBytes(limitBytes)} read limit.`);
  }
  const text = readPrefix(filePath, stat.size, label);
  if (isBinary(text)) {
    throw new FileAccessError(`${label} appears to be binary and cannot be parsed as text.`);
  }
  return text;
}

/** Bounded, symlink-free recursive inventory for Catalog folders. */
export function walkTextFiles(dir: string): FileInventory {
  const files: string[] = [];
  const warnings: string[] = [];
  let visited = 0;
  const visit = (current: string, depth: number): void => {
    if (files.length >= INVENTORY_MAX_FILES || visited >= INVENTORY_MAX_ENTRIES) return;
    let directory: fs.Dir | undefined;
    try {
      directory = fs.opendirSync(current);
      let entry: fs.Dirent | null;
      while (visited < INVENTORY_MAX_ENTRIES && files.length < INVENTORY_MAX_FILES && (entry = directory.readSync())) {
        visited++;
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) {
          if (depth >= INVENTORY_MAX_DEPTH) warnings.push(`Catalog inventory reached its ${INVENTORY_MAX_DEPTH}-level depth limit.`);
          else visit(full, depth + 1);
        } else if (entry.isFile()) files.push(full);
        else if (entry.isSymbolicLink()) warnings.push("Catalog inventory skipped symbolic links.");
      }
    } catch { warnings.push(`Could not inventory ${displayPath(current)}.`); }
    finally { directory?.closeSync(); }
  };
  visit(dir, 0);
  if (visited >= INVENTORY_MAX_ENTRIES) warnings.push(`Catalog inventory reached its ${INVENTORY_MAX_ENTRIES}-entry limit.`);
  if (files.length >= INVENTORY_MAX_FILES) {
    warnings.push(`Catalog inventory stopped after ${INVENTORY_MAX_FILES} files in ${displayPath(dir)}.`);
  }
  return { files, warnings: uniqueWarnings(warnings) };
}

export function isRegularFile(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function readPrefix(filePath: string, bytes: number, label: string): string {
  const toRead = Math.max(0, bytes);
  const buffer = Buffer.alloc(toRead);
  let fd: number | undefined;
  try {
    fd = fs.openSync(filePath, "r");
    const read = fs.readSync(fd, buffer, 0, toRead, 0);
    const content = buffer.subarray(0, read);
    if (isBinaryBuffer(content)) {
      throw new FileAccessError(`${label} appears to be binary and cannot be read as text.`);
    }
    return content.toString("utf8");
  } catch (err) {
    if (err instanceof FileAccessError) throw err;
    throw new FileAccessError(`Could not read ${label}.`);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

function isBinary(text: string): boolean {
  return text.includes("\0");
}

function isBinaryBuffer(content: Buffer): boolean {
  return content.includes(0);
}

function displayPath(filePath: string): string {
  return path.basename(filePath) || filePath;
}

function formatBytes(bytes: number): string {
  return `${Math.round(bytes / 1024)} KiB`;
}

function uniqueWarnings(warnings: string[]): string[] {
  return [...new Set(warnings)];
}
