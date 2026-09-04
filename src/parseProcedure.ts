import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { parseFrontmatter } from "./discover";
import type {
  CatalogSkill,
  ProcedureResult,
  SkillEdge,
  SkillGraph,
  SkillNode,
  UseChip,
} from "./shared/protocol";
import { buildFixPrompt, emptyDiagnosis } from "./shared/protocol";

export type ParseProcedureOptions = {
  skillRoot: string;
  catalog: CatalogSkill[];
  homedir?: string;
};

/** @deprecated use ParseProcedureOptions */
export type ParsePipelineOptions = ParseProcedureOptions;

type StepRole = "intake" | "evidence" | "classify" | "handoff" | "work";

type WorkflowStep = {
  number: string;
  title: string;
  body: string;
};

type PnStep = {
  id: string;
  title: string;
  resource: string;
};

const LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;
const HEADING_RE = /^##\s+(\d+[a-z]?)\.\s+(.+?)\s*$/;
const LIST_BOLD_RE = /^(\d+[a-z]?)\.\s+\*\*([^*]+)\*\*/;
const LIST_PLAIN_RE = /^(\d+[a-z]?)\.\s+(?!\*\*)(\S.+)$/;
const PN_LINE_RE = /^\s*(P|N\d+[a-z]?)\s+(.+?)\s{2,}(\S.*)$/;

export function parseProcedure(options: ParseProcedureOptions): ProcedureResult {
  const homedir = options.homedir ?? os.homedir();
  const skillRoot = path.resolve(options.skillRoot);
  const skillFile = path.join(skillRoot, "SKILL.md");
  const skillText = readText(skillFile);
  const meta = parseFrontmatter(skillText);
  const skillName = meta.name || path.basename(skillRoot);
  const workflowPath = findWorkflowPath(skillText, skillRoot, homedir);
  const workflowText = workflowPath ? readText(workflowPath) : "";
  const sourcePath = workflowPath ?? skillFile;

  const enrich = (graph: SkillGraph, procedureText: string, source: string): SkillGraph =>
    enrichProcedureGraph({
      graph,
      skillFile,
      skillText,
      skillRoot,
      sourcePath: source,
      procedureText,
      catalog: options.catalog,
      metaDescription: meta.description,
    });

  const pn = extractPnSteps(workflowText);
  if (pn.length >= 3) {
    const graph = enrich(
      buildPnGraph({
        skillName,
        skillRoot,
        skillFile,
        sourcePath,
        steps: pn,
        workflowText,
        homedir,
      }),
      workflowText,
      sourcePath,
    );
    return {
      graph,
      diagnosis: {
        confidence: "high",
        message: `Flow detected from ${path.basename(sourcePath)} (${pn.length} steps).`,
        fixPrompt: buildFixPrompt(skillName, "Flow looks structured; refine labels only if needed."),
      },
    };
  }

  const steps = extractSteps(workflowText) ?? extractStepsFromSkill(skillText);
  if (steps.length > 0) {
    let graph = buildLegacyRoleGraph({
      skillName,
      skillRoot,
      skillFile,
      skillText,
      metaDescription: meta.description,
      sourcePath,
      steps,
      catalog: options.catalog,
      homedir,
    });
    if (graph.nodes.length < 3 && steps.length >= 2) {
      graph = buildLinearStepGraph({
        skillName,
        skillRoot,
        sourcePath,
        steps,
      });
    }
    return {
      graph: enrich(graph, workflowText || skillText, sourcePath),
      diagnosis: {
        confidence: "high",
        message: `Flow detected from numbered workflow (${steps.length} steps).`,
        fixPrompt: buildFixPrompt(
          skillName,
          "Numbered workflow parsed; optional: add an explicit P/N graph for richer layout.",
        ),
      },
    };
  }

  const opsPath = findOperationsPath(skillText, skillRoot, homedir);
  if (opsPath) {
    const opsText = readText(opsPath);
    const opsSteps = extractSteps(opsText) ?? extractNumberedList(opsText);
    if (opsSteps.length >= 2) {
      const graph = enrich(
        buildLinearStepGraph({
          skillName,
          skillRoot,
          sourcePath: opsPath,
          steps: opsSteps,
        }),
        opsText,
        opsPath,
      );
      return {
        graph,
        diagnosis: {
          confidence: "high",
          message: `Flow detected from ${path.basename(opsPath)} (${opsSteps.length} steps).`,
          fixPrompt: buildFixPrompt(skillName, "Operations file parsed into a linear flow."),
        },
      };
    }
    return partialWorkflowResult({
      skillName,
      skillRoot,
      skillFile,
      skillText,
      metaDescription: meta.description,
      workflowPath: opsPath,
      workflowText: opsText,
      detail: `Found ${path.relative(skillRoot, opsPath)} but could not parse ordered steps.`,
    });
  }

  if (workflowPath) {
    return partialWorkflowResult({
      skillName,
      skillRoot,
      skillFile,
      skillText,
      metaDescription: meta.description,
      workflowPath,
      workflowText,
      detail: `Found ${path.relative(skillRoot, workflowPath)} but could not parse ordered steps (need P/N graph or numbered ## 1. headings).`,
    });
  }

  return {
    graph: {
      skillId: `${skillName}-procedure`,
      skillName,
      rootPath: skillRoot,
      nodes: [],
      edges: [],
    },
    diagnosis: emptyDiagnosis(skillName),
  };
}

/** @deprecated Prefer parseProcedure; returns only the graph. */
export function parsePipeline(options: ParsePipelineOptions): SkillGraph {
  return parseProcedure(options).graph;
}

/**
 * Read-only graph enrichment for the Flow view. Never writes skill files —
 * only adds viewer nodes/edges derived from text that already exists on disk.
 */
function enrichProcedureGraph(input: {
  graph: SkillGraph;
  skillFile: string;
  skillText: string;
  skillRoot: string;
  sourcePath: string;
  procedureText: string;
  catalog: CatalogSkill[];
  metaDescription: string;
}): SkillGraph {
  let graph = wrapWithEntry(input.graph, {
    skillFile: input.skillFile,
    skillText: input.skillText,
    sourcePath: input.sourcePath,
    metaDescription: input.metaDescription,
  });
  graph = attachSupportRefs(graph, input.procedureText, input.skillRoot);
  graph = attachHandoffs(graph, input.skillText, input.catalog);
  return graph;
}

function wrapWithEntry(
  graph: SkillGraph,
  input: {
    skillFile: string;
    skillText: string;
    sourcePath: string;
    metaDescription: string;
  },
): SkillGraph {
  if (graph.nodes.length === 0) {
    return graph;
  }
  const nodes: SkillNode[] = graph.nodes.map((node) => ({ ...node, isEntry: false }));
  const edges = [...graph.edges];
  const firstRuntime =
    nodes.find((n) => n.id.startsWith("step:") || n.id.startsWith("gate:")) ?? nodes[0];

  const skillNode: SkillNode = {
    id: "skill-md",
    label: "SKILL.md",
    kind: "skill",
    path: input.skillFile,
    summary: firstLine(stripFrontmatter(input.skillText)) || input.metaDescription,
    uses: [],
    isEntry: true,
  };

  const sourceIsSkill = path.resolve(input.sourcePath) === path.resolve(input.skillFile);
  if (sourceIsSkill) {
    if (!nodes.some((n) => n.id === "skill-md")) {
      nodes.unshift(skillNode);
    } else {
      const existing = nodes.find((n) => n.id === "skill-md");
      if (existing) {
        existing.isEntry = true;
      }
    }
    if (firstRuntime && firstRuntime.id !== "skill-md") {
      if (!edges.some((e) => e.from === "skill-md" && e.to === firstRuntime.id)) {
        edges.unshift({ from: "skill-md", to: firstRuntime.id, label: "read on invoke" });
      }
    }
    return { ...graph, nodes, edges };
  }

  const sourceNode: SkillNode = {
    id: "procedure-source",
    label: path.basename(input.sourcePath),
    kind: "reference",
    path: input.sourcePath,
    summary: firstLine(stripFrontmatter(readText(input.sourcePath))) || "Flow source",
    uses: [],
    excerpt: readText(input.sourcePath).slice(0, 4000),
  };

  const withoutDup: SkillNode[] = nodes.filter(
    (n) => n.id !== "skill-md" && n.id !== "procedure-source",
  );
  withoutDup.unshift(skillNode, sourceNode);

  if (!edges.some((e) => e.from === "skill-md" && e.to === "procedure-source")) {
    edges.unshift({ from: "skill-md", to: "procedure-source", label: "read on invoke" });
  }
  if (firstRuntime && !edges.some((e) => e.from === "procedure-source" && e.to === firstRuntime.id)) {
    edges.unshift({ from: "procedure-source", to: firstRuntime.id });
  }

  return { ...graph, nodes: withoutDup, edges };
}

function attachSupportRefs(graph: SkillGraph, procedureText: string, skillRoot: string): SkillGraph {
  const candidates = collectSupportPaths(procedureText, skillRoot);
  if (candidates.length === 0) {
    return graph;
  }
  const nodes = [...graph.nodes];
  const edges = [...graph.edges];
  const anchor =
    nodes.find((n) => n.id === "step:N5" || /synthesis|write|N7|N8/i.test(n.id + n.label)) ??
    nodes.filter((n) => n.id.startsWith("step:")).at(-1) ??
    nodes.at(-1);

  for (const filePath of candidates) {
    const rel = path.relative(skillRoot, filePath).split(path.sep).join("/");
    const id = `support:${rel}`;
    if (nodes.some((n) => n.id === id)) {
      continue;
    }

    // Never attach support edges onto an existing runtime step that happens to
    // share this path (e.g. N3 → classify.md). That produced N5→N3 [criteria].
    const stepWithPath = nodes.find(
      (n) =>
        n.path === filePath && (n.id.startsWith("step:") || n.id.startsWith("gate:")),
    );

    const node: SkillNode = {
      id,
      label: path.basename(filePath),
      kind: "reference",
      path: filePath,
      summary: firstLine(stripFrontmatter(readText(filePath))) || "Support document",
      uses: [],
      excerpt: readText(filePath).slice(0, 2000),
    };
    nodes.push(node);

    const from =
      stepWithPath ??
      nodes.find(
        (n) =>
          n.id.startsWith("step:") &&
          (n.summary.includes(path.basename(filePath)) ||
            n.excerpt?.includes(path.basename(filePath)) ||
            n.label.includes(path.basename(filePath))),
      ) ??
      anchor;
    if (from) {
      edges.push({
        from: from.id,
        to: id,
        label: supportEdgeLabel(filePath),
        confidence: "low",
        inferred: true,
      });
    }
  }
  return { ...graph, nodes, edges };
}

function supportEdgeLabel(filePath: string): string {
  const base = path.basename(filePath).toLowerCase();
  if (base.includes("schema") || base.endsWith(".json")) {
    return "shape";
  }
  if (base.includes("template")) {
    return "slots";
  }
  if (base.includes("classify")) {
    return "criteria";
  }
  return "ref";
}

function collectSupportPaths(procedureText: string, skillRoot: string): string[] {
  const found = new Set<string>();
  const addIfExists = (relOrAbs: string) => {
    const cleaned = relOrAbs.replace(/[),.`'"]+$/g, "").split("#")[0];
    if (!cleaned || /^[a-z]+:\/\//i.test(cleaned)) {
      return;
    }
    const full = path.isAbsolute(cleaned) ? cleaned : path.resolve(skillRoot, cleaned);
    if (fs.existsSync(full) && fs.statSync(full).isFile()) {
      found.add(full);
    }
  };

  for (const match of procedureText.matchAll(LINK_RE)) {
    addIfExists(match[2].trim());
  }
  for (const match of procedureText.matchAll(
    /(?:schemas|references|prompts)\/[A-Za-z0-9_./-]+\.(?:md|json)/gi,
  )) {
    addIfExists(match[0]);
  }

  // Prefer template/schema/classify support docs when mentioned by basename
  for (const name of ["output-template.md", "analysis.schema.json", "classify.md", "gates.md"]) {
    if (procedureText.includes(name) || procedureText.includes(name.replace(".md", ""))) {
      for (const folder of ["references", "schemas", "prompts", "."]) {
        addIfExists(path.join(folder, name));
      }
    }
  }

  return [...found].filter((file) => {
    const rel = path.relative(skillRoot, file).split(path.sep).join("/");
    if (/workflow\.md$/i.test(rel) || /operations\.md$/i.test(rel)) {
      return false;
    }
    return (
      /\.(md|json)$/i.test(file) &&
      (/schema|template|classify|gates|evidence|privacy|output/i.test(path.basename(file)) ||
        rel.startsWith("schemas/") ||
        /template/i.test(rel))
    );
  });
}

function attachHandoffs(graph: SkillGraph, skillText: string, catalog: CatalogSkill[]): SkillGraph {
  if (catalog.length === 0 || graph.nodes.length === 0) {
    return graph;
  }
  const body = stripFrontmatter(skillText);
  const mentioned = catalog.filter((skill) => {
    if (skill.name === "ticket-handler") {
      return (
        new RegExp(`\\b${escapeRegExp(skill.name)}\\b`).test(body) &&
        /handoff|hand off|implement the fix|pick it up/i.test(body)
      );
    }
    const handoffTo = new RegExp(
      `(?:handoff|hand off|escalate)\\s+(?:to\\s+)?(?:\`)?${escapeRegExp(skill.name)}\\b`,
      "i",
    );
    return handoffTo.test(body);
  });
  if (mentioned.length === 0) {
    return graph;
  }

  const nodes = [...graph.nodes];
  const edges = [...graph.edges];
  const end =
    nodes.find((n) => /N7|N8|write_analysis|write/i.test(n.id + n.label)) ??
    nodes.filter((n) => n.id.startsWith("step:")).at(-1) ??
    nodes.at(-1);

  for (const skill of mentioned) {
    const id = `skill:${skill.name}`;
    if (!nodes.some((n) => n.id === id)) {
      nodes.push({
        id,
        label: skill.name,
        kind: "skill",
        path: path.join(skill.rootPath, "SKILL.md"),
        summary: skill.description || "Handoff skill",
        uses: [],
        inferred: true,
      });
    }
    if (end && !edges.some((e) => e.from === end.id && e.to === id)) {
      edges.push({
        from: end.id,
        to: id,
        label: "handoff",
        confidence: "low",
        inferred: true,
      });
    }
  }
  return { ...graph, nodes, edges };
}

function partialWorkflowResult(input: {
  skillName: string;
  skillRoot: string;
  skillFile: string;
  skillText: string;
  metaDescription: string;
  workflowPath: string;
  workflowText: string;
  detail: string;
}): ProcedureResult {
  const entry: SkillNode = {
    id: "skill-md",
    label: "SKILL.md",
    kind: "skill",
    path: input.skillFile,
    summary: firstLine(stripFrontmatter(input.skillText)) || input.metaDescription,
    uses: [{ label: path.basename(input.workflowPath), targetId: "workflow" }],
    isEntry: true,
  };
  const workflowNode: SkillNode = {
    id: "workflow",
    label: path.basename(input.workflowPath),
    kind: "reference",
    path: input.workflowPath,
    summary:
      firstLine(stripFrontmatter(input.workflowText)) || "Linked workflow file: steps not yet parseable.",
    uses: [],
    excerpt: input.workflowText.slice(0, 4000),
  };
  return {
    graph: {
      skillId: `${input.skillName}-procedure`,
      skillName: input.skillName,
      rootPath: input.skillRoot,
      nodes: [entry, workflowNode],
      edges: [{ from: "skill-md", to: "workflow", label: "workflow", confidence: "low" }],
    },
    diagnosis: {
      confidence: "partial",
      message: input.detail,
      fixPrompt: buildFixPrompt(input.skillName, input.detail),
    },
  };
}

function buildLinearStepGraph(input: {
  skillName: string;
  skillRoot: string;
  sourcePath: string;
  steps: WorkflowStep[];
}): SkillGraph {
  const nodes: SkillNode[] = input.steps.map((step, index) => ({
    id: `step:${step.number}`,
    label: `${step.number}. ${step.title}`.slice(0, 48),
    kind: /classify|agent|question/i.test(step.title) ? "agent" : "reference",
    path: input.sourcePath,
    summary: firstLine(step.body) || step.title,
    excerpt: sectionExcerpt(step),
    uses: [],
    isEntry: index === 0,
  }));
  const edges: SkillEdge[] = [];
  for (let i = 0; i < nodes.length - 1; i += 1) {
    edges.push({ from: nodes[i].id, to: nodes[i + 1].id });
  }
  return {
    skillId: `${input.skillName}-procedure`,
    skillName: input.skillName,
    rootPath: input.skillRoot,
    nodes,
    edges,
  };
}

function extractPnSteps(text: string): PnStep[] {
  const steps: PnStep[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/│/g, " ").replace(/\t/g, "  ");
    const match = line.match(PN_LINE_RE);
    if (!match) {
      continue;
    }
    const id = match[1];
    if (seen.has(id)) {
      continue;
    }
    const titlePart = match[2].trim();
    const rest = match[3].trim();
    const title = titlePart.replace(/\s{2,}.*$/, "").trim() || titlePart.split(/\s+/)[0];
    const resource = rest.replace(/\s+->\s+.*$/, "").trim();
    if (!looksLikePnResource(resource) && !looksLikePnResource(titlePart)) {
      const afterId = line.replace(/^\s*(P|N\d+[a-z]?)\s+/, "");
      if (!/scripts\/|agent\s+|this loop|references\//i.test(afterId)) {
        continue;
      }
    }
    seen.add(id);
    steps.push({ id, title: title.split(/\s{2,}/)[0] || id, resource });
  }
  return steps;
}

function looksLikePnResource(value: string): boolean {
  return /scripts\/|agent\s+|this loop|references\//i.test(value);
}

function buildPnGraph(input: {
  skillName: string;
  skillRoot: string;
  skillFile: string;
  sourcePath: string;
  steps: PnStep[];
  workflowText: string;
  homedir: string;
}): SkillGraph {
  const nodes: SkillNode[] = [];
  const edges: SkillEdge[] = [];
  const byId = new Map<string, PnStep>();

  for (const step of input.steps) {
    byId.set(step.id, step);
    const resolved = resolvePnResource(step.resource, input.skillRoot, input.homedir);
    let kind = kindForPnResource(step.resource);
    if (/this loop/i.test(step.resource) || /synthesis/i.test(step.title)) {
      kind = "agent";
    }
    let label = `${step.id} · ${shortLabel(step)}`;
    if (step.id === "N7" && /write_analysis|render/i.test(step.resource + step.title)) {
      const script = step.resource.match(/scripts\/[\w.-]+\.py/);
      label = `N7+N8 · ${script ? path.basename(script[0]) : "write.py"}`;
    }
    nodes.push({
      id: `step:${step.id}`,
      label,
      kind,
      path: resolved ?? input.sourcePath,
      summary: step.resource.slice(0, 220),
      excerpt: sectionForPn(input.workflowText, step.id),
      uses: [],
      isEntry: step.id === "P" || step.id === input.steps[0]?.id,
      isBlock: kind === "agent",
    });
  }

  // Question fork (optional diamond) when classify + forensics both exist
  const hasClassify = byId.has("N3");
  const hasForensics = byId.has("N4");
  const hasSynthesis = byId.has("N5");
  if (hasClassify && hasForensics && hasSynthesis) {
    nodes.push({
      id: "gate:question",
      label: "Question?",
      kind: "gate",
      path: input.sourcePath,
      summary: "Question skips forensics; Bug | Change continues.",
      uses: [],
    });
  }

  const ids = input.steps.map((s) => s.id);
  const parallelKids = ids.filter((id) => /^N2[a-z]$/i.test(id));
  const hasQuestionGate = nodes.some((n) => n.id === "gate:question");
  const skipSpecial = (id: string) => /^N2[a-z]$/i.test(id) || /^N[45]v$/i.test(id);

  wire(edges, "P", "N1");
  if (byId.has("N1") && parallelKids.length > 0) {
    for (const kid of parallelKids) {
      wire(edges, "N1", kid, "parallel");
      if (byId.has("N3")) {
        wire(edges, kid, "N3");
      }
    }
  } else if (hasQuestionGate) {
    sequentialWire(
      edges,
      ["P", "N1", "N3"].filter((id) => byId.has(id)),
    );
  } else {
    sequentialWire(
      edges,
      ids.filter((id) => !skipSpecial(id)),
    );
  }

  if (hasQuestionGate) {
    wire(edges, "N3", "gate:question");
    edges.push({ from: "gate:question", to: "step:N5", label: "Question", confidence: "low" });
    edges.push({ from: "gate:question", to: "step:N4", label: "Bug | Change" });
    if (!byId.has("N4v") && byId.has("N4") && byId.has("N5")) {
      wire(edges, "N4", "N5");
    }
  } else if (byId.has("N3") && byId.has("N4")) {
    wire(edges, "N3", "N4");
  }

  wire(edges, "N4", "N4v");
  wire(edges, "N4v", "N5");
  if (byId.has("N5v")) {
    edges.push({ from: "step:N5", to: "step:N5v", label: "conditional", confidence: "low", inferred: true });
    wire(edges, "N5v", "N6");
  }
  wire(edges, "N5", "N6");
  wire(edges, "N6", "N7");
  if (byId.has("N8")) {
    wire(edges, "N7", "N8");
  }

  // Deduplicate edges
  const uniq = new Map<string, SkillEdge>();
  for (const edge of edges) {
    const key = `${edge.from}->${edge.to}:${edge.label ?? ""}`;
    if (!uniq.has(key)) {
      uniq.set(key, edge);
    }
  }

  // Drop edges to missing nodes
  const nodeIds = new Set(nodes.map((n) => n.id));
  const finalEdges = [...uniq.values()].filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to));

  if (!nodes.some((n) => n.isEntry) && nodes[0]) {
    nodes[0].isEntry = true;
  }

  return {
    skillId: `${input.skillName}-procedure`,
    skillName: input.skillName,
    rootPath: input.skillRoot,
    nodes,
    edges: finalEdges,
  };
}

function wire(edges: SkillEdge[], from: string, to: string, label?: string): void {
  const fromId = from.startsWith("step:") || from.startsWith("gate:") ? from : `step:${from}`;
  const toId = to.startsWith("step:") || to.startsWith("gate:") ? to : `step:${to}`;
  edges.push({ from: fromId, to: toId, label });
}

function sequentialWire(edges: SkillEdge[], ids: string[]): void {
  for (let i = 0; i < ids.length - 1; i += 1) {
    wire(edges, ids[i], ids[i + 1]);
  }
}

function shortLabel(step: PnStep): string {
  if (/agent\s+(\S+)/i.test(step.resource)) {
    return RegExp.$1;
  }
  // Prefer the step title ("classify", "synthesis") over a reference basename
  // so this-loop agents do not look like reference files.
  if (/this loop/i.test(step.resource)) {
    return step.title;
  }
  if (/scripts\/(\S+)/i.test(step.resource)) {
    return path.basename(RegExp.$1.split(/\s+/)[0]);
  }
  if (/references\/(\S+)/i.test(step.resource)) {
    return path.basename(RegExp.$1.split(/[,\s]/)[0]);
  }
  return step.title;
}

function kindForPnResource(resource: string): SkillNode["kind"] {
  if (/^agent\b/i.test(resource) || /\bagent\s+\S+/i.test(resource)) {
    return "agent";
  }
  if (/this loop/i.test(resource)) {
    return "agent";
  }
  if (/scripts\//i.test(resource)) {
    return "script";
  }
  if (/references\//i.test(resource)) {
    return "reference";
  }
  return "reference";
}

function resolvePnResource(
  resource: string,
  skillRoot: string,
  homedir: string,
): string | undefined {
  const agent = resource.match(/\bagent\s+(\S+)/i);
  if (agent) {
    const name = agent[1].replace(/[),.`'"]+$/g, "");
    for (const candidate of agentFileCandidates(name, skillRoot, homedir)) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }
  const script = resource.match(/scripts\/[^\s,]+/);
  if (script) {
    const full = path.join(skillRoot, script[0]);
    if (fs.existsSync(full)) {
      return full;
    }
  }
  const ref = resource.match(/references\/[^\s,]+/);
  if (ref) {
    const full = path.join(skillRoot, ref[0]);
    if (fs.existsSync(full)) {
      return full;
    }
  }
  return undefined;
}

function agentFileCandidates(name: string, skillRoot: string, homedir: string): string[] {
  return [
    path.join(skillRoot, "agents", `${name}.md`),
    path.join(skillRoot, "prompts", `${name}.md`),
    path.join(homedir, ".claude", "agents", `${name}.md`),
    path.join(homedir, ".codex", "agents", `${name}.md`),
  ];
}

function sectionForPn(text: string, id: string): string {
  const re = new RegExp(
    `(?:^|\\n)(##\\s+${escapeRegExp(id)}\\b[^\\n]*\\n[\\s\\S]*?)(?=\\n##\\s+|$)`,
  );
  const match = text.match(re);
  return (match?.[1] ?? text.slice(0, 500)).slice(0, 4000);
}

function buildLegacyRoleGraph(input: {
  skillName: string;
  skillRoot: string;
  skillFile: string;
  skillText: string;
  metaDescription: string;
  sourcePath: string;
  steps: WorkflowStep[];
  catalog: CatalogSkill[];
  homedir: string;
}): SkillGraph {
  const { skillName, skillRoot, skillFile, skillText, sourcePath, steps, catalog, homedir } = input;
  const byRole = new Map<StepRole, WorkflowStep>();
  for (const step of steps) {
    const role = stepRole(step);
    if (role !== "work" && !byRole.has(role)) {
      byRole.set(role, step);
    }
  }

  const nodes: SkillNode[] = [];
  const edges: SkillEdge[] = [];

  const intakeStep = byRole.get("intake");
  const evidenceStep = byRole.get("evidence");
  const classifyStep = byRole.get("classify");
  const handoffStep = byRole.get("handoff");
  const workSteps = steps.filter((step) => stepRole(step) === "work");
  const hasQuestionBranch = Boolean(
    classifyStep && /on question|if question/i.test(`${classifyStep.title}\n${classifyStep.body}`),
  );

  const intakeSkills = mentionedSkills(
    `${intakeStep?.body ?? ""}\n${skillText}`,
    skillName,
    catalog,
    ["topdesk", "devops-tickets"],
  );
  const handoffSkills = mentionedSkills(
    `${handoffStep?.body ?? ""}\n${skillText}`,
    skillName,
    catalog,
    ["ticket-handler"],
  );

  for (const skill of intakeSkills) {
    nodes.push(catalogNode(skill, "Intake: live or cached tickets."));
  }

  const spine: string[] = [];

  if (intakeStep) {
    nodes.push({
      id: "gate:intake",
      label: "Intake valid?",
      kind: "gate",
      path: sourcePath,
      summary: firstLine(intakeStep.body) || "Stop when the ticket ref cannot be resolved.",
      excerpt: sectionExcerpt(intakeStep),
      isEntry: true,
      uses: chipsFrom(intakeStep, intakeSkills),
    });
    spine.push("gate:intake");
    for (const skill of intakeSkills) {
      edges.push({
        from: `skill:${skill.name}`,
        to: "gate:intake",
        label: skill.name === "topdesk" ? "incident" : "cache",
      });
    }
  }

  if (evidenceStep) {
    nodes.push({
      id: "gate:evidence",
      label: "Evidence gate",
      kind: "gate",
      path: linkedPath(evidenceStep, skillRoot, homedir) ?? sourcePath,
      summary: firstLine(evidenceStep.body) || "Recordings must be opened before classify.",
      excerpt: sectionExcerpt(evidenceStep),
      uses: chipsFrom(evidenceStep, []),
    });
    spine.push("gate:evidence");
  }

  if (classifyStep) {
    const classifyPath =
      linkedPath(classifyStep, skillRoot, homedir) ?? path.join(skillRoot, "prompts", "classify.md");
    const classifyFile = fs.existsSync(classifyPath) ? classifyPath : sourcePath;
    nodes.push({
      id: "agent:classify",
      label: path.basename(classifyFile, path.extname(classifyFile)),
      kind: "agent",
      path: classifyFile,
      summary: firstLine(classifyStep.body) || "Bug / Change / Question.",
      excerpt: sectionExcerpt(classifyStep),
      isBlock: path.basename(path.dirname(classifyFile)) === "prompts",
      uses: chipsFrom(classifyStep, []),
    });
    spine.push("agent:classify");
  }

  if (hasQuestionBranch) {
    nodes.push(
      {
        id: "gate:label",
        label: "Label valid?",
        kind: "gate",
        path: sourcePath,
        summary: "Question stops; Bug or Change continues.",
        excerpt: classifyStep
          ? sectionExcerpt(classifyStep)
          : "Question: answer direction. Bug or Change: continue.",
        uses: [{ label: "Question → answer" }, { label: "Bug | Change → analyse" }],
      },
      {
        id: "out:question",
        label: "Answer direction",
        kind: "shared",
        path: sourcePath,
        summary: "Terminal path: no suspect files, no fix plan.",
        excerpt:
          "Replace Suspect files / Git history / Fix plan with Answer direction. Still write the handoff file.",
        uses: [{ label: "customer language" }],
      },
    );
    spine.push("gate:label");
    edges.push({
      from: "gate:label",
      to: "out:question",
      inferred: true,
      label: "Question",
      confidence: "low",
    });
  }

  const hasWork = workSteps.length > 0 || Boolean(classifyStep && handoffStep);
  if (hasWork) {
    nodes.push({
      id: "skill:self",
      label: skillName,
      kind: "skill",
      path: skillFile,
      summary: firstLine(stripFrontmatter(skillText)) || input.metaDescription,
      excerpt: workSteps.map((step) => `${step.number}. ${step.title}`).join("\n") || input.metaDescription,
      uses: workSteps.slice(0, 4).map((step) => ({ label: step.title })),
    });
    spine.push("skill:self");
    if (hasQuestionBranch) {
      edges.push({ from: "gate:label", to: "skill:self", label: "Bug | Change" });
    }
  }

  for (const skill of handoffSkills) {
    nodes.push(catalogNode(skill, "Implement the fix after an explicit handoff."));
    const from = hasWork ? "skill:self" : spine[spine.length - 1];
    if (from) {
      edges.push({ from, to: `skill:${skill.name}`, label: "handoff" });
    }
  }

  for (let i = 0; i < spine.length - 1; i += 1) {
    const from = spine[i];
    const to = spine[i + 1];
    if (from === "gate:label" && to === "skill:self") {
      continue;
    }
    if (edges.some((edge) => edge.from === from && edge.to === to)) {
      continue;
    }
    edges.push({
      from,
      to,
      label: spineLabel(from, to),
    });
  }

  if (!nodes.some((node) => node.isEntry) && nodes[0]) {
    nodes[0].isEntry = true;
  }

  return {
    skillId: `${skillName}-procedure`,
    skillName,
    rootPath: skillRoot,
    nodes,
    edges,
  };
}

function extractSteps(text: string): WorkflowStep[] | undefined {
  if (!text.trim()) {
    return undefined;
  }
  const lines = text.split(/\r?\n/);
  const starts: Array<{ index: number; number: string; title: string }> = [];
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(HEADING_RE);
    if (match) {
      starts.push({ index: i, number: match[1], title: match[2].trim() });
    }
  }
  if (starts.length === 0) {
    return undefined;
  }
  return starts.map((start, i) => {
    const end = starts[i + 1]?.index ?? lines.length;
    return {
      number: start.number,
      title: start.title,
      body: lines.slice(start.index + 1, end).join("\n").trim(),
    };
  });
}

function extractStepsFromSkill(skillText: string): WorkflowStep[] {
  const body = stripFrontmatter(skillText);
  const sectionRe =
    /^##\s+(Workflow|First Steps|Procedure|Bootstrap|How it runs|Operations|Instructions|Usage|Steps|Getting Started)\b.*$/im;
  const match = body.match(sectionRe);
  let slice = body;
  if (match && match.index !== undefined) {
    slice = body.slice(match.index);
    const nextHeading = slice.slice(1).search(/^##\s+/m);
    if (nextHeading >= 0) {
      slice = slice.slice(0, nextHeading + 1);
    }
  }
  const fromSection = extractNumberedList(slice);
  if (fromSection.length > 0) {
    return fromSection;
  }
  return extractNumberedList(body);
}

function extractNumberedList(text: string): WorkflowStep[] {
  const steps: WorkflowStep[] = [];
  const seen = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    const match = trimmed.match(LIST_BOLD_RE) ?? trimmed.match(LIST_PLAIN_RE);
    if (!match) {
      continue;
    }
    const number = match[1];
    if (seen.has(number)) {
      continue;
    }
    seen.add(number);
    steps.push({
      number,
      title: plainStepTitle(match[2]),
      body: trimmed,
    });
  }
  return steps.length >= 2 ? steps : [];
}

function plainStepTitle(raw: string): string {
  const cut = raw.split(/\s+[—–-]\s+|:\s+/)[0] ?? raw;
  return cut.replace(/\*\*/g, "").trim();
}

function findOperationsPath(
  skillText: string,
  skillRoot: string,
  homedir: string,
): string | undefined {
  for (const match of skillText.matchAll(LINK_RE)) {
    const href = match[2].trim().split("#")[0];
    if (!/operations\.md$/i.test(href)) {
      continue;
    }
    const resolved = href.startsWith("~/")
      ? path.resolve(href.replace(/^~(?=\/|$)/, homedir))
      : path.resolve(skillRoot, href);
    if (fs.existsSync(resolved)) {
      return resolved;
    }
  }
  const fallback = path.join(skillRoot, "operations.md");
  return fs.existsSync(fallback) ? fallback : undefined;
}

function stepRole(step: WorkflowStep): StepRole {
  const text = `${step.title}\n${step.body}`;
  if (/handoff|hand off/i.test(text) && /analysis|ticket-handler|write/i.test(text)) {
    return "handoff";
  }
  if (/classify/i.test(step.title) || /prompts\/classify/i.test(text)) {
    return "classify";
  }
  if (/\bgated\b|evidence-sources|confidence ceiling|unopened recording/i.test(text)) {
    return "evidence";
  }
  if (/resolve the ticket|could not resolve|no resolution/i.test(text)) {
    return "intake";
  }
  return "work";
}

function mentionedSkills(
  text: string,
  selfName: string,
  catalog: CatalogSkill[],
  prefer: string[],
): CatalogSkill[] {
  const found = catalog.filter((skill) => {
    if (skill.name === selfName) {
      return false;
    }
    return (
      text.includes(`\`${skill.name}\``) ||
      text.includes(`**\`${skill.name}\``) ||
      new RegExp(`\\b${escapeRegExp(skill.name)}\\b`).test(text)
    );
  });
  const preferred = found.filter((skill) => prefer.includes(skill.name));
  return (preferred.length > 0 ? preferred : found).sort((a, b) => a.name.localeCompare(b.name));
}

function catalogNode(skill: CatalogSkill, summary: string): SkillNode {
  return {
    id: `skill:${skill.name}`,
    label: skill.name,
    kind: "skill",
    path: path.join(skill.rootPath, "SKILL.md"),
    summary: skill.description || summary,
    excerpt: skill.description || summary,
    uses: [],
  };
}

function chipsFrom(step: WorkflowStep, extras: CatalogSkill[]): UseChip[] {
  const chips: UseChip[] = extras.map((skill) => ({
    label: skill.name,
    targetId: `skill:${skill.name}`,
  }));
  for (const match of step.body.matchAll(LINK_RE)) {
    const label = path.basename(match[2].split("#")[0]) || match[1];
    if (!chips.some((chip) => chip.label === label)) {
      chips.push({ label });
    }
  }
  return chips.slice(0, 4);
}

function linkedPath(step: WorkflowStep, skillRoot: string, homedir: string): string | undefined {
  for (const match of step.body.matchAll(LINK_RE)) {
    const href = match[2].trim().split("#")[0];
    if (!href || /^[a-z]+:\/\//i.test(href)) {
      continue;
    }
    const resolved = href.startsWith("~/")
      ? path.resolve(href.replace(/^~(?=\/|$)/, homedir))
      : path.resolve(skillRoot, href);
    if (fs.existsSync(resolved)) {
      return resolved;
    }
  }
  return undefined;
}

function findWorkflowPath(skillText: string, skillRoot: string, homedir: string): string | undefined {
  for (const match of skillText.matchAll(LINK_RE)) {
    const href = match[2].trim().split("#")[0];
    if (!/workflow[^/]*\.md$/i.test(href) && !/\/workflow\.md$/i.test(href)) {
      // allow references/workflow.md and workflow.md
      if (!/workflow\.md$/i.test(href)) {
        continue;
      }
    }
    if (!/workflow\.md$/i.test(href)) {
      continue;
    }
    const resolved = href.startsWith("~/")
      ? path.resolve(href.replace(/^~(?=\/|$)/, homedir))
      : path.resolve(skillRoot, href);
    if (fs.existsSync(resolved)) {
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

function sectionExcerpt(step: WorkflowStep): string {
  return `# ${step.number}. ${step.title}\n\n${step.body}`.slice(0, 4000);
}

function firstLine(text: string): string {
  const line = text
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find((item) => item && !item.startsWith("#") && !item.startsWith("|") && item !== "---");
  return (line ?? "").slice(0, 220);
}

function spineLabel(from: string, to: string): string | undefined {
  if (from === "gate:intake" && to === "gate:evidence") {
    return "ticket";
  }
  if (from === "gate:evidence" && to === "agent:classify") {
    return "gated";
  }
  if (from === "agent:classify" && to === "gate:label") {
    return "label";
  }
  return undefined;
}

function stripFrontmatter(text: string): string {
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
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
