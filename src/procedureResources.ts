import * as fs from "node:fs";
import * as path from "node:path";
import { inReadScope, type ReadScope } from "./readScope";
import { linkHrefs } from "./text";

/**
 * First on-disk file linked from the skill text, then the conventional relative path.
 * A link outside the read scope is skipped with a warning: Flow would show its contents unasked.
 */
export function findLinkedPath(text: string, scope: ReadScope, basename: string, warnings: string[]): string | undefined {
  const candidates: string[] = [];
  for (const link of linkHrefs(text)) {
    const href = link.trim().split("#")[0];
    if (path.basename(href).toLowerCase() === basename) candidates.push(href);
  }
  candidates.push(basename, path.join("references", basename));
  let outside = false;
  for (const candidate of candidates) {
    const resolved = candidate.startsWith("~/") ? path.resolve(scope.homedir, candidate.slice(2)) : path.resolve(scope.skillRoot, candidate);
    if (!existingFile(resolved)) continue;
    if (inReadScope(resolved, scope)) return resolved;
    outside = true;
  }
  if (outside) warnings.push(`Linked ${basename} is outside the skill and workspace folders, so Flow did not read it.`);
  return undefined;
}

function existingFile(filePath: string): string | undefined {
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile() ? filePath : undefined;
}

function resolveMarkdownLink(resource: string, homedir: string, sourcePath: string): string | undefined {
  const markdownLink = linkHrefs(resource)[0]?.split("#")[0];
  if (!markdownLink || /^[a-z]+:\/\//i.test(markdownLink)) return undefined;
  const linked = markdownLink.startsWith("~/")
    ? path.resolve(homedir, markdownLink.slice(2))
    : path.resolve(path.dirname(sourcePath), markdownLink);
  return existingFile(linked);
}

function resolveNamedAgent(resource: string, skillRoot: string, homedir: string): string | undefined {
  const agent = (/\bagent\s+([\w-]+)/i.exec(resource))?.[1];
  if (!agent) return undefined;
  const candidates = [
    path.join(skillRoot, "agents", `${agent}.md`),
    path.join(skillRoot, "prompts", `${agent}.md`),
    path.join(homedir, ".claude", "agents", `${agent}.md`),
  ];
  return candidates.find(candidate => fs.existsSync(candidate));
}

function resolveRelativeFile(resource: string, skillRoot: string): string | undefined {
  const file = (/(?:scripts|references|prompts)\/[^\s,`]+/.exec(resource))?.[0];
  if (!file) return undefined;
  return existingFile(path.resolve(skillRoot, file));
}

/** Resolve a step resource to a file, in the same order as the original scan. */
export function resolveResource(resource: string, skillRoot: string, homedir: string, sourcePath: string): string | undefined {
  return resolveMarkdownLink(resource, homedir, sourcePath)
    ?? resolveNamedAgent(resource, skillRoot, homedir)
    ?? resolveRelativeFile(resource, skillRoot);
}
