import * as os from "node:os";
import * as path from "node:path";
import { readTextFile, INPUT_READ_LIMIT_BYTES, FLOW_MAX_STEPS } from "./fileAccess";
import { parseFrontmatter } from "./discover";
import type { CatalogSkill, ProcedureResult, SkillGraph } from "./shared/protocol";
import { emptyDiagnosis } from "./shared/protocol";
import { flowDiagnosis, limitFlowSteps } from "./procedureDiagnosis";
import { detectSteps } from "./procedureDetection";
import { buildStepGraph, partialResult, wrapWithSource } from "./procedureGraph";
import { findLinkedPath, resolveResource } from "./procedureResources";

export type ParseProcedureOptions = { skillRoot: string; catalog: CatalogSkill[]; homedir?: string };
/** @deprecated use ParseProcedureOptions */
export type ParsePipelineOptions = ParseProcedureOptions;

type ProcedureLoad = {
  skillName: string;
  skillRoot: string;
  skillFile: string;
  skillText: string;
  homedir: string;
  warnings: string[];
  candidates: Array<{ path: string; text: string }>;
  linked?: string;
};

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
    return result.text;
  };
  const skillText = readInput(skillFile);
  const meta = parseFrontmatter(skillText);
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

function procedureCandidates(source: {
  skillFile: string;
  skillText: string;
  workflowPath?: string;
  operationsPath?: string;
  readInput: (file: string) => string;
}): Array<{ path: string; text: string }> {
  const workflow = source.workflowPath
    ? [{ path: source.workflowPath, text: source.readInput(source.workflowPath) }]
    : [];
  const operations = source.operationsPath && source.operationsPath !== source.workflowPath
    ? [{ path: source.operationsPath, text: source.readInput(source.operationsPath) }]
    : [];
  return [...workflow, { path: source.skillFile, text: source.skillText }, ...operations];
}

function procedureFromCandidate(loaded: ProcedureLoad, candidate: { path: string; text: string }): ProcedureResult | undefined {
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
  graph.warnings = [...new Set(loaded.warnings)];
  return {
    graph,
    diagnosis: flowDiagnosis({
      detection: capped.detection,
      sourceName: path.basename(candidate.path),
      skillName: loaded.skillName,
      warning: capped.warning,
      hasWarnings: loaded.warnings.length > 0,
    }),
  };
}

function procedureWithoutSteps(loaded: ProcedureLoad): ProcedureResult {
  if (!loaded.linked) {
    return {
      graph: { skillId: `${loaded.skillName}-procedure`, skillName: loaded.skillName, rootPath: loaded.skillRoot, nodes: [], edges: [], warnings: loaded.warnings },
      diagnosis: emptyDiagnosis(loaded.skillName),
    };
  }
  const result = partialResult({
    skillName: loaded.skillName,
    skillRoot: loaded.skillRoot,
    skillFile: loaded.skillFile,
    skillText: loaded.skillText,
    linkedPath: loaded.linked,
    linkedText: readText(loaded.linked),
  });
  result.graph.warnings = loaded.warnings;
  return result;
}

/** @deprecated Prefer parseProcedure; returns only the graph. */
export function parsePipeline(options: ParsePipelineOptions): SkillGraph {
  return parseProcedure(options).graph;
}

function readText(filePath: string): string {
  return readTextFile(filePath, INPUT_READ_LIMIT_BYTES).text;
}
