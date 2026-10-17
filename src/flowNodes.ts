import * as path from "node:path";
import type { SkillNode } from "./shared/protocol";
import { firstLine, stripFrontmatter } from "./text";

/** The SKILL.md entry shared by ordered flows and the heading fallback. */
export function skillDocumentNode(skillFile: string, skillText: string): SkillNode {
  return {
    id: "skill-md",
    label: "SKILL.md",
    kind: "skill",
    path: skillFile,
    source: { path: skillFile, startLine: 1, endLine: 1 },
    summary: firstLine(stripFrontmatter(skillText)),
    uses: [],
    isEntry: true,
  };
}

/** A linked workflow or operations file that holds the detected steps. */
export function procedureSourceNode(sourcePath: string, sourceText: string): SkillNode {
  return {
    id: "procedure-source",
    label: path.basename(sourcePath),
    kind: "reference",
    path: sourcePath,
    source: { path: sourcePath, startLine: 1, endLine: 1 },
    summary: firstLine(stripFrontmatter(sourceText)) || "Flow source",
    excerpt: sourceText.slice(0, 4000),
    uses: [],
  };
}
