import * as os from "node:os";
import * as path from "node:path";
import type { CatalogSkill, SkillEdge, SkillGraph, SkillNode } from "./shared/protocol";
import { parseFrontmatter } from "./frontmatter";
import { INVENTORY_MAX_FILES, readRequiredText } from "./fileAccess";
import { addDispatchedAgents, addMarkdownLinks, addSkillMentions } from "./skillLinks";
import { ENTRY_ID, addFolderFiles, usesFor } from "./skillPaths";
import { firstParagraph, stripFrontmatter } from "./text";

export { wrapperAroundLink } from "./skillLinks";

export type ParseOptions = {
  skillRoot: string;
  catalog: CatalogSkill[];
  homedir?: string;
};

export function parseSkill(options: ParseOptions): SkillGraph {
  const homedir = options.homedir ?? os.homedir();
  const skillRoot = path.resolve(options.skillRoot);
  const skillFile = path.join(skillRoot, "SKILL.md");
  const skillText = readRequiredText(skillFile);
  const meta = parseFrontmatter(skillText);
  const folderName = path.basename(skillRoot);
  const skillName = meta.name || folderName;
  const nodes = new Map<string, SkillNode>();
  const edges: SkillEdge[] = [];
  const warnings: string[] = [];

  nodes.set(ENTRY_ID, {
    id: ENTRY_ID,
    label: "SKILL.md",
    kind: "skill",
    path: skillFile,
    summary: firstParagraph(stripFrontmatter(skillText)) || meta.description,
    uses: [],
    isEntry: true,
  });

  addMarkdownLinks(skillText, skillRoot, homedir, nodes, edges, warnings);
  addFolderFiles(skillRoot, "prompts", "agent", true, nodes, edges, warnings);
  addFolderFiles(skillRoot, "references", "reference", false, nodes, edges, warnings);
  addFolderFiles(skillRoot, "scripts", "script", false, nodes, edges, warnings);
  addFolderFiles(skillRoot, "agents", undefined, false, nodes, edges, warnings);
  addDispatchedAgents(skillText, skillRoot, homedir, nodes, edges, warnings);
  addSkillMentions(skillText, skillName, options.catalog, nodes, edges);
  if (nodes.size >= INVENTORY_MAX_FILES) warnings.push(`Catalog stopped after ${INVENTORY_MAX_FILES} files.`);

  for (const node of nodes.values()) {
    node.uses = usesFor(node.id, edges, nodes);
  }

  return {
    skillId: skillName,
    skillName,
    rootPath: skillRoot,
    nodes: [...nodes.values()],
    edges,
    warnings: [...new Set(warnings)],
  };
}
