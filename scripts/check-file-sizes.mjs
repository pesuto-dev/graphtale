/**
 * Hard file-size check for the coding standard.
 *
 * TypeScript counts match ESLint `max-lines` (blank lines and comment-only
 * lines skipped). CSS uses the same idea: skip blank lines and comments.
 * Preferred sizes live in docs/coding-standards.md and are not enforced here.
 */
import fs from "node:fs";
import path from "node:path";
import { Linter } from "eslint";
import tsParser from "@typescript-eslint/parser";

const root = process.cwd();
const tsLimit = 400;
const cssLimit = 300;

/**
 * Temporary exceptions. TODO(coding-standards): delete an entry once the file
 * is at or under its hard limit. A stale entry (file missing or already under
 * the limit) fails this script.
 *
 * webview/styles.css is an import list under the CSS limit, so it has no
 * exception.
 */
const exceptions = new Map();

const linter = new Linter({ configType: "flat" });

function walk(dir, files) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  }
}

function relative(file) {
  return path.relative(root, file).split(path.sep).join("/");
}

function physicalLines(source) {
  const lines = source.split(/\r?\n/);
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines.length;
}

function typescriptCodeLines(file, source) {
  const messages = linter.verify(
    source,
    [
      {
        languageOptions: {
          parser: tsParser,
          parserOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            ecmaFeatures: { jsx: file.endsWith(".tsx") },
          },
        },
        rules: {
          "max-lines": ["error", { max: 0, skipBlankLines: true, skipComments: true }],
        },
      },
    ],
    { filename: file },
  );
  const fatal = messages.find((message) => message.fatal);
  if (fatal) {
    throw new Error(`${relative(file)}: ${fatal.message}`);
  }
  const hit = messages.find((message) => message.ruleId === "max-lines");
  if (!hit) return 0;
  const match = /too many lines \((\d+)\)/.exec(hit.message);
  if (!match) {
    throw new Error(`${relative(file)}: unexpected max-lines message: ${hit.message}`);
  }
  return Number(match[1]);
}

function cssCodeLines(source) {
  const lines = source.split(/\r?\n/);
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  let inBlock = false;
  let count = 0;
  for (const line of lines) {
    let code = "";
    let index = 0;
    while (index < line.length) {
      if (inBlock) {
        const end = line.indexOf("*/", index);
        if (end === -1) break;
        inBlock = false;
        index = end + 2;
        continue;
      }
      const start = line.indexOf("/*", index);
      if (start === -1) {
        code += line.slice(index);
        break;
      }
      code += line.slice(index, start);
      inBlock = true;
      index = start + 2;
    }
    if (code.trim() !== "") count += 1;
  }
  return count;
}

const files = [];
for (const dir of ["src", "webview"]) {
  walk(path.join(root, dir), files);
}

const failures = [];
const usedExceptions = new Set();

for (const file of files) {
  const rel = relative(file);
  const ext = path.extname(file);
  const isTypeScript = ext === ".ts" || ext === ".tsx";
  const isCss = ext === ".css";
  if (!isTypeScript && !isCss) continue;
  const source = fs.readFileSync(file, "utf8");
  const limit = isCss ? cssLimit : tsLimit;
  const code = isCss ? cssCodeLines(source) : typescriptCodeLines(file, source);
  const physical = physicalLines(source);
  const reason = exceptions.get(rel);
  if (reason !== undefined) {
    usedExceptions.add(rel);
    if (code <= limit) {
      failures.push(`${rel} is ${code} code lines, under the limit of ${limit}. Remove its size exception.`);
    } else {
      console.log(`exception ${rel}: ${code} code lines / ${physical} physical (limit ${limit}). ${reason}`);
    }
    continue;
  }
  if (code > limit) {
    failures.push(`${rel} has ${code} code lines (limit ${limit}, ${physical} physical).`);
  }
}

for (const rel of exceptions.keys()) {
  if (!usedExceptions.has(rel)) {
    failures.push(`${rel} is listed as a size exception but was not found under src/ or webview/.`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(failure);
  process.exit(1);
}

console.log(`check-file-sizes: ok (${usedExceptions.size} documented exception${usedExceptions.size === 1 ? "" : "s"})`);
