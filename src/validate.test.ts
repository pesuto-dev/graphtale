import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertPinnedYaml,
  defaultFixtureRoots,
  extraRootsFromTree,
  hasBlockingIssues,
  validateSkills,
} from "./validate";

function writeSkill(root: string, files: Record<string, string>): void {
  for (const [rel, body] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body, "utf8");
  }
}

describe("validateSkills", () => {
  it("uses the pinned yaml package", () => {
    expect(assertPinnedYaml()).toMatch(/node_modules[/\\]yaml/);
  });

  it("reports YAML errors without dropping the rest of the catalog", () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "skill-val-"));
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "skill-home-"));
    writeSkill(workspace, {
      ".claude/skills/ok/SKILL.md": `---
name: ok
description: Fine.
---

# ok
`,
      ".claude/skills/broken/SKILL.md": `---
name: [broken
description: this yaml is invalid
---

# Broken
`,
    });

    const report = validateSkills({ workspaceFolders: [workspace], homedir: home });
    expect(report.skills.map((s) => s.name).sort()).toEqual(["broken", "ok"]);
    expect(report.issues.some((i) => i.kind === "yaml" && i.skillRoot.endsWith("broken"))).toBe(
      true,
    );
    expect(hasBlockingIssues(report.issues)).toBe(true);
  });

  it("skips malformed* folders when walking a fixture tree", () => {
    const tree = path.resolve(__dirname, "../fixtures/public-skills");
    const roots = extraRootsFromTree(tree);
    expect(roots.some((r) => r.endsWith("malformed-yaml"))).toBe(false);
    expect(roots.some((r) => r.endsWith("prose-only"))).toBe(true);
  });

  it("validates committed fixtures without blocking YAML errors", () => {
    const repoRoot = path.resolve(__dirname, "..");
    const fixtures = defaultFixtureRoots(repoRoot);
    const report = validateSkills({
      workspaceFolders: fixtures.workspaceFolders,
      extraSkillRoots: fixtures.extraSkillRoots,
      homedir: path.join(repoRoot, "fixtures/empty-home"),
    });
    expect(report.skills.length).toBeGreaterThan(4);
    expect(hasBlockingIssues(report.issues)).toBe(false);
  });
});
