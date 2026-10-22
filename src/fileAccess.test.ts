import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, expect, it } from "vitest";
import { INPUT_READ_LIMIT_BYTES, INVENTORY_MAX_FILES, readJsonFile, readRequiredText, readTextFile, walkTextFiles } from "./fileAccess";
import { parseSkill } from "./parseSkill";
import { parseProcedure } from "./parseProcedure";
const roots: string[] = [];
function root() { const value = fs.mkdtempSync(path.join(os.tmpdir(), "bounded-")); roots.push(value); return value; }
afterEach(() => roots.splice(0).forEach(value => fs.rmSync(value, { recursive: true, force: true })));
it("bounds reads, rejects invalid roots and does not preview binary content", () => {
  const dir = root(), file = path.join(dir, "SKILL.md");
  fs.writeFileSync(file, "x".repeat(INPUT_READ_LIMIT_BYTES + 1));
  expect(() => readRequiredText(file)).toThrow(/limit/);
  expect(readTextFile(file, 64).text).toHaveLength(64);
  expect(readTextFile(file, 64).warning).toMatch(/truncated/);
  expect(() => parseSkill({ skillRoot: dir, catalog: [] })).toThrow();
  fs.writeFileSync(file, Buffer.from([0, 1, 2]));
  expect(readTextFile(file, 64)).toMatchObject({ text: "", warning: expect.stringMatching(/binary/) });
  fs.unlinkSync(file);
  expect(() => parseSkill({ skillRoot: dir, catalog: [] })).toThrow(/read/);
});
it("reports missing linked assets and truncated workflow input", () => {
  const dir = root();
  fs.writeFileSync(path.join(dir, "SKILL.md"), "## Instructions\n1. Read [asset](gone.md)\n2. Finish\n[workflow](workflow.md)");
  fs.writeFileSync(path.join(dir, "workflow.md"), "## 1. Read\n## 2. Finish\n" + "x".repeat(INPUT_READ_LIMIT_BYTES));
  expect(parseSkill({ skillRoot: dir, catalog: [] }).warnings?.join()).toMatch(/unavailable/);
  const result = parseProcedure({ skillRoot: dir, catalog: [] });
  expect(result.diagnosis.confidence).toBe("partial");
  expect(result.graph.warnings?.join()).toMatch(/truncated/);
});
it("limits inventory depth and file count", () => {
  const dir = root();
  const deep = path.join(dir, ...Array(12).fill("nested")); fs.mkdirSync(deep, { recursive: true });
  fs.writeFileSync(path.join(deep, "hidden.md"), "hidden");
  expect(walkTextFiles(dir).warnings.join()).toMatch(/depth/);
  for (let i = 0; i <= INVENTORY_MAX_FILES; i++) fs.writeFileSync(path.join(dir, `${i}.md`), "x");
  expect(walkTextFiles(dir).files).toHaveLength(INVENTORY_MAX_FILES);
  expect(walkTextFiles(dir).warnings.join()).toMatch(/stopped/);
});
it("reads JSON only from a regular file within the limit", () => {
  const dir = root();
  const file = path.join(dir, "lock.json");
  fs.writeFileSync(file, "{\"ok\":true}");
  expect(readJsonFile(file)).toEqual({ ok: true });
  expect(readJsonFile(dir)).toBeUndefined();
  fs.writeFileSync(file, "x".repeat(INPUT_READ_LIMIT_BYTES + 1));
  expect(readJsonFile(file)).toBeUndefined();
});
