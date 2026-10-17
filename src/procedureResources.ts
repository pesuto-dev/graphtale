import * as fs from "node:fs";
import * as path from "node:path";

const LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;

export type ResourceQuery = {
  resource: string;
  skillRoot: string;
  homedir: string;
  sourcePath: string;
};

export type ResourceResolver = (resource: string, sourcePath: string) => string | undefined;

export function resolveSkillResource(query: ResourceQuery): string | undefined {
  const linked = linkedFile(query);
  if (linked) return linked;
  const agent = agentFile(query);
  if (agent) return agent;
  return referencedFile(query);
}

function linkedFile(query: ResourceQuery): string | undefined {
  const href = [...query.resource.matchAll(LINK_RE)][0]?.[2]?.split("#")[0];
  if (!href || /^[a-z]+:\/\//i.test(href)) return undefined;
  const linked = href.startsWith("~/")
    ? path.resolve(query.homedir, href.slice(2))
    : path.resolve(path.dirname(query.sourcePath), href);
  return fs.existsSync(linked) && fs.statSync(linked).isFile() ? linked : undefined;
}

function agentFile(query: ResourceQuery): string | undefined {
  const agent = query.resource.match(/\bagent\s+([\w-]+)/i)?.[1];
  if (!agent) return undefined;
  const candidates = [
    path.join(query.skillRoot, "agents", `${agent}.md`),
    path.join(query.skillRoot, "prompts", `${agent}.md`),
    path.join(query.homedir, ".claude", "agents", `${agent}.md`),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function referencedFile(query: ResourceQuery): string | undefined {
  const file = query.resource.match(/(?:scripts|references|prompts)\/[^\s,`]+/)?.[0];
  if (!file) return undefined;
  const resolved = path.resolve(query.skillRoot, file);
  return fs.existsSync(resolved) && fs.statSync(resolved).isFile() ? resolved : undefined;
}
