import { applyDiagramLinks, cycleFinding, duplicateFindings, lineIsDiagramMarker, reaches } from "./procedureFindings";
import type { SourceRange } from "./shared/protocol";

export type DetectedStep = { display: string; title: string; body: string; source: SourceRange; resource?: string };
export type DetectedLink = { from: number; to: number; label?: string; source: SourceRange };
export type Detection = {
  steps: DetectedStep[];
  links: DetectedLink[];
  relationships: "explicit" | "unresolved";
  sourceKind: "numbered headings" | "numbered list" | "P/N rows";
  /** Named reasons a P/N flow is partial. Empty when every drawn edge is explicit. */
  findings?: string[];
};
const SECTIONS = /^(workflow|first steps|procedure|bootstrap|how it runs|operations|instructions|usage|steps|getting started)(?:\b|$)/i;
const EXCLUDED = /\b(examples?|alternatives?|options?|appendix|notes|reference|choices)\b/i;
const CONDITIONAL = /\b(if|otherwise|unless|parallel|concurrently|alternatively|choose one|one of|go to|skip|repeat|until)\b/i;
const HEADING = /^(#{1,6})\s+(.+?)\s*#*$/;
const NUMBERED = /^(\d+[a-z]?)\.\s+(.+)$/i;

/** Keep original line offsets; recognize matching fence characters and lengths. */
function visibleLines(text: string, pn = false): string[] {
  let fence: { char: string; length: number; allow: boolean } | undefined;
  let frontmatter = text.startsWith("---\n") || text.startsWith("---\r\n");
  let excluded = false;
  return text.split(/\r?\n/).map((line, index) => {
    if (frontmatter) {
      if (index > 0 && /^(---|\.\.\.)\s*$/.test(line)) frontmatter = false;
      return "";
    }
    const delimiter = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (delimiter && delimiter[1][0] === fence.char && delimiter[1].length >= fence.length && !delimiter[2].trim()) { fence = undefined; return ""; }
      return fence.allow ? line : "";
    }
    const heading = line.match(HEADING);
    if (heading) excluded = EXCLUDED.test(heading[2]);
    if (delimiter) {
      fence = { char: delimiter[1][0], length: delimiter[1].length, allow: pn && !excluded && /^(|text|plaintext|workflow)$/.test(delimiter[2].trim()) };
      return "";
    }
    return line;
  });
}

export function detectSteps(text: string, sourcePath: string): Detection | undefined {
  const original = text.split(/\r?\n/);
  const lines = visibleLines(text);
  const groups: Array<{ steps: DetectedStep[]; kind: Detection["sourceKind"]; ambiguous?: boolean }> = [];
  const parents: Array<{ level: number; excluded: boolean }> = [];
  let active = true;
  let context = "";
  let group: typeof groups[number] | undefined;
  let headingLevel: number | undefined;
  const finishStep = (end: number) => {
    const last = group?.steps.at(-1);
    if (last) {
      last.source.endLine = Math.max(last.source.startLine, end);
      last.body = original.slice(last.source.startLine - 1, last.source.endLine).join("\n").trim();
    }
  };
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(HEADING);
    if (h) {
      const level = h[1].length;
      context = "";
      while (parents.length && parents.at(-1)!.level >= level) parents.pop();
      const instruction = level >= 2 ? h[2].match(NUMBERED) : null;
      const excluded = (!instruction && EXCLUDED.test(h[2])) || parents.some(p => p.excluded);
      parents.push({ level, excluded });
      const numbered = !excluded ? instruction : null;
      if (group?.kind === "numbered headings" && headingLevel !== undefined && level > headingLevel) continue;
      finishStep(i);
      if (numbered) {
        if (!group || group.kind !== "numbered headings" || headingLevel !== level) {
          group = { steps: [], kind: "numbered headings" }; groups.push(group);
        }
        headingLevel = level;
        group.steps.push({ display: numbered[1], title: numbered[2], body: "", source: { path: sourcePath, startLine: i + 1, endLine: i + 1 } });
      } else {
        group = undefined; headingLevel = undefined;
        active = !excluded && SECTIONS.test(h[2]);
      }
      continue;
    }
    if (!active || group?.kind === "numbered headings" || parents.some(p => p.excluded)) continue;
    const item = lines[i].match(/^(\d+[a-z]?)\.\s+(.*\S)\s*$/i);
    if (!item) {
      context += `\n${lines[i]}`;
      if (/\b(?:for example|example:)\s*$/i.test(lines[i])) {
        finishStep(i); group = undefined; active = false;
      }
      continue;
    }
    finishStep(i);
    if (!group) { group = { steps: [], kind: "numbered list", ambiguous: CONDITIONAL.test(context) }; groups.push(group); }
    group.steps.push({ display: item[1], title: item[2], body: "", source: { path: sourcePath, startLine: i + 1, endLine: i + 1 } });
  }
  finishStep(lines.length);
  const usable = groups.filter(g => g.steps.length);
  return usable.length ? detectionFromGroups(usable) : extractPn(text, sourcePath);
}

function detectionFromGroups(usable: Array<{ steps: DetectedStep[]; kind: Detection["sourceKind"]; ambiguous?: boolean }>): Detection {
  const steps = usable.flatMap(group => group.steps);
  const links: DetectedLink[] = [];
  let offset = 0;
  let uncertain = usable.length > 1;
  for (const group of usable) {
    for (let i = 0; i < group.steps.length; i++) {
      const step = group.steps[i];
      const ambiguous = !!group.ambiguous || CONDITIONAL.test(visibleLines(step.body).join("\n"));
      uncertain ||= ambiguous;
      const next = group.steps[i + 1];
      if (next && !ambiguous && !CONDITIONAL.test(visibleLines(next.body).join("\n"))) {
        links.push({ from: offset + i, to: offset + i + 1, source: step.source });
      }
    }
    offset += group.steps.length;
  }
  return { steps, links, sourceKind: usable[0].kind, relationships: uncertain ? "unresolved" : "explicit" };
}

type PnGraph = { links: DetectedLink[]; findings: string[]; invalid: boolean };

function extractPn(text: string, sourcePath: string): Detection | undefined {
  // P/N tables are supported in workflow documents, never arbitrary program fences.
  if (!/\b(?:workflow|operations)\.md$/i.test(sourcePath) && !/^#{1,6}\s+workflow\b/im.test(text)) return undefined;
  const lines = readPnLines(text);
  const steps = readPnSteps(lines, sourcePath);
  if (!steps.length) return undefined;
  const graph = emptyPnGraph(steps);
  scanPnStatements(lines, steps, sourcePath, graph);
  if (lines.some(lineIsDiagramMarker)) applyDiagramLinks(
    lines,
    steps.map(step => ({ startLine: step.source.startLine, endLine: step.source.endLine })),
    (from, to, line, label) => addPnLink(graph, steps, sourcePath, steps[from].display, steps[to].display, line, label),
    () => { graph.invalid = true; },
  );
  const covered = coveredStepCount(graph.links);
  return {
    steps, links: graph.links, sourceKind: "P/N rows", findings: [...new Set(graph.findings)],
    relationships: !graph.invalid && covered === steps.length ? "explicit" : "unresolved",
  };
}

function readPnLines(text: string): string[] {
  const parents: Array<{ level: number; excluded: boolean }> = [];
  return visibleLines(text, true).map(line => {
    const heading = line.match(HEADING);
    if (heading) {
      const level = heading[1].length;
      while (parents.length && parents.at(-1)!.level >= level) parents.pop();
      parents.push({ level, excluded: EXCLUDED.test(heading[2]) || parents.some(p => p.excluded) });
    }
    return parents.some(parent => parent.excluded) ? "" : line;
  });
}

function readPnSteps(lines: string[], sourcePath: string): DetectedStep[] {
  const steps: DetectedStep[] = [];
  let excluded = false;
  for (let i = 0; i < lines.length; i++) {
    const heading = lines[i].match(HEADING);
    if (heading) excluded = EXCLUDED.test(heading[2]);
    if (excluded) continue;
    const row = lines[i].match(/^\s*(P|N\d+[a-z]?)\s+(.+?)(?:\s{2,}(.+))?\s*$/i);
    const sequential = lines[i].trim().match(/^(P|N\d+[a-z]?)\s+(?:then|next|(?:is\s+)?followed by|continue(?:s)?\s+(?:with|to)|go(?:es)?\s+to)\s+(P|N\d+[a-z]?)\.?$/i);
    if (!row || /->|→/.test(row[2]) || sequential) continue;
    steps.push({ display: row[1], title: row[2], resource: row[3], body: lines[i].trim(), source: { path: sourcePath, startLine: i + 1, endLine: i + 1 } });
  }
  return steps;
}

function emptyPnGraph(steps: DetectedStep[]): PnGraph {
  const findings = duplicateFindings(steps.map(step => ({ display: step.display, line: step.source.startLine })));
  return { links: [], findings, invalid: findings.length > 0 };
}

function indexesFor(steps: DetectedStep[], id: string): number[] {
  return steps.flatMap((step, index) => step.display === id ? [index] : []);
}

function addPnLink(graph: PnGraph, steps: DetectedStep[], sourcePath: string, fromId: string, toId: string, line: number, label?: string): void {
  const from = indexesFor(steps, fromId);
  const to = indexesFor(steps, toId);
  if (from.length === 1 && to.length === 1 && from[0] === to[0]) {
    graph.invalid = true;
    graph.findings.push(`Self-loop ${steps[from[0]].display} on line ${line}.`);
    return;
  }
  if (from.length !== 1 || to.length !== 1) {
    graph.invalid = true;
    if (to.length === 0) graph.findings.push(`Arrow to missing id ${toId} on line ${line}.`);
    return;
  }
  if (reaches(graph.links, to[0], from[0])) {
    graph.invalid = true;
    graph.findings.push(cycleFinding(steps, graph.links, from[0], to[0]));
    return;
  }
  if (graph.links.some(edge => edge.from === from[0] && edge.to === to[0])) return;
  graph.links.push({ from: from[0], to: to[0], label, source: { path: sourcePath, startLine: line, endLine: line } });
}

function scanPnStatements(lines: string[], steps: DetectedStep[], sourcePath: string, graph: PnGraph): void {
  const id = "(P|N\\d+[a-z]?)";
  const listIds = (value: string): string[] | undefined => {
    const ids = [...value.matchAll(new RegExp(id, "gi"))].map(match => match[1]);
    const rest = value.replace(new RegExp(id, "gi"), "").replace(/\b(?:and|,|\s)+\b/gi, "").trim();
    return ids.length && rest === "" ? ids : undefined;
  };
  const add = (fromId: string, toId: string, line: number, label?: string) => addPnLink(graph, steps, sourcePath, fromId, toId, line, label);
  for (let i = 0; i < lines.length; i++) {
    const edge = lines[i].trim().match(/^(P|N\d+[a-z]?)\s*(?:->|→)\s*(P|N\d+[a-z]?)(?:\s+\(([^)]+)\))?\s*$/i);
    if (edge) { add(edge[1], edge[2], i + 1, edge[3]); continue; }
    if (/^\s*(P|N\d+[a-z]?)\s*(?:->|→)/i.test(lines[i])) { graph.invalid = true; continue; }
    const prose = lines[i].trim();
    const sequential = prose.match(new RegExp(`^${id}\\s+(?:then|next|(?:is\\s+)?followed by|continue(?:s)?\\s+(?:with|to)|go(?:es)?\\s+to)\\s+${id}\\.?$`, "i"));
    if (sequential) { add(sequential[1], sequential[2], i + 1); continue; }
    const parallel = prose.match(new RegExp(`^From\\s+${id},\\s*(?:run|start|perform)\\s+(.+?)\\s+in\\s+parallel\\.?$`, "i"));
    if (parallel) {
      const targets = listIds(parallel[2]);
      if (targets) for (const target of targets) add(parallel[1], target, i + 1);
      else graph.invalid = true;
      continue;
    }
    const join = prose.match(new RegExp(`^After\\s+(.+?),\\s*(?:continue|go)\\s+(?:with|to)\\s+${id}\\.?$`, "i"));
    if (join) {
      const sources = listIds(join[1]);
      if (sources) for (const source of sources) add(source, join[2], i + 1);
      else graph.invalid = true;
      continue;
    }
    const conditional = prose.match(new RegExp(`^From\\s+${id},\\s*if\\s+(.+?),\\s*continue\\s+(?:with|to)\\s+${id};\\s*otherwise,\\s*(?:continue\\s+(?:with|to)\\s+)?${id}\\.?$`, "i"));
    if (conditional) {
      add(conditional[1], conditional[3], i + 1, `if ${conditional[2]}`);
      add(conditional[1], conditional[4], i + 1, "otherwise");
    }
  }
}

function coveredStepCount(links: DetectedLink[]): number {
  const covered = new Set<number>();
  const visit = (index: number) => {
    if (covered.has(index)) return;
    covered.add(index);
    for (const edge of links) {
      if (edge.from === index) visit(edge.to);
      if (edge.to === index) visit(edge.from);
    }
  };
  if (links.length) visit(links[0].from);
  return covered.size;
}
