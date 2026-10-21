import * as path from "node:path";
import { FLOW_MAX_STEPS } from "./fileAccess";
import { skillDocumentNode, procedureSourceNode } from "./flowNodes";
import { numberedLists, type NumberedList } from "./procedureLists";
import { matchHeading, popParentsAtOrAbove, visibleLines } from "./procedureLines";
import { ENGLISH, type Vocabulary } from "./procedureVocabulary";
import type { ProcedureDiagnosis, ProcedureResult, SkillEdge, SkillGraph, SkillNode } from "./shared/protocol";
import { buildFixPrompt } from "./shared/protocol";
import { firstLine, nameFirst } from "./text";

/** Diagnosis phrase for prose headings that do not state an execution order. */
export const HEADING_HEURISTIC = "heuristic: headings, no order";

/** Short before/after authors can copy into a real numbered flow. */
export const HEADING_REWRITE_EXAMPLE = [
  "Prose headings are not a procedure. Number the same work to get an ordered flow.",
  "",
  "Before:",
  "## Gather",
  "Read the ticket and note the product area.",
  "",
  "## Classify",
  "Decide whether this is a bug or a question.",
  "",
  "After:",
  "## First Steps",
  "1. Gather: read the ticket and note the product area.",
  "2. Classify: decide whether this is a bug or a question.",
].join("\n");

export interface HeadingHit {
  title: string;
  body: string;
  line: number;
}

interface HeadingParent {
  level: number;
  excluded: boolean;
}

interface HeadingArgs {
  skillName: string;
  skillRoot: string;
  skillFile: string;
  skillText: string;
  candidates: { path: string; text: string }[];
  warnings: string[];
  vocabulary?: Vocabulary;
}

interface BuiltHeadingGraph {
  skill: HeadingArgs;
  sourcePath: string;
  sourceText: string;
  hits: HeadingHit[];
  warnings: string[];
}

/** Level-2 and level-3 headings, in source order, outside excluded sections and fences. */
export function detectUnorderedHeadings(text: string, vocabulary: Vocabulary): HeadingHit[] {
  const visible = visibleLines(text, false, vocabulary);
  const original = text.split(/\r?\n/);
  const parents: HeadingParent[] = [];
  const hits: HeadingHit[] = [];
  for (let i = 0; i < visible.length; i++) {
    const heading = matchHeading(visible[i]);
    if (!heading) continue;
    const level = heading.level;
    popParentsAtOrAbove(parents, level);
    const title = heading.title.replace(/\*\*/g, "").trim();
    const excluded = vocabulary.isSkipSection(heading.title) || parents.some((parent) => parent.excluded);
    parents.push({ level, excluded });
    if (excluded || !title || (level !== 2 && level !== 3)) continue;
    let end = i + 1;
    while (end < visible.length && !matchHeading(visible[end])) end++;
    hits.push({ title, body: original.slice(i + 1, end).join("\n").trim(), line: i + 1 });
  }
  return hits;
}

/** First candidate with ##/### headings, after numbered lists and P/N rows have failed. */
/** The heading result plus the file it came from and its step lists, so the repair plan need not scan again. */
export type HeadingResult = ProcedureResult & { sourcePath: string; sourceText: string; lists: NumberedList[] };

/** First candidate with ##/### headings, after numbered lists and P/N rows have failed. */
export function procedureFromHeadings(args: HeadingArgs): HeadingResult | undefined {
  for (const candidate of args.candidates) {
    const hits = detectUnorderedHeadings(candidate.text, args.vocabulary ?? ENGLISH);
    if (!hits.length) continue;
    const warnings = [...args.warnings];
    const kept = hits.slice(0, FLOW_MAX_STEPS);
    if (kept.length < hits.length) warnings.push(`Flow shows ${String(FLOW_MAX_STEPS)} of ${String(hits.length)} steps.`);
    const fileName = path.basename(candidate.path);
    const lists = numberedLists(candidate.text, args.vocabulary ?? ENGLISH);
    return {
      sourcePath: candidate.path,
      sourceText: candidate.text,
      lists,
      graph: buildGraph({ skill: args, sourcePath: candidate.path, sourceText: candidate.text, hits: kept, warnings }),
      diagnosis: diagnosisFor(args.skillName, fileName, kept.length, lists),
    };
  }
  return undefined;
}

const MAX_NAMED_LISTS = 4;

/** Steps Flow skipped: lists under headings that are not step sections, and "Step 1:" headings. */
function unreadDetail(fileName: string, lists: NumberedList[]): string {
  const plain = lists.filter((list) => !list.stepLike);
  const stepLike = lists.filter((list) => list.stepLike);
  const parts: string[] = [];
  if (plain.length > 0) {
    const named = plain.map((list) => `"${list.heading}" (line ${String(list.line)}, ${String(list.items.length)} items)`);
    parts.push(`${fileName} has numbered lists under headings Flow does not read as steps: ${nameFirst(named, MAX_NAMED_LISTS)}. A step heading must start with a recognized name, for example "Workflow: …".`);
  }
  if (stepLike.length > 0) {
    const named = stepLike.map((list) => `under "${list.heading}" (from line ${String(list.items[0]?.line ?? list.line)}, ${String(list.items.length)} steps)`);
    parts.push(`${fileName} numbers headings as "Step 1:" or "Phase 1:" ${nameFirst(named, MAX_NAMED_LISTS)}; Flow reads numbered headings only in the form "1. Title".`);
  }
  if (lists.some((list) => list.items.some((item) => item.condition))) {
    parts.push("These steps also contain conditional wording, so renaming alone leaves steps without edges; state the order in references/workflow.md.");
  }
  return parts.join(" ");
}

function diagnosisFor(skillName: string, fileName: string, count: number, lists: NumberedList[]): ProcedureDiagnosis {
  const noun = count === 1 ? "heading" : "headings";
  const detail = [
    `${HEADING_HEURISTIC}.`,
    lists.length > 0
      ? unreadDetail(fileName, lists)
      : `${fileName} has ${String(count)} markdown ${noun} (##/###) and no numbered list or P/N steps.`,
    "Each heading is an unordered step linked to its source line.",
    "No edge between these steps states an execution order.",
  ].join(" ");
  return {
    confidence: "partial",
    message: detail,
    fixPrompt: buildFixPrompt(skillName, detail),
    rewriteExample: HEADING_REWRITE_EXAMPLE,
  };
}

function buildGraph(input: BuiltHeadingGraph): SkillGraph {
  const { skill, sourcePath, sourceText, hits, warnings } = input;
  const steps: SkillNode[] = hits.map((hit, index) => ({
    id: `step:${String(index + 1)}`,
    label: hit.title,
    kind: "reference",
    path: sourcePath,
    source: { path: sourcePath, startLine: hit.line, endLine: hit.line },
    summary: firstLine(hit.body) || hit.title,
    excerpt: hit.body.slice(0, 4000),
    uses: [],
  }));
  const skillNode = skillDocumentNode(skill.skillFile, skill.skillText);
  const edge = (from: string, to: string): SkillEdge => ({
    from, to, relationship: "inferred", inferred: true, confidence: "low",
  });
  const graph = {
    skillId: `${skill.skillName}-procedure`,
    skillName: skill.skillName,
    rootPath: skill.skillRoot,
    warnings: [...new Set(warnings)],
  };
  if (path.resolve(sourcePath) === path.resolve(skill.skillFile)) {
    return { ...graph, nodes: [skillNode, ...steps], edges: steps.map((step) => edge("skill-md", step.id)) };
  }
  return {
    ...graph,
    nodes: [skillNode, procedureSourceNode(sourcePath, sourceText), ...steps],
    edges: [
      { from: "skill-md", to: "procedure-source", label: "source", relationship: "inferred", inferred: true },
      ...steps.map((step) => edge("procedure-source", step.id)),
    ],
  };
}
