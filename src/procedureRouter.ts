import * as fs from "node:fs";
import * as path from "node:path";
import { FLOW_MAX_STEPS } from "./fileAccess";
import { skillDocumentNode } from "./flowNodes";
import { matchHeading, popParentsAtOrAbove, visibleLines } from "./procedureLines";
import { ENGLISH, type Vocabulary } from "./procedureVocabulary";
import type { ProcedureDiagnosis, ProcedureResult, SkillEdge, SkillNode } from "./shared/protocol";
import { buildFixPrompt } from "./shared/protocol";
import { MARKDOWN_LINK, linkHrefs } from "./text";

/** Diagnosis phrase for a SKILL.md that dispatches to separate files without a stated order. */
export const ROUTER_HEURISTIC = "router: routes to files, no order";

const TABLE_ROW = /^\s*\|(.+)\|\s*$/;
const TABLE_RULE = /^\s*\|[\s:|-]+\|\s*$/;
const BULLET = /^\s*[-*+]\s+(.+)$/;
const PATH_TOKEN = /[\w.\\/-]+/g;
const PATH_SHAPE = /^(?:\.[\\/])?[\w.-]+(?:[\\/][\w.-]+)*$/;

export interface RouteHit {
  name: string;
  summary: string;
  file: string;
  line: number;
}

interface RouterArgs {
  skillName: string;
  skillRoot: string;
  skillFile: string;
  skillText: string;
  warnings: string[];
  vocabulary?: Vocabulary;
}

interface ScanState {
  root: string;
  parents: { level: number; excluded: boolean }[];
  block: RouteHit[];
  best: RouteHit[];
  vocabulary: Vocabulary;
}

/** First table or bullet list in SKILL.md where at least two items point to distinct local .md files. */
export function detectRoutes(text: string, skillRoot: string, vocabulary: Vocabulary = ENGLISH): RouteHit[] {
  const lines = visibleLines(text, false, vocabulary);
  const state: ScanState = { root: path.resolve(skillRoot), parents: [], block: [], best: [], vocabulary };
  for (let i = 0; i < lines.length && state.best.length === 0; i++) scanLine(state, lines[i], i + 1);
  closeBlock(state);
  return state.best;
}

function scanLine(state: ScanState, line: string, lineNo: number): void {
  const heading = matchHeading(line);
  if (heading) {
    closeBlock(state);
    const level = heading.level;
    popParentsAtOrAbove(state.parents, level);
    state.parents.push({ level, excluded: state.vocabulary.isSkipSection(heading.title) });
    return;
  }
  if (TABLE_RULE.test(line)) return;
  const hit = state.parents.some(parent => parent.excluded) ? undefined : routeFromLine(line, lineNo, state.root);
  if (hit) state.block.push(hit);
  else if (line.trim() !== "" || state.block.length === 0) closeBlock(state);
}

function closeBlock(state: ScanState): void {
  const distinct = new Set(state.block.map(hit => hit.file));
  if (state.best.length === 0 && distinct.size >= 2) state.best = state.block;
  state.block = [];
}

function routeFromLine(line: string, lineNo: number, root: string): RouteHit | undefined {
  const row = TABLE_ROW.exec(line);
  if (row) return routeFromCells(row[1].split("|").map(cell => cell.trim()), lineNo, root);
  const bullet = BULLET.exec(line);
  if (!bullet) return undefined;
  const file = localMarkdown(bullet[1], root);
  if (!file) return undefined;
  const [name, ...rest] = bullet[1].replace(/\s+/g, " ").split(/ [—–:-] |: /);
  return { name: plain(name), summary: plain(rest.join(" ")) || plain(name), file, line: lineNo };
}

function routeFromCells(cells: string[], lineNo: number, root: string): RouteHit | undefined {
  const index = cells.findIndex(cell => localMarkdown(cell, root));
  const file = index >= 0 ? localMarkdown(cells[index], root) : undefined;
  if (!file) return undefined;
  const name = index === 0 ? path.basename(file, ".md") : plain(cells[0]);
  const summary = cells.slice(1, index).map(plain).filter(Boolean).join(" ");
  return { name, summary: summary || name, file, line: lineNo };
}

/** A .md path inside the skill folder that exists on disk, other than SKILL.md itself. */
function localMarkdown(textValue: string, root: string): string | undefined {
  const href = linkedMarkdown(textValue) ?? barePath(textValue);
  if (!href || /^[a-z]+:/i.test(href)) return undefined;
  const resolved = path.resolve(root, href.replace(/\\/g, "/"));
  if (!resolved.startsWith(root + path.sep) || path.basename(resolved).toLowerCase() === "skill.md") return undefined;
  return fs.existsSync(resolved) && fs.statSync(resolved).isFile() ? resolved : undefined;
}

/** First link to a `.md` file, fragment dropped. Linear, unlike the regex it replaces. */
function linkedMarkdown(textValue: string): string | undefined {
  return linkHrefs(textValue).map((href) => href.split("#")[0]).find((href) => href.endsWith(".md") && !/\s/.test(href));
}

/** First bare `dir/file.md` path in the text; like the old regex, a trailing `.` or `.bak` is cut off. */
function barePath(textValue: string): string | undefined {
  for (const [token] of textValue.matchAll(PATH_TOKEN)) {
    const stripped = token.replace(/^[\\/]+/, "");
    const end = stripped.lastIndexOf(".md");
    const candidate = end > 0 ? stripped.slice(0, end + 3) : "";
    if (PATH_SHAPE.test(candidate)) return candidate;
  }
  return undefined;
}

function plain(value: string): string {
  return value.replace(MARKDOWN_LINK, "$1").replace(/[`*]/g, "").trim();
}

/** SKILL.md as a router: each route is an unordered branch to the file that holds its instructions. */
export function procedureFromRouter(args: RouterArgs): ProcedureResult | undefined {
  const routes = detectRoutes(args.skillText, args.skillRoot, args.vocabulary);
  if (routes.length === 0) return undefined;
  const warnings = [...args.warnings];
  const kept = routes.slice(0, FLOW_MAX_STEPS);
  if (kept.length < routes.length) warnings.push(`Flow shows ${String(FLOW_MAX_STEPS)} of ${String(routes.length)} steps.`);
  const steps: SkillNode[] = kept.map((route, index) => ({
    id: `step:${String(index + 1)}`,
    label: route.name,
    kind: "reference",
    path: args.skillFile,
    source: { path: args.skillFile, startLine: route.line, endLine: route.line },
    resourcePath: route.file,
    summary: route.summary,
    uses: [{ label: path.relative(args.skillRoot, route.file).split(path.sep).join("/") }],
  }));
  const edges: SkillEdge[] = steps.map(step => ({
    from: "skill-md", to: step.id, relationship: "inferred", inferred: true, confidence: "low",
  }));
  return {
    graph: {
      skillId: `${args.skillName}-procedure`,
      skillName: args.skillName,
      rootPath: args.skillRoot,
      nodes: [skillDocumentNode(args.skillFile, args.skillText), ...steps],
      edges,
      warnings: [...new Set(warnings)],
    },
    diagnosis: routerDiagnosis(args.skillName, kept.length, kept[0].line),
  };
}

function routerDiagnosis(skillName: string, count: number, line: number): ProcedureDiagnosis {
  const detail = [
    `${ROUTER_HEURISTIC}.`,
    `SKILL.md routes to ${String(count)} separate files (from line ${String(line)}) and has no numbered top-level steps.`,
    "Each route is a branch; Flow does not parse the order inside the routed files.",
  ].join(" ");
  return { confidence: "partial", message: detail, fixPrompt: buildFixPrompt(skillName, detail) };
}
