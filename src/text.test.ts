import { expect, it } from "vitest";
import { firstLine, stripFrontmatter } from "./text";

it("strips a frontmatter block that starts with a UTF-8 BOM", () => {
  const text = "\uFEFF---\r\nname: bom-skill\r\ndescription: kept\r\n---\r\n\n# Title\n\nRead the ticket.\n";
  expect(stripFrontmatter(text)).toBe("\n# Title\n\nRead the ticket.\n");
});

it("drops a BOM when the text has no frontmatter", () => {
  expect(stripFrontmatter("\uFEFFRead the ticket.\n")).toBe("Read the ticket.\n");
});

it("keeps the first prose line and skips a heading and a fence", () => {
  expect(firstLine("# Title\n\n---\nBody")).toBe("Body");
  expect(firstLine("\n# Title\n\nRead the ticket.\n")).toBe("Read the ticket.");
});
