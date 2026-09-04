import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { discoverSkills, parseFrontmatter, skillLocationLabel } from "./discover";

function writeSkill(root: string, files: Record<string, string>): void {
  for (const [rel, body] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body, "utf8");
  }
}

describe("parseFrontmatter", () => {
  it("returns empty fields when there is no frontmatter", () => {
    expect(parseFrontmatter("# just a title\n")).toEqual({ name: "", description: "" });
  });

  it("does not throw on malformed YAML and reports an error", () => {
    const result = parseFrontmatter(`---
name: [broken
description: this yaml is invalid
---

# Broken
`);
    expect(result.name).toBe("");
    expect(result.description).toBe("");
    expect(result.error).toMatch(/YAML|Nesting|Unexpected|flow/i);
  });
});

describe("discoverSkills", () => {
  it("keeps listing a skill when frontmatter YAML is invalid", () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "skill-ws-"));
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "skill-home-"));
    writeSkill(workspace, {
      ".claude/skills/broken/SKILL.md": `---
name: [broken
description: this yaml is invalid
---

# Broken
`,
    });

    const skills = discoverSkills({ workspaceFolders: [workspace], homedir: home });
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("broken");
    expect(skills[0].frontmatterError).toBeTruthy();
    expect(skills[0].description).toMatch(/Invalid SKILL.md frontmatter/);
  });

  it("finds user-level ~/.agents/skills", () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "skill-ws-"));
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "skill-home-"));
    writeSkill(home, {
      ".agents/skills/vendor-skill/SKILL.md": `---
name: vendor-skill
description: Marketplace-style skill under ~/.agents/skills.
---

# vendor
`,
    });

    const skills = discoverSkills({ workspaceFolders: [workspace], homedir: home });
    expect(skills.map((s) => s.name)).toContain("vendor-skill");
  });

  it("lists Codex and Claude copies separately when both exist", () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "skill-ws-"));
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "skill-home-"));
    writeSkill(home, {
      ".codex/skills/dup/SKILL.md": `---
name: dup
description: Canonical Codex copy.
---
`,
      ".claude/skills/dup/SKILL.md": `---
name: dup
description: Legacy Claude copy.
---
`,
    });

    const skills = discoverSkills({ workspaceFolders: [workspace], homedir: home });
    const dups = skills.filter((s) => s.name === "dup");
    expect(dups).toHaveLength(2);
    expect(dups.some((s) => s.rootPath.includes(`${path.sep}.codex${path.sep}`))).toBe(true);
    expect(dups.some((s) => s.rootPath.includes(`${path.sep}.claude${path.sep}`))).toBe(true);
  });
});

describe("skillLocationLabel", () => {
  it("shortens home paths and workspace-relative paths", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "skill-home-"));
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "skill-ws-"));
    expect(
      skillLocationLabel(path.join(home, ".codex", "skills", "foo"), {
        homedir: home,
        workspaceFolders: [workspace],
      }),
    ).toBe("~/.codex/skills/foo");
    expect(
      skillLocationLabel(path.join(workspace, ".cursor", "skills", "bar"), {
        homedir: home,
        workspaceFolders: [workspace],
      }),
    ).toBe(".cursor/skills/bar");
  });
});
