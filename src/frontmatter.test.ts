import { describe, expect, it } from "vitest";
import { parseFrontmatter } from "./frontmatter";

describe("parseFrontmatter", () => {
  it("returns empty fields when there is no frontmatter", () => {
    expect(parseFrontmatter("# just a title\n")).toEqual({ name: "", description: "" });
  });

  it("does not throw on malformed YAML and reports the file line", () => {
    const result = parseFrontmatter(`---
name: [broken
description: this yaml is invalid
---

# Broken
`);
    expect(result.name).toBe("");
    expect(result.description).toBe("");
    expect(result.error).toMatch(/Invalid YAML frontmatter at line 3/);
    expect(result.error).not.toMatch(/name: \[broken/);
  });

  it("reports a missing closing fence", () => {
    const result = parseFrontmatter("---\nname: unclosed\ndescription: missing\n\n## Instructions\n1. Read\n");
    expect(result.error).toMatch(/missing its closing ---/);
    expect(result.name).toBe("");
  });

  it.each(["just a string", "42", "true", "null"])("warns when frontmatter is the scalar %s", (body) => {
    expect(parseFrontmatter(`---\n${body}\n---\n`).error).toMatch(/mapping, not a single value/);
  });

  it("leaves an empty frontmatter document without an error", () => {
    expect(parseFrontmatter("---\n\n---\n")).toEqual({ name: "", description: "" });
  });

  it("reports a YAML list with the same mapping warning", () => {
    expect(parseFrontmatter("---\n- alpha\n- beta\n---\n")).toEqual({
      name: "",
      description: "",
      error: "YAML frontmatter must be a mapping, not a single value.",
    });
  });

  it("keeps the name when a BOM precedes the fence", () => {
    expect(parseFrontmatter("\uFEFF---\nname: bom-skill\ndescription: kept\n---\n")).toMatchObject({
      name: "bom-skill",
      description: "kept",
    });
  });

  it("keeps the name when a CRLF file starts with a BOM", () => {
    expect(parseFrontmatter("\uFEFF---\r\nname: bom-skill\r\ndescription: kept\r\n---\r\n")).toMatchObject({
      name: "bom-skill",
      description: "kept",
    });
  });
});
