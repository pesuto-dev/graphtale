import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type {
  CatalogSkill,
  NodeKind,
  SkillEdge,
  SkillGraph,
  SkillNode,
  UseChip,
} from "./shared/protocol";
import { parseFrontmatter } from "./discover";

const ENTRY_ID = "skill-md";
const LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;

export type ParseOptions = {
  skillRoot: string;
  catalog: CatalogSkill[];
  homedir?: string;
};

export function parseSkill(options: ParseOptions): SkillGraph {
  const homedir = options.homedir ?? os.homedir();
  const skillRoot = path.resolve(options.skillRoot);
  const skillFile = path.join(skillRoot, "SKILL.md");
  if (!fs.existsSync(skillFile)) {
    throw new Error(`No SKILL.md in ${skillRoot}`);
  }

  const skillText = fs.readFileSync(skillFile, "utf8");
  const meta = parseFrontmatter(skillText);
  const folderName = path.basename(skillRoot);
  const skillName = meta.name || folderName;
  const nodes = new Map<string, SkillNode>();
  const edges: SkillEdge[] = [];

  nodes.set(ENTRY_ID, {
    id: ENTRY_ID,
    label: "SKILL.md",
    kind: "skill",
    path: skillFile,
    summary: firstParagraph(stripFrontmatter(skillText)) || meta.description,
    uses: [],
    isEntry: true,
  });

  addMarkdownLinks(skillText, skillRoot, homedir, nodes, edges);
  addFolderFiles(skillRoot, "prompts", "agent", true, nodes, edges);
  addFolderFiles(skillRoot, "references", "reference", false, nodes, edges);
  addFolderFiles(skillRoot, "scripts", "script", false, nodes, edges);
  addFolderFiles(skillRoot, "agents", undefined, false, nodes, edges);
  addDispatchedAgents(skillText, skillRoot, homedir, nodes, edges);
  addSkillMentions(skillText, skillName, options.catalog, nodes, edges);

  for (const node of nodes.values()) {
    node.uses = usesFor(node.id, edges, nodes);
  }

  return {
    skillId: skillName,
    skillName,
    rootPath: skillRoot,
    nodes: [...nodes.values()],
    edges,
  };
}

export function wrapperAroundLink(
  skillText: string,
  href: string,
): { prefix: string; suffix: string } | undefined {
  const idx = skillText.indexOf(`](${href})`);
  if (idx < 0) {
    return undefined;
  }
  const lineStart = skillText.lastIndexOf("\n", idx);
  const lineEnd = skillText.indexOf("\n", idx);
  const start = lineStart < 0 ? 0 : lineStart + 1;
  const end = lineEnd < 0 ? skillText.length : lineEnd;
  return {
    prefix: skillText.slice(0, start).trimEnd(),
    suffix: skillText.slice(end).trimStart(),
  };
}

function addMarkdownLinks(
  skillText: string,
  skillRoot: string,
  homedir: string,
  nodes: Map<string, SkillNode>,
  edges: SkillEdge[],
): void {
  for (const match of skillText.matchAll(LINK_RE)) {
    const href = match[2].trim();
    const resolved = resolveHref(href, skillRoot, homedir);
    if (!resolved) {
      continue;
    }
    addFileNode(resolved, href, skillRoot, false, nodes, edges);
  }
}

function addFolderFiles(
  skillRoot: string,
  folder: string,
  kind: NodeKind | undefined,
  isBlock: boolean,
  nodes: Map<string, SkillNode>,
  edges: SkillEdge[],
): void {
  const dir = path.join(skillRoot, folder);
  if (!isDirectory(dir)) {
    return;
  }
  for (const file of walkFiles(dir)) {
    addFileNode(file, path.relative(skillRoot, file), skillRoot, isBlock, nodes, edges, kind);
  }
}

/**
 * Surface `agent <name>` mentions from SKILL.md / linked workflow as Catalog
 * agent nodes (prompts/ alone misses dispatched `agent <name>` workers).
 */
function addDispatchedAgents(
  skillText: string,
  skillRoot: string,
  homedir: string,
  nodes: Map<string, SkillNode>,
  edges: SkillEdge[],
): void {
  const corpora = [skillText];
  const workflow = catalogWorkflowPath(skillText, skillRoot, homedir);
  if (workflow) {
    try {
      corpora.push(fs.readFileSync(workflow, "utf8"));
    } catch {
      // ignore unreadable workflow
    }
  }

  const seen = new Set<string>();
  for (const text of corpora) {
    for (const match of text.matchAll(/\bagent\s+([A-Za-z0-9][\w-]*)/g)) {
      const name = match[1];
      if (seen.has(name)) {
        continue;
      }
      seen.add(name);

      const resolved = resolveAgentDefinition(name, skillRoot, homedir);
      const id = resolved ? nodeIdFor(resolved, skillRoot) : `agent:${name}`;
      if (nodes.has(id)) {
        const existing = nodes.get(id);
        if (existing && existing.kind !== "agent") {
          existing.kind = "agent";
          existing.isBlock = true;
        }
        continue;
      }

      let summary = `Agent ${name} (referenced in the flow)`;
      let excerpt: string | undefined;
      if (resolved && fs.existsSync(resolved)) {
        const body = fs.readFileSync(resolved, "utf8");
        summary = firstParagraph(stripFrontmatter(body)) || summary;
        excerpt = body.slice(0, 2000);
      }

      nodes.set(id, {
        id,
        label: name,
        kind: "agent",
        path: resolved ?? path.join(skillRoot, "SKILL.md"),
        summary,
        uses: [],
        excerpt,
        isBlock: true,
        inferred: !resolved,
      });
      if (!edges.some((edge) => edge.from === ENTRY_ID && edge.to === id)) {
        edges.push({
          from: ENTRY_ID,
          to: id,
          inferred: true,
          label: "agent",
        });
      }
    }
  }
}

function catalogWorkflowPath(
  skillText: string,
  skillRoot: string,
  homedir: string,
): string | undefined {
  for (const match of skillText.matchAll(LINK_RE)) {
    const href = match[2].trim().split("#")[0];
    if (!/workflow\.md$/i.test(href)) {
      continue;
    }
    const resolved = resolveHref(href, skillRoot, homedir);
    if (resolved && fs.existsSync(resolved)) {
      return resolved;
    }
  }
  for (const candidate of [
    path.join(skillRoot, "workflow.md"),
    path.join(skillRoot, "references", "workflow.md"),
  ]) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function resolveAgentDefinition(
  name: string,
  skillRoot: string,
  homedir: string,
): string | undefined {
  for (const candidate of [
    path.join(skillRoot, "agents", `${name}.md`),
    path.join(skillRoot, "prompts", `${name}.md`),
    path.join(homedir, ".claude", "agents", `${name}.md`),
    path.join(homedir, ".codex", "agents", `${name}.md`),
  ]) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function isCatalogNoise(filePath: string, skillRoot: string): boolean {
  const rel = path.relative(skillRoot, filePath).split(path.sep).join("/");
  const base = path.basename(filePath);
  if (base.endsWith(".pyc") || base === ".DS_Store") {
    return true;
  }
  if (rel.split("/").includes("__pycache__")) {
    return true;
  }
  if (/^migrate[_-]/i.test(base) || /\/migrate[_-]/i.test(rel)) {
    return true;
  }
  if (rel.startsWith("evals/") || rel.includes("/evals/")) {
    return true;
  }
  return false;
}

function addFileNode(
  filePath: string,
  href: string,
  skillRoot: string,
  isBlockHint: boolean,
  nodes: Map<string, SkillNode>,
  edges: SkillEdge[],
  kindOverride?: NodeKind,
): void {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return;
  }
  if (isCatalogNoise(filePath, skillRoot)) {
    return;
  }
  const id = nodeIdFor(filePath, skillRoot);
  if (id === ENTRY_ID) {
    return;
  }
  const kind = kindOverride ?? kindFor(filePath, skillRoot);
  const isBlock = isBlockHint || kind === "agent";
  if (!nodes.has(id)) {
    const text = readText(filePath);
    nodes.set(id, {
      id,
      label: path.basename(filePath),
      kind,
      path: filePath,
      summary: firstParagraph(stripFrontmatter(text)),
      uses: [],
      isBlock,
    });
  }
  if (!edges.some((edge) => edge.from === ENTRY_ID && edge.to === id)) {
    edges.push({
      from: ENTRY_ID,
      to: id,
      label: hrefLabel(href),
    });
  }
}

function addSkillMentions(
  skillText: string,
  selfName: string,
  catalog: CatalogSkill[],
  nodes: Map<string, SkillNode>,
  edges: SkillEdge[],
): void {
  const body = stripFrontmatter(skillText);
  for (const skill of catalog) {
    if (skill.name === selfName) {
      continue;
    }
    const mentioned =
      body.includes(`\`${skill.name}\``) ||
      body.includes(`**\`${skill.name}\``) ||
      new RegExp(`\\b${escapeRegExp(skill.name)}\\b`).test(body);
    if (!mentioned) {
      continue;
    }
    const id = `skill:${skill.name}`;
    if (!nodes.has(id)) {
      nodes.set(id, {
        id,
        label: skill.name,
        kind: "skill",
        path: path.join(skill.rootPath, "SKILL.md"),
        summary: skill.description,
        uses: [],
        inferred: true,
      });
    }
    if (!edges.some((edge) => edge.from === ENTRY_ID && edge.to === id)) {
      edges.push({
        from: ENTRY_ID,
        to: id,
        inferred: true,
        label: "handoff",
      });
    }
  }
}

function kindFor(filePath: string, skillRoot: string): NodeKind {
  const rel = path.relative(skillRoot, filePath);
  const outside = rel.startsWith("..") || path.isAbsolute(rel);
  if (outside) {
    return "shared";
  }
  const parts = rel.split(path.sep);
  const folder = parts[0];
  if (folder === "prompts") {
    return "agent";
  }
  if (folder === "agents") {
    const ext = path.extname(filePath).toLowerCase();
    return ext === ".yaml" || ext === ".yml" || ext === ".json" ? "reference" : "agent";
  }
  if (folder === "scripts") {
    return "script";
  }
  if (folder === "references") {
    return "reference";
  }
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".py" || ext === ".sh" || ext === ".js" || ext === ".ts") {
    return "script";
  }
  return "reference";
}

function nodeIdFor(filePath: string, skillRoot: string): string {
  const rel = path.relative(skillRoot, filePath);
  if (!rel.startsWith("..") && !path.isAbsolute(rel)) {
    return rel.split(path.sep).join("/");
  }
  return filePath;
}

function resolveHref(href: string, skillRoot: string, homedir: string): string | undefined {
  if (/^[a-z]+:\/\//i.test(href) || href.startsWith("mailto:")) {
    return undefined;
  }
  const cleaned = stripSuffix(href.split("#")[0]);
  if (!cleaned) {
    return undefined;
  }
  if (cleaned.startsWith("~/") || cleaned === "~") {
    return path.resolve(cleaned.replace(/^~(?=\/|$)/, homedir));
  }
  if (path.isAbsolute(cleaned)) {
    return cleaned;
  }
  return path.resolve(skillRoot, cleaned);
}

function stripSuffix(href: string): string {
  return href.replace(/:[A-Za-z_][A-Za-z0-9_]*$/, "");
}

function hrefLabel(href: string): string {
  const base = path.basename(stripSuffix(href.split("#")[0]));
  return base || href;
}

function usesFor(id: string, edges: SkillEdge[], nodes: Map<string, SkillNode>): UseChip[] {
  return edges
    .filter((edge) => edge.from === id)
    .map((edge) => {
      const target = nodes.get(edge.to);
      return {
        label: target?.label ?? edge.to,
        targetId: edge.to,
      };
    });
}

function walkFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(full));
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function stripFrontmatter(text: string): string {
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

function firstParagraph(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("|") && line !== "---");
  return (lines[0] ?? "").slice(0, 220);
}

function isDirectory(dir: string): boolean {
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

function readText(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
