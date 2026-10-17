import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");

/** Ship paths from an ignore file. The npm-only directory reopen is not a path. */
function shipPatterns(name: string): string[] {
  return fs
    .readFileSync(path.join(root, name), "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("!") && line !== "!*/")
    .map((line) => line.slice(1).replace(/^\//, ""))
    .sort();
}

function lines(name: string): string[] {
  return fs
    .readFileSync(path.join(root, name), "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

const mediaDir = ["docs", "media"].join("/");
const mediaTree = `${mediaDir}/${"*".repeat(2)}`;
const docsTree = `docs/${"*".repeat(2)}`;

function ignoresMedia(name: string): boolean {
  return lines(name).some((line) => line === mediaDir || line === `${mediaDir}/` || line === mediaTree);
}

function reincludesMedia(name: string): boolean {
  return shipPatterns(name).some((line) => line === mediaDir || line.startsWith(`${mediaDir}/`) || line === docsTree);
}

describe("package ignore lists", () => {
  it("ships the same paths from .npmignore and .vscodeignore", () => {
    expect(shipPatterns(".npmignore")).toEqual(shipPatterns(".vscodeignore"));
  });

  it("keeps docs/media out of both packages", () => {
    for (const name of [".npmignore", ".vscodeignore"]) {
      expect(ignoresMedia(name)).toBe(true);
      expect(reincludesMedia(name)).toBe(false);
    }
  });
});
