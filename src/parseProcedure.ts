import * as os from "node:os";
import * as path from "node:path";
import { readTextFile, INPUT_READ_LIMIT_BYTES, FLOW_MAX_STEPS } from "./fileAccess";
import { parseFrontmatter } from "./frontmatter";
import { procedureFromHeadings } from "./headingFallback";
import type { CatalogSkill, ProcedureDiagnosis, ProcedureResult, SkillGraph } from "./shared/protocol";
import { emptyDiagnosis, withFixContext } from "./shared/protocol";
import { flowDiagnosis, limitFlowSteps } from "./procedureDiagnosis";
import { detectSteps } from "./procedureDetection";
import { buildStepGraph, partialResult, wrapWithSource } from "./procedureGraph";
import { findLinkedPath, resolveResource } from "./procedureResources";
import { readScope } from "./readScope";
import { procedureFromRouter } from "./procedureRouter";
import { repairPlan, type RepairOrigin, type RepairPlanText } from "./repairPlan";
import { languagesFile, loadVocabulary, type Vocabulary } from "./procedureVocabulary";
import { frontmatterNeverCloses, stripBom } from "./text";

export interface ParseProcedureOptions { skillRoot: string; catalog: CatalogSkill[]; homedir?: string; workspaceFolders?: string[] }
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
  vocabulary: Vocabulary;
  catalog: CatalogSkill[];
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
  const languages = loadVocabulary(homedir);
  if (languages.warning) warnings.push(languages.warning);
  const scope = readScope({ skillRoot, homedir, workspaceFolders: options.workspaceFolders, catalog: options.catalog });
  const workflowPath = findLinkedPath(skillText, scope, "workflow.md", warnings);
  const operationsPath = findLinkedPath(skillText, scope, "operations.md", warnings);
  return {
    skillName: meta.name || path.basename(skillRoot),
    skillRoot, skillFile, skillText, homedir, warnings,
    candidates: procedureCandidates({ skillFile, skillText, workflowPath, operationsPath, readInput }),
    linked: workflowPath ?? operationsPath,
    vocabulary: languages.vocabulary,
    catalog: options.catalog,
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
  const found = detectSteps(candidate.text, candidate.path, loaded.vocabulary);
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
  const diagnosis = flowDiagnosis({
    detection: capped.detection,
    sourceName: path.basename(candidate.path),
    skillName: loaded.skillName,
    warning: capped.warning,
    hasWarnings: loaded.warnings.length > 0,
  });
  return finish(loaded, graph, diagnosis, {
    shape: capped.detection.sourceKind === "P/N rows" ? "pn" : "steps",
    sourcePath: candidate.path,
    sourceText: candidate.text,
    explicit: capped.detection.relationships === "explicit",
    named: (capped.detection.findings?.length ?? 0) > 0,
  });
}

function noteUnclosed(loaded: ProcedureLoad, candidate: ProcedureCandidate): void {
  if (path.resolve(candidate.path) === path.resolve(loaded.skillFile)) return;
  if (!frontmatterNeverCloses(candidate.text)) return;
  loaded.warnings.push(`${path.basename(candidate.path)}: Frontmatter is missing its closing ---.`);
}

function procedureWithoutSteps(loaded: ProcedureLoad): ProcedureResult {
  const router = procedureFromRouter(loaded);
  if (router) return finish(loaded, router.graph, router.diagnosis, unordered("router", loaded.skillFile, loaded.skillText));
  const headings = procedureFromHeadings({
    skillName: loaded.skillName,
    skillRoot: loaded.skillRoot,
    skillFile: loaded.skillFile,
    skillText: loaded.skillText,
    candidates: loaded.candidates,
    warnings: loaded.warnings,
    vocabulary: loaded.vocabulary,
  });
  if (headings) return finish(loaded, headings.graph, headings.diagnosis, { ...unordered("headings", headings.sourcePath, headings.sourceText), lists: headings.lists });
  if (!loaded.linked) {
    const graph: SkillGraph = {
      skillId: `${loaded.skillName}-procedure`,
      skillName: loaded.skillName,
      rootPath: loaded.skillRoot,
      nodes: [],
      edges: [],
    };
    return finish(loaded, graph, emptyDiagnosis(loaded.skillName), unordered("none", loaded.skillFile, loaded.skillText));
  }
  const linkedText = readText(loaded.linked);
  const result = partialResult({
    skillName: loaded.skillName,
    skillRoot: loaded.skillRoot,
    skillFile: loaded.skillFile,
    skillText: loaded.skillText,
    linkedPath: loaded.linked,
    linkedText,
  });
  return finish(loaded, result.graph, result.diagnosis, unordered("linked", loaded.linked, linkedText));
}

function unordered(shape: RepairOrigin["shape"], sourcePath: string, sourceText: string): RepairOrigin {
  return { shape, sourcePath, sourceText, explicit: false, named: false };
}

/** Every parseProcedure return must go through finish() so warnings reach the diagnosis. */
function finish(loaded: ProcedureLoad, graph: SkillGraph, diagnosis: ProcedureDiagnosis, origin: RepairOrigin): ProcedureResult {
  const notes = [...new Set([...(graph.warnings ?? []), ...loaded.warnings])];
  const extra = notes.filter(note => !diagnosis.message.includes(note));
  const message = extra.length > 0 ? `${diagnosis.message} ${extra.join(" ")}` : diagnosis.message;
  const prompt = extra.length > 0 ? `${diagnosis.fixPrompt}\n\nAlso observed:\n${extra.join("\n")}` : diagnosis.fixPrompt;
  const confidence = diagnosis.confidence === "high" && notes.length > 0 ? "partial" : diagnosis.confidence;
  const fixPrompt = withFixContext(prompt, {
    skillFile: loaded.skillFile,
    languagesFile: languagesFile(loaded.homedir),
    languages: loaded.vocabulary.languages,
    plan: confidence === "high" ? undefined : planFor(loaded, origin),
  });
  return { graph: { ...graph, warnings: notes }, diagnosis: { ...diagnosis, confidence, message, fixPrompt } };
}

function planFor(loaded: ProcedureLoad, origin: RepairOrigin): RepairPlanText {
  return repairPlan({
    skillName: loaded.skillName,
    skillRoot: loaded.skillRoot,
    skillFile: loaded.skillFile,
    skillText: loaded.skillText,
    vocabulary: loaded.vocabulary,
    catalog: loaded.catalog,
    homedir: loaded.homedir,
    origin,
    workflowFile: loaded.candidates.find((candidate) => /workflow\.md$/i.test(candidate.path))?.path,
  });
}

/** @deprecated Prefer parseProcedure; returns only the graph. */
export function parsePipeline(options: ParseProcedureOptions): SkillGraph {
  return parseProcedure(options).graph;
}

function readText(filePath: string): string {
  return stripBom(readTextFile(filePath, INPUT_READ_LIMIT_BYTES).text);
}
