import * as os from "node:os";
import * as path from "node:path";
import { readTextFile, INPUT_READ_LIMIT_BYTES, FLOW_MAX_STEPS } from "./fileAccess";
import { parseFrontmatter } from "./frontmatter";
import { procedureFromHeadings } from "./headingFallback";
import type { CatalogSkill, ProcedureDiagnosis, ProcedureResult, SkillGraph } from "./shared/protocol";
import { emptyDiagnosis } from "./shared/protocol";
import { flowDiagnosis, limitFlowSteps } from "./procedureDiagnosis";
import { detectSteps } from "./procedureDetection";
import { buildStepGraph, partialResult, wrapWithSource } from "./procedureGraph";
import { findLinkedPath, resolveResource } from "./procedureResources";
import { frontmatterNeverCloses, stripBom } from "./text";

export interface ParseProcedureOptions { skillRoot: string; catalog: CatalogSkill[]; homedir?: string }
/** @deprecated use ParseProcedureOptions */
export type ParsePipelineOptions = ParseProcedureOptions;

interface ProcedureCandidate { path: string; text: string }

interface ProcedureLoad {
  skillName: string;
  skillRoot: string;
  skillFile: string;
  skillText: string;
  homedir: string;
  warnings: string[];
  candidates: ProcedureCandidate[];
  linked?: string;
}

export function parseProcedure(options: ParseProcedureOptions): ProcedureResult {
  const loaded = loadProcedure(options);
  for (const candidate of loaded.candidates) {
    const result = procedureFromCandidate(loaded, candidate);
    if (result) return result;
  }
  return procedureWithoutSteps(loaded);
}

function loadProcedure(options: ParseProcedureOptions): ProcedureLoad {
  const skillRoot = path.resolve(options.skillRoot);
  const skillFile = path.join(skillRoot, "SKILL.md");
  const warnings: string[] = [];
  const readInput = (file: string): string => {
    const result = readTextFile(file, INPUT_READ_LIMIT_BYTES);
    if (result.warning) warnings.push(result.warning);
    return stripBom(result.text);
  };
  const skillText = readInput(skillFile);
  const meta = parseFrontmatter(skillText);
  if (meta.error) warnings.push(`SKILL.md: ${meta.error}`);
  const homedir = options.homedir ?? os.homedir();
  const workflowPath = findLinkedPath(skillText, skillRoot, homedir, "workflow.md");
  const operationsPath = findLinkedPath(skillText, skillRoot, homedir, "operations.md");
  return {
    skillName: meta.name || path.basename(skillRoot),
    skillRoot, skillFile, skillText, homedir, warnings,
    candidates: procedureCandidates({ skillFile, skillText, workflowPath, operationsPath, readInput }),
    linked: workflowPath ?? operationsPath,
  };
}

interface ProcedureCandidateSource {
  skillFile: string;
  skillText: string;
  workflowPath?: string;
  operationsPath?: string;
  readInput: (file: string) => string;
}

function procedureCandidates(source: ProcedureCandidateSource): ProcedureCandidate[] {
  const workflow = source.workflowPath
    ? [{ path: source.workflowPath, text: source.readInput(source.workflowPath) }]
    : [];
  const operations = source.operationsPath && source.operationsPath !== source.workflowPath
    ? [{ path: source.operationsPath, text: source.readInput(source.operationsPath) }]
    : [];
  return [...workflow, { path: source.skillFile, text: source.skillText }, ...operations];
}

function procedureFromCandidate(loaded: ProcedureLoad, candidate: { path: string; text: string }): ProcedureResult | undefined {
  noteUnclosed(loaded, candidate);
  const found = detectSteps(candidate.text, candidate.path);
  if (!found || found.steps.length < 1) return undefined;
  const capped = limitFlowSteps(found, FLOW_MAX_STEPS);
  if (capped.warning) loaded.warnings.push(capped.warning);
  const graph = wrapWithSource({
    graph: buildStepGraph(
      loaded.skillName,
      loaded.skillRoot,
      capped.detection,
      (resource, sourcePath) => resolveResource(resource, loaded.skillRoot, loaded.homedir, sourcePath),
    ),
    skillFile: loaded.skillFile,
    skillText: loaded.skillText,
    sourceText: candidate.text,
  });
  return finish(graph, flowDiagnosis({
    detection: capped.detection,
    sourceName: path.basename(candidate.path),
    skillName: loaded.skillName,
    warning: capped.warning,
    hasWarnings: loaded.warnings.length > 0,
  }), loaded.warnings);
}

function noteUnclosed(loaded: ProcedureLoad, candidate: ProcedureCandidate): void {
  if (path.resolve(candidate.path) === path.resolve(loaded.skillFile)) return;
  if (!frontmatterNeverCloses(candidate.text)) return;
  loaded.warnings.push(`${path.basename(candidate.path)}: Frontmatter is missing its closing ---.`);
}

function procedureWithoutSteps(loaded: ProcedureLoad): ProcedureResult {
  const headings = procedureFromHeadings({
    skillName: loaded.skillName,
    skillRoot: loaded.skillRoot,
    skillFile: loaded.skillFile,
    skillText: loaded.skillText,
    candidates: loaded.candidates,
    warnings: loaded.warnings,
  });
  if (headings) return finish(headings.graph, headings.diagnosis, loaded.warnings);
  if (!loaded.linked) {
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
    linkedPath: loaded.linked,
    linkedText: readText(loaded.linked),
  });
  return finish(result.graph, result.diagnosis, loaded.warnings);
}

/** Every parseProcedure return must go through finish() so warnings reach the diagnosis. */
function finish(graph: SkillGraph, diagnosis: ProcedureDiagnosis, warnings: string[]): ProcedureResult {
  const notes = [...new Set([...(graph.warnings ?? []), ...warnings])];
  const extra = notes.filter(note => !diagnosis.message.includes(note));
  const message = extra.length > 0 ? `${diagnosis.message} ${extra.join(" ")}` : diagnosis.message;
  const fixPrompt = extra.length > 0 ? `${diagnosis.fixPrompt}\n\nAlso observed:\n${extra.join("\n")}` : diagnosis.fixPrompt;
  const confidence = diagnosis.confidence === "high" && notes.length > 0 ? "partial" : diagnosis.confidence;
  return { graph: { ...graph, warnings: notes }, diagnosis: { ...diagnosis, confidence, message, fixPrompt } };
}

/** @deprecated Prefer parseProcedure; returns only the graph. */
export function parsePipeline(options: ParseProcedureOptions): SkillGraph {
  return parseProcedure(options).graph;
}

function readText(filePath: string): string {
  return stripBom(readTextFile(filePath, INPUT_READ_LIMIT_BYTES).text);
}
