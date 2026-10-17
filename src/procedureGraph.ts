import * as path from "node:path";
import type { Detection } from "./detectionTypes";
import type { ResourceResolver } from "./procedureResources";
import type { ProcedureResult, SkillEdge, SkillGraph, SkillNode } from "./shared/protocol";
import { buildFixPrompt } from "./shared/protocol";
import { stripFrontmatter } from "./text";

export function buildStepGraph(skillName: string, skillRoot: string, detection: Detection, resolveResource: ResourceResolver): SkillGraph {
  const usedIds = new Set<string>();
  const nodes = detection.steps.map((step, index) => stepNode({ detection, usedIds, step, index, resolveResource }));
  const edges: SkillEdge[] = detection.links.map((link) => ({
    from: requiredNode(nodes, link.from).id,
    to: requiredNode(nodes, link.to).id,
    label: link.label,
    relationship: "explicit",
    source: link.source,
  }));
  for (const node of nodes) {
    const outgoing = edges.filter((edge) => edge.from === node.id);
    if (outgoing.length > 1 && outgoing.some((edge) => edge.label)) node.kind = "gate";
  }
  return { skillId: `${skillName}-procedure`, skillName, rootPath: skillRoot, nodes, edges };
}

type StepInput = {
  detection: Detection;
  usedIds: Set<string>;
  step: Detection["steps"][number];
  index: number;
  resolveResource: ResourceResolver;
};

function stepNode(input: StepInput): SkillNode {
  const resource = input.step.resource ?? input.step.body;
  const kind = kindForResource(resource);
  const baseId = input.detection.sourceKind === "P/N rows" ? `step:${input.step.display}` : `step:${input.index + 1}`;
  const id = input.usedIds.has(baseId) ? `${baseId}:${input.index + 1}` : baseId;
  input.usedIds.add(id);
  return {
    id,
    label: `${input.step.display}. ${plainTitle(input.step.title)}`,
    kind,
    path: input.step.source.path,
    source: input.step.source,
    resourcePath: input.resolveResource(resource, input.step.source.path),
    summary: firstLine(input.step.body) || input.step.title,
    excerpt: input.step.body.slice(0, 4000),
    uses: [],
    isEntry: input.index === 0,
    isBlock: kind === "agent",
  };
}

function requiredNode(nodes: SkillNode[], index: number): SkillNode {
  const node = nodes[index];
  if (!node) throw new Error(`Missing step ${index}.`);
  return node;
}

export function wrapWithSource(graph: SkillGraph, skillFile: string, skillText: string, sourceText: string): SkillGraph {
  const sourcePath = graph.nodes[0]?.source?.path;
  const first = graph.nodes[0];
  if (!sourcePath || !first) return graph;
  const skillNode = skillNodeFor(skillFile, skillText);
  for (const node of graph.nodes) node.isEntry = false;
  if (path.resolve(sourcePath) === path.resolve(skillFile)) return sameFileGraph(graph, skillNode, first.id);
  return linkedSourceGraph(graph, skillNode, first, { path: sourcePath, text: sourceText });
}

function skillNodeFor(skillFile: string, skillText: string): SkillNode {
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

function sameFileGraph(graph: SkillGraph, skillNode: SkillNode, firstId: string): SkillGraph {
  const source: SkillEdge = { from: "skill-md", to: firstId, label: "source", relationship: "inferred", inferred: true };
  return { ...graph, nodes: [skillNode, ...graph.nodes], edges: [source, ...graph.edges] };
}

function linkedSourceGraph(graph: SkillGraph, skillNode: SkillNode, first: SkillNode, source: { path: string; text: string }): SkillGraph {
  const sourceNode: SkillNode = {
    id: "procedure-source",
    label: path.basename(source.path),
    kind: "reference",
    path: source.path,
    source: { path: source.path, startLine: 1, endLine: 1 },
    summary: firstLine(stripFrontmatter(source.text)) || "Flow source",
    excerpt: source.text.slice(0, 4000),
    uses: [],
  };
  const edges: SkillEdge[] = [
    { from: "skill-md", to: "procedure-source", label: "source", relationship: "inferred", inferred: true },
  ];
  if (graph.edges.some((edge) => edge.from === first.id)) {
    edges.push({ from: "procedure-source", to: first.id, relationship: "inferred", inferred: true, label: "steps" });
  }
  return { ...graph, nodes: [skillNode, sourceNode, ...graph.nodes], edges: [...edges, ...graph.edges] };
}

export type PartialProcedure = {
  skillName: string;
  skillRoot: string;
  skillFile: string;
  skillText: string;
  linkedPath: string;
  linkedText: string;
};

export function partialResult(input: PartialProcedure): ProcedureResult {
  const detail = `Found ${path.relative(input.skillRoot, input.linkedPath)} but no supported step structure.`;
  return {
    graph: {
      skillId: `${input.skillName}-procedure`,
      skillName: input.skillName,
      rootPath: input.skillRoot,
      nodes: [skillNodeFor(input.skillFile, input.skillText), linkedNode(input)],
      edges: [{ from: "skill-md", to: "workflow", label: "workflow", confidence: "low", relationship: "unresolved" }],
    },
    diagnosis: { confidence: "partial", message: detail, fixPrompt: buildFixPrompt(input.skillName, detail) },
  };
}

function linkedNode(input: PartialProcedure): SkillNode {
  return {
    id: "workflow",
    label: path.basename(input.linkedPath),
    kind: "reference",
    path: input.linkedPath,
    source: { path: input.linkedPath, startLine: 1, endLine: 1 },
    summary: firstLine(stripFrontmatter(input.linkedText)),
    excerpt: input.linkedText.slice(0, 4000),
    uses: [],
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
  const line = text.split(/\r?\n/).map((item) => item.trim()).find((item) => item && !item.startsWith("#") && item !== "---");
  return (line ?? "").slice(0, 220);
}
