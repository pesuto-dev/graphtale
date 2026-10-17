import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { readTextFile, INPUT_READ_LIMIT_BYTES, FLOW_MAX_STEPS } from "./fileAccess";
import { parseFrontmatter } from "./frontmatter";
import type { Detection } from "./procedureDetection";
import { detectSteps } from "./procedureDetection";
import { buildStepGraph, partialResult, wrapWithSource } from "./procedureGraph";
import { resolveSkillResource, type ResourceResolver } from "./procedureResources";
import type { CatalogSkill, ProcedureDiagnosis, ProcedureResult, SkillGraph } from "./shared/protocol";
import { buildFixPrompt, emptyDiagnosis } from "./shared/protocol";
import { frontmatterNeverCloses, stripBom } from "./text";

export type ParseProcedureOptions = { skillRoot: string; catalog: CatalogSkill[]; homedir?: string };
/** @deprecated use ParseProcedureOptions */
export type ParsePipelineOptions = ParseProcedureOptions;

const LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;

type LoadedSkill = {
  skillRoot: string;
  skillFile: string;
  skillText: string;
  skillName: string;
  homedir: string;
  warnings: string[];
};

type Candidate = { path: string; text: string };

export function parseProcedure(options: ParseProcedureOptions): ProcedureResult {
  const loaded = loadSkill(options);
  for (const candidate of candidateDocs(loaded)) {
    noteUnclosed(candidate, loaded);
    const detection = detectSteps(candidate.text, candidate.path);
    if (!detection || detection.steps.length < 1) continue;
    capSteps(detection, loaded.warnings);
    const graph = wrapWithSource(
      buildStepGraph(loaded.skillName, loaded.skillRoot, detection, resourceResolver(loaded)),
      loaded.skillFile,
      loaded.skillText,
      candidate.text,
    );
    const diagnosis = flowDiagnosis(detection, path.basename(candidate.path), loaded.skillName, loaded.warnings);
    return finish(graph, diagnosis, loaded.warnings);
  }
  return unfinished(loaded);
}

function loadSkill(options: ParseProcedureOptions): LoadedSkill {
  const skillRoot = path.resolve(options.skillRoot);
  const skillFile = path.join(skillRoot, "SKILL.md");
  const warnings: string[] = [];
  const skillText = readInput(skillFile, warnings);
  const meta = parseFrontmatter(skillText);
  if (meta.error) warnings.push(`SKILL.md: ${meta.error}`);
  return {
    skillRoot,
    skillFile,
    skillText,
    skillName: meta.name || path.basename(skillRoot),
    homedir: options.homedir ?? os.homedir(),
    warnings,
  };
}

function resourceResolver(loaded: LoadedSkill): ResourceResolver {
  return (resource, sourcePath) => resolveSkillResource({
    resource,
    skillRoot: loaded.skillRoot,
    homedir: loaded.homedir,
    sourcePath,
  });
}

function readInput(file: string, warnings: string[]): string {
  const result = readTextFile(file, INPUT_READ_LIMIT_BYTES);
  if (result.warning) warnings.push(result.warning);
  return stripBom(result.text);
}

function candidateDocs(loaded: LoadedSkill): Candidate[] {
  const workflowPath = findLinkedPath(loaded.skillText, loaded.skillRoot, loaded.homedir, "workflow.md");
  const operationsPath = findLinkedPath(loaded.skillText, loaded.skillRoot, loaded.homedir, "operations.md");
  const docs: Candidate[] = [{ path: loaded.skillFile, text: loaded.skillText }];
  if (workflowPath) docs.unshift({ path: workflowPath, text: readInput(workflowPath, loaded.warnings) });
  if (operationsPath && operationsPath !== workflowPath) docs.push({ path: operationsPath, text: readInput(operationsPath, loaded.warnings) });
  return docs;
}

function noteUnclosed(candidate: Candidate, loaded: LoadedSkill): void {
  if (path.resolve(candidate.path) === path.resolve(loaded.skillFile)) return;
  if (!frontmatterNeverCloses(candidate.text)) return;
  loaded.warnings.push(`${path.basename(candidate.path)}: Frontmatter is missing its closing ---.`);
}

function capSteps(detection: Detection, warnings: string[]): void {
  if (detection.steps.length <= FLOW_MAX_STEPS) return;
  detection.steps = detection.steps.slice(0, FLOW_MAX_STEPS);
  detection.links = detection.links.filter((link) => link.from < FLOW_MAX_STEPS && link.to < FLOW_MAX_STEPS);
  warnings.push(`Flow stopped after ${FLOW_MAX_STEPS} steps.`);
}

function flowDiagnosis(detection: Detection, sourceName: string, skillName: string, warnings: string[]): ProcedureDiagnosis {
  const explicit = detection.relationships === "explicit";
  const confidence = explicit && warnings.length === 0 ? "high" : "partial";
  const detail = explicit
    ? "The ordered steps are stated in the source."
    : "Some relationships are unresolved or only part of the structure is supported.";
  const message = `Flow detected from ${sourceName} as ${detection.sourceKind} (${detection.steps.length} steps). ${detail}`;
  return { confidence, message, fixPrompt: buildFixPrompt(skillName, detail) };
}

function unfinished(loaded: LoadedSkill): ProcedureResult {
  const linked = linkedPath(loaded);
  if (!linked) {
    const graph: SkillGraph = {
      skillId: `${loaded.skillName}-procedure`,
      skillName: loaded.skillName,
      rootPath: loaded.skillRoot,
      nodes: [],
      edges: [],
    };
    return finish(graph, emptyDiagnosis(loaded.skillName), loaded.warnings);
  }
  const result = partialResult({
    skillName: loaded.skillName,
    skillRoot: loaded.skillRoot,
    skillFile: loaded.skillFile,
    skillText: loaded.skillText,
    linkedPath: linked,
    linkedText: readInput(linked, loaded.warnings),
  });
  return finish(result.graph, result.diagnosis, loaded.warnings);
}

function linkedPath(loaded: LoadedSkill): string | undefined {
  return findLinkedPath(loaded.skillText, loaded.skillRoot, loaded.homedir, "workflow.md")
    ?? findLinkedPath(loaded.skillText, loaded.skillRoot, loaded.homedir, "operations.md");
}

/** Every parseProcedure return must go through finish() so warnings reach the diagnosis. */
function finish(graph: SkillGraph, diagnosis: ProcedureDiagnosis, warnings: string[]): ProcedureResult {
  const notes = [...new Set([...(graph.warnings ?? []), ...warnings])];
  const extra = notes.filter((note) => !diagnosis.message.includes(note));
  const message = extra.length ? `${diagnosis.message} ${extra.join(" ")}` : diagnosis.message;
  const fixPrompt = extra.length ? `${diagnosis.fixPrompt}\n\nAlso observed:\n${extra.join("\n")}` : diagnosis.fixPrompt;
  const confidence = diagnosis.confidence === "high" && notes.length > 0 ? "partial" : diagnosis.confidence;
  return { graph: { ...graph, warnings: notes }, diagnosis: { ...diagnosis, confidence, message, fixPrompt } };
}

/** @deprecated Prefer parseProcedure; returns only the graph. */
export function parsePipeline(options: ParsePipelineOptions): SkillGraph {
  return parseProcedure(options).graph;
}

function findLinkedPath(text: string, skillRoot: string, homedir: string, basename: string): string | undefined {
  const candidates = linkedCandidates(text, basename);
  for (const candidate of candidates) {
    const resolved = candidate.startsWith("~/") ? path.resolve(homedir, candidate.slice(2)) : path.resolve(skillRoot, candidate);
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) return resolved;
  }
  return undefined;
}

function linkedCandidates(text: string, basename: string): string[] {
  const fromLinks: string[] = [];
  for (const match of text.matchAll(LINK_RE)) {
    const href = (match[2] ?? "").trim().split("#")[0] ?? "";
    if (path.basename(href).toLowerCase() === basename) fromLinks.push(href);
  }
  return [...fromLinks, basename, path.join("references", basename)];
}
