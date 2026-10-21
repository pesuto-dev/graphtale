import { expect, it } from "vitest";
import { matchHeading } from "./procedureLines";

const LEGACY_HEADING = /^(#{1,6})\s+(.+?)\s*#*$/;
const ALPHABET = ["#", " ", "\t", "a", "\r", "\u2028", "\u00a0"];

function* lines(maxLength: number): Generator<string> {
  let layer = [""];
  for (let length = 0; length <= maxLength; length++) {
    yield* layer;
    layer = layer.flatMap((prefix) => ALPHABET.map((char) => prefix + char));
  }
}

it("matches the legacy heading regex on every short line", () => {
  const mismatches: string[] = [];
  for (const line of lines(6)) {
    const legacy = LEGACY_HEADING.exec(line);
    const expected = legacy ? { level: legacy[1].length, title: legacy[2] } : undefined;
    const actual = matchHeading(line);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) mismatches.push(JSON.stringify(line));
  }
  expect(mismatches.slice(0, 10)).toEqual([]);
});

it("drops closing hashes, also a trailing hash without a space, like the legacy regex", () => {
  expect(matchHeading("## Steps ##")).toEqual({ level: 2, title: "Steps" });
  expect(matchHeading("# C#")).toEqual({ level: 1, title: "C" });
  expect(matchHeading("####### Too deep")).toBeUndefined();
});

it("reads a very long heading line in linear time", () => {
  const line = `# a${" ".repeat(200_000)}#z`;
  const started = performance.now();
  expect(matchHeading(line)?.title.endsWith("#z")).toBe(true);
  expect(performance.now() - started).toBeLessThan(200);
});
