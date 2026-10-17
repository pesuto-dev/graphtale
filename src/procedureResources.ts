import * as fs from "node:fs";
import * as path from "node:path";

const LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;

/** First on-disk file linked from the skill text, then the conventional relative path. */
export function findLinkedPath(text: string, skillRoot: string, homedir: string, basename: string): string | undefined {
  const candidates: string[] = [];
  for (const match of text.matchAll(LINK_RE)) {
    const href = match[2].trim().split("#")[0];
    if (path.basename(href).toLowerCase() === basename) candidates.push(href);
  }
  candidates.push(basename, path.join("references", basename));
  for (const candidate of candidates) {
    const resolved = candidate.startsWith("~/") ? path.resolve(homedir, candidate.slice(2)) : path.resolve(skillRoot, candidate);
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) return resolved;
  }
  return undefined;
}

function existingFile(filePath: string): string | undefined {
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile() ? filePath : undefined;
}

function resolveMarkdownLink(resource: string, homedir: string, sourcePath: string): string | undefined {
  const markdownLink = [...resource.matchAll(LINK_RE)][0]?.[2]?.split("#")[0];
  if (!markdownLink || /^[a-z]+:\/\//i.test(markdownLink)) return undefined;
  const linked = markdownLink.startsWith("~/")
    ? path.resolve(homedir, markdownLink.slice(2))
    : path.resolve(path.dirname(sourcePath), markdownLink);
  return existingFile(linked);
}

function resolveNamedAgent(resource: string, skillRoot: string, homedir: string): string | undefined {
  const agent = resource.match(/\bagent\s+([\w-]+)/i)?.[1];
  if (!agent) return undefined;
  const candidates = [
    path.join(skillRoot, "agents", `${agent}.md`),
    path.join(skillRoot, "prompts", `${agent}.md`),
    path.join(homedir, ".claude", "agents", `${agent}.md`),
  ];
  return candidates.find(candidate => fs.existsSync(candidate));
}

function resolveRelativeFile(resource: string, skillRoot: string): string | undefined {
  const file = resource.match(/(?:scripts|references|prompts)\/[^\s,`]+/)?.[0];
  if (!file) return undefined;
  return existingFile(path.resolve(skillRoot, file));
}

/** Resolve a step resource to a file, in the same order as the original scan. */
export function resolveResource(resource: string, skillRoot: string, homedir: string, sourcePath: string): string | undefined {
  return resolveMarkdownLink(resource, homedir, sourcePath)
    ?? resolveNamedAgent(resource, skillRoot, homedir)
    ?? resolveRelativeFile(resource, skillRoot);
}
