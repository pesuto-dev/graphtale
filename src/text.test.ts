import { expect, it } from "vitest";
import { firstLine, stripFrontmatter } from "./text";

it("strips a frontmatter block that starts with a UTF-8 BOM", () => {
  const text = "\uFEFF---\r\nname: bom-skill\r\ndescription: kept\r\n---\r\n\n# Title\n\nRead the ticket.\n";
  expect(stripFrontmatter(text)).toBe("\n# Title\n\nRead the ticket.\n");
  expect(firstLine(stripFrontmatter(text))).toBe("Read the ticket.");
});

it("leaves text without frontmatter unchanged aside from a BOM", () => {
  expect(stripFrontmatter("\uFEFFRead the ticket.\n")).toBe("Read the ticket.\n");
  expect(firstLine("# Title\n\n---\nBody")).toBe("Body");
});
