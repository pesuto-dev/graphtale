import * as fs from "node:fs";
import * as path from "node:path";
import { parse as parseYaml } from "yaml";
import {
  discoverSkills,
  readFrontmatter,
  type DiscoverOptions,
} from "./discover";
import { parseFrontmatter } from "./frontmatter";
import type { CatalogSkill } from "./shared/protocol";

export type ValidationKind = "yaml" | "io" | "name" | "description";

export type ValidationIssue = {
  skillRoot: string;
  skillFile: string;
  kind: ValidationKind;
  message: string;
};

export type ValidationReport = {
  skills: CatalogSkill[];
  issues: ValidationIssue[];
};

const YAML_PKG = "yaml";

/** Same parser the catalog uses. Fail the process if a different `yaml` is resolved. */
export function assertPinnedYaml(): string {
  const resolved = require.resolve(YAML_PKG);
  parseYaml("name: pin-check");
  return resolved;
}

/**
 * Discover skills and collect frontmatter problems without aborting the catalog.
 * Extra skill roots (a folder with SKILL.md) are validated even outside standard locations.
 */
export function validateSkills(
  options: DiscoverOptions & { extraSkillRoots?: string[] },
): ValidationReport {
  const skills = discoverSkills(options);
  const issues: ValidationIssue[] = [];
  const seen = new Set(skills.map((skill) => path.resolve(skill.rootPath)));

  for (const skill of skills) {
    issues.push(...issuesForSkill(skill.rootPath));
  }

  for (const extra of options.extraSkillRoots ?? []) {
    const root = path.resolve(extra);
    if (seen.has(root) || !fs.existsSync(path.join(root, "SKILL.md"))) {
      continue;
    }
    seen.add(root);
    const skillFile = path.join(root, "SKILL.md");
    const meta = readFrontmatter(skillFile);
    const catalogSkill: CatalogSkill = {
      id: meta.name || path.basename(root),
      name: meta.name || path.basename(root),
      description: meta.error ? `Invalid SKILL.md frontmatter: ${meta.error}` : meta.description,
      rootPath: root,
      frontmatterError: meta.error,
    };
    skills.push(catalogSkill);
    issues.push(...issuesForSkill(root));
  }

  skills.sort((a, b) => a.name.localeCompare(b.name));
  return { skills, issues };
}

/** Walk a workspace-like tree plus loose skill folders used as fixtures. */
export function extraRootsFromTree(tree: string): string[] {
  const roots: string[] = [];
  if (!fs.existsSync(tree)) {
    return roots;
  }
  const skillFile = path.join(tree, "SKILL.md");
  if (fs.existsSync(skillFile)) {
    roots.push(tree);
    return roots;
  }
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(tree, { withFileTypes: true });
  } catch {
    return roots;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith("malformed")) {
      continue;
    }
    roots.push(...extraRootsFromTree(path.join(tree, entry.name)));
  }
  return roots;
}

export function defaultFixtureRoots(repoRoot: string): {
  workspaceFolders: string[];
  extraSkillRoots: string[];
} {
  const fixtures = path.join(repoRoot, "fixtures");
  return {
    workspaceFolders: [path.join(fixtures, "project")],
    extraSkillRoots: [
      path.join(fixtures, "analyse-ticket"),
      path.join(fixtures, "analyse-ticket-pn"),
      ...extraRootsFromTree(path.join(fixtures, "public-skills")),
      ...extraRootsFromTree(path.join(fixtures, "demo-skills")),
      ...extraRootsFromTree(path.join(fixtures, "parser-regressions")),
      ...extraRootsFromTree(path.join(fixtures, "release-samples")),
    ],
  };
}

export function formatValidationReport(report: ValidationReport): string {
  const lines = [
    `Skills: ${report.skills.length}`,
    `Issues: ${report.issues.length}`,
    `yaml parser: ${assertPinnedYaml()}`,
  ];
  for (const issue of report.issues) {
    lines.push(`${issue.kind}\t${issue.skillFile}\t${issue.message}`);
  }
  return lines.join("\n");
}

export function hasBlockingIssues(issues: ValidationIssue[]): boolean {
  return issues.some((issue) => issue.kind === "yaml" || issue.kind === "io");
}

function issuesForSkill(skillRoot: string): ValidationIssue[] {
  const skillFile = path.join(skillRoot, "SKILL.md");
  const issues: ValidationIssue[] = [];
  const meta = readFrontmatter(skillFile);
  if (meta.error) {
    issues.push({
      skillRoot,
      skillFile,
      kind: meta.error.includes("read") ? "io" : "yaml",
      message: meta.error,
    });
    return issues;
  }
  const parsed = parseFrontmatter(fs.existsSync(skillFile) ? fs.readFileSync(skillFile, "utf8") : "");
  if (!parsed.name) {
    issues.push({
      skillRoot,
      skillFile,
      kind: "name",
      message: "Frontmatter name is missing (folder name is used in the catalog).",
    });
  }
  if (!parsed.description) {
    issues.push({
      skillRoot,
      skillFile,
      kind: "description",
      message: "Frontmatter description is missing.",
    });
  }
  return issues;
}
