import * as path from "node:path";
import type { CatalogSkill, SkillEdge, SkillNode } from "./shared/protocol";
import {
  INVENTORY_MAX_FILES,
  PREVIEW_READ_LIMIT_BYTES,
  isRegularFile,
  readTextFile,
} from "./fileAccess";
import {
  ENTRY_ID,
  addFileNode,
  nodeIdFor,
  resolveAgentDefinition,
  resolveHref,
} from "./skillPaths";
import { escapeRegExp, firstParagraph, stripFrontmatter } from "./text";

export const LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;

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

export function addMarkdownLinks(
  skillText: string,
  skillRoot: string,
  homedir: string,
  nodes: Map<string, SkillNode>,
  edges: SkillEdge[],
  warnings: string[],
): void {
  let scanned = 0;
  for (const match of skillText.matchAll(LINK_RE)) {
    if (++scanned > INVENTORY_MAX_FILES) { warnings.push(`Catalog stopped scanning links after ${INVENTORY_MAX_FILES} entries.`); break; }
    if (nodes.size >= INVENTORY_MAX_FILES) break;
    const href = match[2].trim();
    const resolved = resolveHref(href, skillRoot, homedir);
    if (!resolved) {
      continue;
    }
    addFileNode(resolved, href, skillRoot, false, nodes, edges, warnings);
  }
}

export function catalogWorkflowPath(
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
    if (resolved && isRegularFile(resolved)) {
      return resolved;
    }
  }
  for (const candidate of [
    path.join(skillRoot, "workflow.md"),
    path.join(skillRoot, "references", "workflow.md"),
  ]) {
    if (isRegularFile(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

/**
 * Surface `agent <name>` mentions from SKILL.md / linked workflow as Catalog
 * agent nodes (prompts/ alone misses dispatched `agent <name>` workers).
 */
export function addDispatchedAgents(
  skillText: string,
  skillRoot: string,
  homedir: string,
  nodes: Map<string, SkillNode>,
  edges: SkillEdge[],
  warnings: string[],
): void {
  const corpora = [skillText];
  const workflow = catalogWorkflowPath(skillText, skillRoot, homedir);
  if (workflow) {
    const read = readTextFile(workflow, PREVIEW_READ_LIMIT_BYTES);
    if (read.warning) warnings.push(read.warning);
    if (read.text) corpora.push(read.text);
  }

  const seen = new Set<string>();
  for (const text of corpora) {
    for (const match of text.matchAll(/\bagent\s+([A-Za-z0-9][\w-]*)/g)) {
      if (nodes.size >= INVENTORY_MAX_FILES) break;
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
      if (resolved && isRegularFile(resolved)) {
        const read = readTextFile(resolved, PREVIEW_READ_LIMIT_BYTES);
        if (read.warning) warnings.push(read.warning);
        const body = read.text;
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

export function addSkillMentions(
  skillText: string,
  selfName: string,
  catalog: CatalogSkill[],
  nodes: Map<string, SkillNode>,
  edges: SkillEdge[],
): void {
  const body = stripFrontmatter(skillText);
  for (const skill of catalog) {
    if (nodes.size >= INVENTORY_MAX_FILES) break;
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
