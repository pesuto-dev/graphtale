import * as fs from "node:fs";
import * as path from "node:path";
import type { NodeKind, SkillEdge, SkillNode, UseChip } from "./shared/protocol";
import {
  INVENTORY_MAX_FILES,
  PREVIEW_READ_LIMIT_BYTES,
  isRegularFile,
  readTextFile,
  walkTextFiles,
} from "./fileAccess";
import { firstParagraph, stripFrontmatter } from "./text";

export const ENTRY_ID = "skill-md";

export function isDirectory(dir: string): boolean {
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

export function isCatalogNoise(filePath: string, skillRoot: string): boolean {
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

export function resolveAgentDefinition(
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

export function kindFor(filePath: string, skillRoot: string): NodeKind {
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

export function nodeIdFor(filePath: string, skillRoot: string): string {
  const rel = path.relative(skillRoot, filePath);
  if (!rel.startsWith("..") && !path.isAbsolute(rel)) {
    return rel.split(path.sep).join("/");
  }
  return filePath;
}

export function stripSuffix(href: string): string {
  return href.replace(/:[A-Za-z_][A-Za-z0-9_]*$/, "");
}

export function hrefLabel(href: string): string {
  const base = path.basename(stripSuffix(href.split("#")[0]));
  return base || href;
}

export function resolveHref(href: string, skillRoot: string, homedir: string): string | undefined {
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

export function usesFor(id: string, edges: SkillEdge[], nodes: Map<string, SkillNode>): UseChip[] {
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

export function addFolderFiles(
  skillRoot: string,
  folder: string,
  kind: NodeKind | undefined,
  isBlock: boolean,
  nodes: Map<string, SkillNode>,
  edges: SkillEdge[],
  warnings: string[],
): void {
  const dir = path.join(skillRoot, folder);
  if (!isDirectory(dir)) {
    return;
  }
  const inventory = walkTextFiles(dir);
  warnings.push(...inventory.warnings);
  for (const file of inventory.files) {
    addFileNode(file, path.relative(skillRoot, file), skillRoot, isBlock, nodes, edges, warnings, kind);
  }
}

export function addFileNode(
  filePath: string,
  href: string,
  skillRoot: string,
  isBlockHint: boolean,
  nodes: Map<string, SkillNode>,
  edges: SkillEdge[],
  warnings: string[],
  kindOverride?: NodeKind,
): void {
  if (nodes.size >= INVENTORY_MAX_FILES) return;
  if (!isRegularFile(filePath)) {
    warnings.push(`Referenced file ${hrefLabel(href)} is unavailable.`);
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
    const read = readTextFile(filePath, PREVIEW_READ_LIMIT_BYTES);
    if (read.warning) warnings.push(read.warning);
    const text = read.text;
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
