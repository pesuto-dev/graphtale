import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, expect, it } from "vitest";
import { ownershipFacts } from "./repairOwnership";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function home(): string {
  // Not resolved on purpose: on macOS the temp folder sits under the /var link, which must not count.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "repair-owner-"));
  roots.push(root);
  return root;
}

function writeSkill(dir: string): string {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "SKILL.md"), "# Skill\n");
  return path.join(dir, "SKILL.md");
}

it("says nothing for a skill the user owns", () => {
  const homedir = home();
  const skillFile = writeSkill(path.join(homedir, ".cursor", "skills", "mine"));
  expect(ownershipFacts({ skillName: "mine", skillFile, catalog: [], homedir })).toEqual([]);
});

it("points a linked skill to its real file", () => {
  const homedir = home();
  writeSkill(path.join(homedir, ".agents", "skills", "linked"));
  fs.mkdirSync(path.join(homedir, ".claude", "skills"), { recursive: true });
  fs.symlinkSync(path.join(homedir, ".agents", "skills", "linked"), path.join(homedir, ".claude", "skills", "linked"));
  const facts = ownershipFacts({ skillName: "linked", skillFile: path.join(homedir, ".claude", "skills", "linked", "SKILL.md"), catalog: [], homedir });
  expect(facts).toContain(`- The skill file is a link. Edit the real file: ${fs.realpathSync(path.join(homedir, ".agents", "skills", "linked", "SKILL.md"))}`);
});

it("names the upstream source of a skill installed by the skills CLI", () => {
  const homedir = home();
  const skillFile = writeSkill(path.join(homedir, ".agents", "skills", "to-prd"));
  const lock = { version: 3, skills: { "to-prd": { source: "someone/skills", sourceUrl: "https://example.test/skills.git", skillPath: "skills/to-prd/SKILL.md" } } };
  fs.writeFileSync(path.join(homedir, ".agents", ".skill-lock.json"), JSON.stringify(lock));
  const facts = ownershipFacts({ skillName: "to-prd", skillFile, catalog: [], homedir }).join("\n");
  expect(facts).toContain("installed from someone/skills by the skills CLI");
  expect(facts).toContain("repair it upstream (https://example.test/skills.git, file skills/to-prd/SKILL.md)");
});

it("names another copy with the same skill name", () => {
  const homedir = home();
  const skillFile = writeSkill(path.join(homedir, ".claude", "skills", "herdr"));
  const other = path.join(homedir, ".codex", "skills", "herdr");
  writeSkill(other);
  const catalog = [skillFile, path.join(other, "SKILL.md")].map((file) => ({ id: file, name: "herdr", description: "", rootPath: path.dirname(file) }));
  const facts = ownershipFacts({ skillName: "herdr", skillFile, catalog, homedir });
  expect(facts).toContain(`- Another copy of this skill exists: ${fs.realpathSync(path.join(other, "SKILL.md"))}. Ask the user whether to apply the same repair there.`);
});

it("warns about an install folder even without a lock entry", () => {
  const homedir = home();
  const skillFile = writeSkill(path.join(homedir, ".agents", "skills", "unknown"));
  const facts = ownershipFacts({ skillName: "unknown", skillFile, catalog: [], homedir }).join("\n");
  expect(facts).toContain("where the skills CLI installs skills. An update may overwrite local edits.");
});

it("finds the lock entry by folder name when the frontmatter name differs", () => {
  const homedir = home();
  const skillFile = writeSkill(path.join(homedir, ".agents", "skills", "folder-name"));
  const lock = { skills: { "folder-name": { source: "someone/skills", sourceUrl: "https://example.test/s.git", skillPath: "s/SKILL.md" } } };
  fs.writeFileSync(path.join(homedir, ".agents", ".skill-lock.json"), JSON.stringify(lock));
  expect(ownershipFacts({ skillName: "Other Name", skillFile, catalog: [], homedir }).join("\n")).toContain("installed from someone/skills");
});
