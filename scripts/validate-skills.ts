/**
 * Discover skill roots and report YAML / frontmatter issues without aborting.
 *
 *   npx tsx scripts/validate-skills.ts
 *   npx tsx scripts/validate-skills.ts --fixtures
 *
 * Exit 1 only on yaml/io errors. Missing name/description are warnings.
 */
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  defaultFixtureRoots,
  formatValidationReport,
  hasBlockingIssues,
  validateSkills,
} from "../src/validate.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = defaultFixtureRoots(repoRoot);
const emptyHome = path.join(repoRoot, "fixtures", "empty-home");

const report = validateSkills({
  workspaceFolders: fixtures.workspaceFolders,
  extraSkillRoots: fixtures.extraSkillRoots,
  homedir: emptyHome,
});

console.log(formatValidationReport(report));

if (hasBlockingIssues(report.issues)) {
  process.exit(1);
}
