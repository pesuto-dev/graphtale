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

  it("reports a scalar document and leaves an empty document alone", () => {
    for (const body of ["just a string", "42", "true", "null"]) {
      expect(parseFrontmatter(`---\n${body}\n---\n`).error).toMatch(/mapping, not a single value/);
    }
    expect(parseFrontmatter("---\n\n---\n")).toEqual({ name: "", description: "" });
  });

  it("reports a YAML list with the same mapping warning", () => {
    expect(parseFrontmatter("---\n- alpha\n- beta\n---\n")).toEqual({
      name: "",
      description: "",
      error: "YAML frontmatter must be a mapping, not a single value.",
    });
  });

  it("keeps the name when a BOM precedes the fence, including CRLF", () => {
    const fields = { name: "bom-skill", description: "kept" };
    expect(parseFrontmatter("\uFEFF---\nname: bom-skill\ndescription: kept\n---\n")).toMatchObject(fields);
    expect(parseFrontmatter("\uFEFF---\r\nname: bom-skill\r\ndescription: kept\r\n---\r\n")).toMatchObject(fields);
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

  it("discovers symlinked skill directories and deduplicates their real target", () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "skill-ws-"));
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "skill-home-"));
    const target = path.join(home, ".agents", "skills", "plugin-skill");
    const claudeRoot = path.join(home, ".claude", "skills");
    writeSkill(target, {
      "SKILL.md": `---
name: plugin-skill
description: Installed by a plugin.
---
`,
    });
    fs.mkdirSync(claudeRoot, { recursive: true });
    fs.symlinkSync(target, path.join(claudeRoot, "plugin-skill"), "dir");

    const skills = discoverSkills({ workspaceFolders: [workspace], homedir: home });
    const matches = skills.filter((skill) => skill.name === "plugin-skill");
    expect(matches).toHaveLength(1);
    expect(matches[0].rootPath).toBe(path.join(home, ".claude", "skills", "plugin-skill"));
  });

  it("discovers skills from installed Claude plugins", () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "skill-ws-"));
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "skill-home-"));
    const installPath = path.join(home, ".claude", "plugins", "cache", "example-marketplace", "example-tools", "1.0.0");
    writeSkill(installPath, {
      "skills/plugin-skill/SKILL.md": `---
name: plugin-skill
description: Installed Claude plugin skill.
---
`,
    });
    writeSkill(home, {
      ".claude/plugins/installed_plugins.json": JSON.stringify({
        version: 2,
        plugins: {
          "example-tools@example-marketplace": [{ scope: "user", installPath }],
        },
      }),
    });

    const skills = discoverSkills({ workspaceFolders: [workspace], homedir: home });
    expect(skills.find((skill) => skill.name === "plugin-skill")?.rootPath)
      .toBe(path.join(installPath, "skills", "plugin-skill"));
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
