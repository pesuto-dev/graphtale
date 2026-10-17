import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { excludesMedia, shipPatterns } from "./packageIgnore";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function ignoreText(name: string): string {
  return fs.readFileSync(path.join(root, name), "utf8");
}

describe("shipPatterns", () => {
  it("normalizes negated paths and drops comments", () => {
    const text = ["# note", "*", "!*/", "!/README.md", "!docs/install.md", ""].join("\n");
    expect(shipPatterns(text)).toEqual(["README.md", "docs/install.md"]);
  });

  it("lists the same ship paths for npm and the VSIX", () => {
    expect(shipPatterns(ignoreText(".npmignore"))).toEqual(shipPatterns(ignoreText(".vscodeignore")));
  });
});

describe("excludesMedia", () => {
  it("accepts an explicit docs/media exclusion", () => {
    const stars = "*".repeat(2);
    expect(excludesMedia(`**\ndocs/media/${stars}\n!README.md\n`)).toBe(true);
  });

  it("rejects a list that ships all of docs", () => {
    const star = "*";
    expect(excludesMedia(`docs/media/\n!docs/${star}${star}\n`)).toBe(false);
  });

  it("rejects a list with no docs/media exclusion", () => {
    expect(excludesMedia("**\n!README.md\n")).toBe(false);
  });

  it("keeps docs/media out of the npm package", () => {
    expect(excludesMedia(ignoreText(".npmignore"))).toBe(true);
  });

  it("keeps docs/media out of the VSIX", () => {
    expect(excludesMedia(ignoreText(".vscodeignore"))).toBe(true);
  });
});
