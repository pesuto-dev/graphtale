import * as path from "node:path";
import type { Detection } from "./procedureDetection";
import type { ProcedureResult, SkillEdge, SkillGraph, SkillNode } from "./shared/protocol";
import { buildFixPrompt } from "./shared/protocol";
import { stripFrontmatter } from "./text";

export type ResourceResolver = (resource: string, sourcePath: string) => string | undefined;

/** Turn detected steps into graph nodes. Path lookup stays behind `resolve`. */
export function buildStepGraph(
  skillName: string,
  skillRoot: string,
  detection: Detection,
  resolve: ResourceResolver,
): SkillGraph {
  const usedIds = new Set<string>();
  const nodes: SkillNode[] = detection.steps.map((step, index) => {
    const resource = step.resource ?? step.body;
    const resourcePath = resolve(resource, step.source.path);
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

export type FlowSource = {
  graph: SkillGraph;
  skillFile: string;
  skillText: string;
  sourceText: string;
};

/** Prefix the flow with the skill file, and with the linked source when that is a different file. */
export function wrapWithSource(source: FlowSource): SkillGraph {
  const { graph, skillFile, skillText, sourceText } = source;
  const sourcePath = graph.nodes[0]?.source?.path;
  if (!sourcePath || !graph.nodes[0]) return graph;
  const skillNode = skillMarkdownNode(skillFile, skillText);
  for (const node of graph.nodes) node.isEntry = false;
  if (path.resolve(sourcePath) === path.resolve(skillFile)) return graphWithSkill(graph, skillNode);
  return graphWithLinkedSource(graph, skillNode, sourcePath, sourceText);
}

function skillMarkdownNode(skillFile: string, skillText: string): SkillNode {
  return {
    id: "skill-md", label: "SKILL.md", kind: "skill", path: skillFile,
    source: { path: skillFile, startLine: 1, endLine: 1 }, summary: firstLine(stripFrontmatter(skillText)), uses: [], isEntry: true,
  };
}

function graphWithSkill(graph: SkillGraph, skillNode: SkillNode): SkillGraph {
  const entry = graph.nodes[0];
  if (!entry) return graph;
  return {
    ...graph,
    nodes: [skillNode, ...graph.nodes],
    edges: [{ from: "skill-md", to: entry.id, label: "source", relationship: "inferred", inferred: true }, ...graph.edges],
  };
}

function graphWithLinkedSource(graph: SkillGraph, skillNode: SkillNode, sourcePath: string, sourceText: string): SkillGraph {
  const entry = graph.nodes[0];
  if (!entry) return graph;
  const sourceNode: SkillNode = {
    id: "procedure-source", label: path.basename(sourcePath), kind: "reference", path: sourcePath,
    source: { path: sourcePath, startLine: 1, endLine: 1 }, summary: firstLine(stripFrontmatter(sourceText)) || "Flow source",
    excerpt: sourceText.slice(0, 4000), uses: [],
  };
  const stepEdge = graph.edges.some(edge => edge.from === entry.id)
    ? [{ from: "procedure-source", to: entry.id, relationship: "inferred" as const, inferred: true, label: "steps" }]
    : [];
  return {
    ...graph,
    nodes: [skillNode, sourceNode, ...graph.nodes],
    edges: [
      { from: "skill-md", to: "procedure-source", label: "source", relationship: "inferred", inferred: true },
      ...stepEdge,
      ...graph.edges,
    ],
  };
}

export type PartialSource = {
  skillName: string;
  skillRoot: string;
  skillFile: string;
  skillText: string;
  linkedPath: string;
  linkedText: string;
};

/** A linked workflow exists, but it has no supported step structure. */
export function partialResult(source: PartialSource): ProcedureResult {
  const relative = path.relative(source.skillRoot, source.linkedPath);
  const message = `Found ${relative} but no supported step structure.`;
  return {
    graph: {
      skillId: `${source.skillName}-procedure`, skillName: source.skillName, rootPath: source.skillRoot,
      nodes: [
        { id: "skill-md", label: "SKILL.md", kind: "skill", path: source.skillFile, source: { path: source.skillFile, startLine: 1, endLine: 1 }, summary: firstLine(stripFrontmatter(source.skillText)), uses: [], isEntry: true },
        { id: "workflow", label: path.basename(source.linkedPath), kind: "reference", path: source.linkedPath, source: { path: source.linkedPath, startLine: 1, endLine: 1 }, summary: firstLine(stripFrontmatter(source.linkedText)), excerpt: source.linkedText.slice(0, 4000), uses: [] },
      ],
      edges: [{ from: "skill-md", to: "workflow", label: "workflow", confidence: "low", relationship: "unresolved" }],
    },
    diagnosis: { confidence: "partial", message, fixPrompt: buildFixPrompt(source.skillName, message) },
  };
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
  const line = text.split(/\r?\n/).map(row => row.trim()).find(row => row && !row.startsWith("#") && row !== "---");
  return (line ?? "").slice(0, 220);
}
