import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { readTextFile, INPUT_READ_LIMIT_BYTES, FLOW_MAX_STEPS } from "./fileAccess";
import { parseFrontmatter } from "./discover";
import type { CatalogSkill, ProcedureResult, SkillEdge, SkillGraph, SkillNode } from "./shared/protocol";
import { buildFixPrompt, emptyDiagnosis } from "./shared/protocol";

export type ParseProcedureOptions = { skillRoot: string; catalog: CatalogSkill[]; homedir?: string };
/** @deprecated use ParseProcedureOptions */
export type ParsePipelineOptions = ParseProcedureOptions;

import { detectSteps, type Detection } from "./procedureDetection";

const LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;

export function parseProcedure(options: ParseProcedureOptions): ProcedureResult {
  const skillRoot = path.resolve(options.skillRoot);
  const skillFile = path.join(skillRoot, "SKILL.md");
  const warnings: string[] = [];
  const readInput = (file: string) => { const result = readTextFile(file, INPUT_READ_LIMIT_BYTES); if (result.warning) warnings.push(result.warning); return result.text; };
  const skillText = readInput(skillFile);
  const meta = parseFrontmatter(skillText);
  const skillName = meta.name || path.basename(skillRoot);
  const homedir = options.homedir ?? os.homedir();
  const workflowPath = findLinkedPath(skillText, skillRoot, homedir, "workflow.md");
  const operationsPath = findLinkedPath(skillText, skillRoot, homedir, "operations.md");
  const candidates: Array<{ path: string; text: string }> = [
    ...(workflowPath ? [{ path: workflowPath, text: readInput(workflowPath) }] : []),
    { path: skillFile, text: skillText },
    ...(operationsPath && operationsPath !== workflowPath ? [{ path: operationsPath, text: readInput(operationsPath) }] : []),
  ];

  for (const candidate of candidates) {
    const detection = detectSteps(candidate.text, candidate.path);
    if (!detection || detection.steps.length < 1) continue;
    const notes = [...(detection.findings ?? [])];
    if (detection.steps.length > FLOW_MAX_STEPS) {
      const total = detection.steps.length;
      detection.steps = detection.steps.slice(0, FLOW_MAX_STEPS);
      detection.links = detection.links.filter(link => link.from < FLOW_MAX_STEPS && link.to < FLOW_MAX_STEPS);
      const warning = `Flow shows ${FLOW_MAX_STEPS} of ${total} steps.`;
      warnings.push(warning);
      notes.push(warning);
    }
    const graph = wrapWithSource(buildStepGraph(skillName, skillRoot, detection, homedir), skillFile, skillText);
    graph.warnings = [...new Set(warnings)];
    const confidence = detection.relationships === "explicit" && !warnings.length ? "high" : "partial";
    const structural = detection.findings ?? [];
    const parts = [...notes];
    if (detection.relationships === "unresolved" && structural.length === 0) {
      parts.push("Some relationships are unresolved or only part of the structure is supported.");
    } else if (parts.length === 0) {
      parts.push("The ordered steps are stated in the source.");
    }
    const detail = parts.join(" ");
    return {
      graph,
      diagnosis: {
        confidence,
        message: `Flow detected from ${path.basename(candidate.path)} as ${detection.sourceKind} (${detection.steps.length} steps). ${detail}`,
        fixPrompt: buildFixPrompt(skillName, detail),
      },
    };
  }

  const linked = workflowPath ?? operationsPath;
  if (linked) { const result = partialResult(skillName, skillRoot, skillFile, skillText, linked, readText(linked)); result.graph.warnings = warnings; return result; }
  return {
    graph: { skillId: `${skillName}-procedure`, skillName, rootPath: skillRoot, nodes: [], edges: [], warnings },
    diagnosis: emptyDiagnosis(skillName),
  };
}

/** @deprecated Prefer parseProcedure; returns only the graph. */
export function parsePipeline(options: ParsePipelineOptions): SkillGraph {
  return parseProcedure(options).graph;
}

function buildStepGraph(skillName: string, skillRoot: string, detection: Detection, homedir: string): SkillGraph {
  const usedIds = new Set<string>();
  const nodes: SkillNode[] = detection.steps.map((step, index) => {
    const resource = step.resource ?? step.body;
    const resourcePath = resolveResource(resource, skillRoot, homedir, step.source.path);
    const kind = kindForResource(resource);
    const baseId = detection.sourceKind === "P/N rows" ? `step:${step.display}` : `step:${index + 1}`;
    const id = usedIds.has(baseId) ? `${baseId}:${index + 1}` : baseId;
    usedIds.add(id);
    return {
      id, label: `${step.display}. ${plainTitle(step.title)}`, kind,
      path: step.source.path, source: step.source,
      resourcePath,
      summary: firstLine(step.body) || step.title, excerpt: step.body.slice(0, 4000), uses: [],
      isEntry: index === 0, isBlock: kind === "agent",
    };
  });
  const edges: SkillEdge[] = detection.links.map(link => ({
    from: nodes[link.from].id, to: nodes[link.to].id, label: link.label,
    relationship: "explicit", source: link.source,
  }));
  for (const node of nodes) {
    const outgoing = edges.filter(edge => edge.from === node.id);
    if (outgoing.length > 1 && outgoing.some(edge => edge.label)) node.kind = "gate";
  }
  return { skillId: `${skillName}-procedure`, skillName, rootPath: skillRoot, nodes, edges };
}

function wrapWithSource(graph: SkillGraph, skillFile: string, skillText: string): SkillGraph {
  const sourcePath = graph.nodes[0]?.source?.path;
  if (!sourcePath || !graph.nodes[0]) return graph;
  const skillNode: SkillNode = {
    id: "skill-md", label: "SKILL.md", kind: "skill", path: skillFile,
    source: { path: skillFile, startLine: 1, endLine: 1 }, summary: firstLine(stripFrontmatter(skillText)), uses: [], isEntry: true,
  };
  for (const node of graph.nodes) node.isEntry = false;
  if (path.resolve(sourcePath) === path.resolve(skillFile)) {
    return { ...graph, nodes: [skillNode, ...graph.nodes], edges: [{ from: "skill-md", to: graph.nodes[0].id, label: "source", relationship: "inferred", inferred: true }, ...graph.edges] };
  }
  const sourceText = readText(sourcePath);
  const sourceNode: SkillNode = {
    id: "procedure-source", label: path.basename(sourcePath), kind: "reference", path: sourcePath,
    source: { path: sourcePath, startLine: 1, endLine: 1 }, summary: firstLine(stripFrontmatter(sourceText)) || "Flow source",
    excerpt: sourceText.slice(0, 4000), uses: [],
  };
  return {
    ...graph, nodes: [skillNode, sourceNode, ...graph.nodes],
    edges: [
      { from: "skill-md", to: "procedure-source", label: "source", relationship: "inferred", inferred: true },
      ...(graph.edges.some(edge => edge.from === graph.nodes[0].id) ? [{ from: "procedure-source", to: graph.nodes[0].id, relationship: "inferred" as const, inferred: true, label: "steps" }] : []),
      ...graph.edges,
    ],
  };
}

function partialResult(skillName: string, skillRoot: string, skillFile: string, skillText: string, linkedPath: string, linkedText: string): ProcedureResult {
  return {
    graph: {
      skillId: `${skillName}-procedure`, skillName, rootPath: skillRoot,
      nodes: [
        { id: "skill-md", label: "SKILL.md", kind: "skill", path: skillFile, source: { path: skillFile, startLine: 1, endLine: 1 }, summary: firstLine(stripFrontmatter(skillText)), uses: [], isEntry: true },
        { id: "workflow", label: path.basename(linkedPath), kind: "reference", path: linkedPath, source: { path: linkedPath, startLine: 1, endLine: 1 }, summary: firstLine(stripFrontmatter(linkedText)), excerpt: linkedText.slice(0, 4000), uses: [] },
      ],
      edges: [{ from: "skill-md", to: "workflow", label: "workflow", confidence: "low", relationship: "unresolved" }],
    },
    diagnosis: {
      confidence: "partial", message: `Found ${path.relative(skillRoot, linkedPath)} but no supported step structure.`,
      fixPrompt: buildFixPrompt(skillName, `Found ${path.relative(skillRoot, linkedPath)} but no supported step structure.`),
    },
  };
}

function findLinkedPath(text: string, skillRoot: string, homedir: string, basename: string): string | undefined {
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

function resolveResource(resource: string, skillRoot: string, homedir: string, sourcePath: string): string | undefined {
  const markdownLink = [...resource.matchAll(LINK_RE)][0]?.[2]?.split("#")[0];
  if (markdownLink && !/^[a-z]+:\/\//i.test(markdownLink)) {
    const linked = markdownLink.startsWith("~/") ? path.resolve(homedir, markdownLink.slice(2)) : path.resolve(path.dirname(sourcePath), markdownLink);
    if (fs.existsSync(linked) && fs.statSync(linked).isFile()) return linked;
  }
  const agent = resource.match(/\bagent\s+([\w-]+)/i)?.[1];
  if (agent) {
    for (const candidate of [path.join(skillRoot, "agents", `${agent}.md`), path.join(skillRoot, "prompts", `${agent}.md`), path.join(homedir, ".claude", "agents", `${agent}.md`)]) {
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  const file = resource.match(/(?:scripts|references|prompts)\/[^\s,`]+/)?.[0];
  if (file) {
    const resolved = path.resolve(skillRoot, file);
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) return resolved;
  }
  return undefined;
}

function kindForResource(resource?: string): SkillNode["kind"] {
  if (/\bagent\s+|\bthis loop\b/i.test(resource ?? "")) return "agent";
  if (/scripts\//i.test(resource ?? "")) return "script";
  return "reference";
}
function plainTitle(value: string): string {
  return value.replace(/\*\*/g, "").trim();
}
function firstLine(text: string): string {
  return (text.split(/\r?\n/).map((line) => line.trim()).find((line) => line && !line.startsWith("#") && line !== "---") ?? "").slice(0, 220);
}
function stripFrontmatter(text: string): string {
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}
function readText(filePath: string): string {
  return readTextFile(filePath, INPUT_READ_LIMIT_BYTES).text;
}
