import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseProcedure } from "./parseProcedure";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function parse(skill: string) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "frontmatter-"));
  roots.push(root);
  fs.writeFileSync(path.join(root, "SKILL.md"), skill);
  const result = parseProcedure({ skillRoot: root, catalog: [] });
  const steps = result.graph.nodes.filter((node) => node.id.startsWith("step:")).map((node) => node.label);
  return { result, steps };
}

const instructions = `
## Instructions

1. Read the ticket
2. Reply
`;

describe("flow frontmatter diagnosis", () => {
  it("warns when the closing --- is missing and still reads the instructions", () => {
    const { result, steps } = parse(`---
name: unclosed
description: missing closer
${instructions}`);
    expect(steps).toEqual(["1. Read the ticket", "2. Reply"]);
    expect(result.diagnosis.confidence).toBe("partial");
    expect(result.diagnosis.message).toMatch(/SKILL\.md: Frontmatter is missing its closing ---/);
    expect(result.graph.warnings).toContain("SKILL.md: Frontmatter is missing its closing ---.");
  });

  it("includes broken YAML in the flow diagnosis with a line number and without the source line", () => {
    const { result, steps } = parse(`---
name: [broken
description: this yaml is invalid
---
${instructions}`);
    expect(steps).toEqual(["1. Read the ticket", "2. Reply"]);
    expect(result.diagnosis.confidence).toBe("partial");
    expect(result.diagnosis.message).toMatch(/SKILL\.md: Invalid YAML frontmatter at line 3/);
    expect(result.diagnosis.message).not.toMatch(/name: \[broken/);
    expect(result.graph.warnings?.join("\n")).toMatch(/line 3/);
    expect(result.graph.warnings?.join("\n")).not.toMatch(/name: \[broken/);
  });

  it("warns when YAML frontmatter is only a scalar", () => {
    const { result, steps } = parse(`---
just a string
---
${instructions}`);
    expect(steps).toEqual(["1. Read the ticket", "2. Reply"]);
    expect(result.diagnosis.confidence).toBe("partial");
    expect(result.diagnosis.message).toMatch(/YAML frontmatter must be a mapping, not a single value/);
    expect(result.graph.warnings).toContain("SKILL.md: YAML frontmatter must be a mapping, not a single value.");
  });

  it("keeps the frontmatter name when a BOM precedes the fence", () => {
    const { result, steps } = parse(`\uFEFF---
name: bom-skill
description: kept
## 1. Hidden heading
---
${instructions}`);
    expect(result.graph.skillName).toBe("bom-skill");
    expect(steps).toEqual(["1. Read the ticket", "2. Reply"]);
    expect(result.diagnosis.confidence).toBe("high");
    expect(result.graph.warnings).toEqual([]);
  });

  it("keeps the frontmatter name for a CRLF file with a BOM", () => {
    const skill = [
      "\uFEFF---",
      "name: bom-skill",
      "description: kept",
      "## 1. Hidden heading",
      "---",
      "",
      "## Instructions",
      "",
      "1. Read the ticket",
      "2. Reply",
      "",
    ].join("\r\n");
    const { result, steps } = parse(skill);
    expect(result.graph.skillName).toBe("bom-skill");
    expect(steps).toEqual(["1. Read the ticket", "2. Reply"]);
    expect(result.diagnosis.confidence).toBe("high");
    expect(result.graph.warnings).toEqual([]);
  });
});
