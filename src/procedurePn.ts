import { applyDiagramLinks, lineIsDiagramMarker } from "./procedureDiagram";
import type { DetectedLink, DetectedStep, Detection } from "./procedureDetection";
import { cycleFinding, duplicateFindings, reaches } from "./procedureFindings";
import { EXCLUDED, HEADING, popParentsAtOrAbove, visibleLines } from "./procedureLines";

type PnGraph = { links: DetectedLink[]; findings: string[]; invalid: boolean };

type PnLink = {
  graph: PnGraph;
  steps: DetectedStep[];
  sourcePath: string;
  fromId: string;
  toId: string;
  line: number;
  label?: string;
};

/** P/N rows in a workflow document. Program fences never count. */
export function extractPn(text: string, sourcePath: string): Detection | undefined {
  if (!/\b(?:workflow|operations)\.md$/i.test(sourcePath) && !/^#{1,6}\s+workflow\b/im.test(text)) return undefined;
  const lines = readPnLines(text);
  const steps = readPnSteps(lines, sourcePath);
  if (!steps.length) return undefined;
  const graph = emptyPnGraph(steps);
  scanPnStatements(lines, steps, sourcePath, graph);
  if (lines.some(lineIsDiagramMarker)) applyDiagram(lines, steps, sourcePath, graph);
  const covered = coveredStepCount(graph.links);
  return {
    steps,
    links: graph.links,
    sourceKind: "P/N rows",
    findings: [...new Set(graph.findings)],
    relationships: !graph.invalid && covered === steps.length ? "explicit" : "unresolved",
  };
}

function readPnLines(text: string): string[] {
  const parents: Array<{ level: number; excluded: boolean }> = [];
  return visibleLines(text, true).map(line => {
    const heading = line.match(HEADING);
    if (!heading) return parents.some(parent => parent.excluded) ? "" : line;
    const level = heading[1].length;
    popParentsAtOrAbove(parents, level);
    parents.push({ level, excluded: EXCLUDED.test(heading[2]) || parents.some(parent => parent.excluded) });
    return parents.some(parent => parent.excluded) ? "" : line;
  });
}

function readPnSteps(lines: string[], sourcePath: string): DetectedStep[] {
  const steps: DetectedStep[] = [];
  let excluded = false;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const heading = line.match(HEADING);
    if (heading) excluded = EXCLUDED.test(heading[2]);
    if (excluded) continue;
    const row = line.match(/^\s*(P|N\d+[a-z]?)\s+(.+?)(?:\s{2,}(.+))?\s*$/i);
    const sequential = line.trim().match(/^(P|N\d+[a-z]?)\s+(?:then|next|(?:is\s+)?followed by|continue(?:s)?\s+(?:with|to)|go(?:es)?\s+to)\s+(P|N\d+[a-z]?)\.?$/i);
    if (!row?.[1] || !row[2] || /->|→/.test(row[2]) || sequential) continue;
    steps.push({
      display: row[1],
      title: row[2],
      resource: row[3],
      body: line.trim(),
      source: { path: sourcePath, startLine: index + 1, endLine: index + 1 },
    });
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

function onlyIndex(indexes: number[]): number | undefined {
  return indexes.length === 1 ? indexes[0] : undefined;
}

function addPnLink(link: PnLink): void {
  const fromIndex = onlyIndex(indexesFor(link.steps, link.fromId));
  const toIndex = onlyIndex(indexesFor(link.steps, link.toId));
  if (fromIndex === undefined || toIndex === undefined) {
    noteUnlinked(link);
    return;
  }
  if (fromIndex === toIndex) {
    noteSelfLoop(link, fromIndex);
    return;
  }
  keepAcyclicEdge(link, fromIndex, toIndex);
}

function noteUnlinked(link: PnLink): void {
  link.graph.invalid = true;
  if (indexesFor(link.steps, link.toId).length > 0) return;
  link.graph.findings.push(`Arrow to missing id ${link.toId} on line ${link.line}.`);
}

function noteSelfLoop(link: PnLink, index: number): void {
  const step = link.steps[index];
  if (!step) return;
  link.graph.invalid = true;
  link.graph.findings.push(`Self-loop ${step.display} on line ${link.line}.`);
}

function keepAcyclicEdge(link: PnLink, fromIndex: number, toIndex: number): void {
  if (reaches(link.graph.links, toIndex, fromIndex)) {
    link.graph.invalid = true;
    link.graph.findings.push(cycleFinding(link.steps, link.graph.links, fromIndex, toIndex));
    return;
  }
  if (link.graph.links.some(edge => edge.from === fromIndex && edge.to === toIndex)) return;
  link.graph.links.push({
    from: fromIndex,
    to: toIndex,
    label: link.label,
    source: { path: link.sourcePath, startLine: link.line, endLine: link.line },
  });
}

type PnAdd = (fromId: string, toId: string, line: number, label?: string) => void;
type PnMatch = "absent" | "linked" | "invalid";

function scanPnStatements(lines: string[], steps: DetectedStep[], sourcePath: string, graph: PnGraph): void {
  const id = "(P|N\\d+[a-z]?)";
  const add: PnAdd = (fromId, toId, line, label) => addPnLink({ graph, steps, sourcePath, fromId, toId, line, label });
  for (let index = 0; index < lines.length; index += 1) {
    if (readPnLine(lines[index] ?? "", index + 1, id, add) === "invalid") graph.invalid = true;
  }
}

function readPnLine(line: string, lineNumber: number, id: string, add: PnAdd): PnMatch {
  const trimmed = line.trim();
  const edge = trimmed.match(/^(P|N\d+[a-z]?)\s*(?:->|→)\s*(P|N\d+[a-z]?)(?:\s+\(([^)]+)\))?\s*$/i);
  if (edge?.[1] && edge[2]) {
    add(edge[1], edge[2], lineNumber, edge[3]);
    return "linked";
  }
  if (/^\s*(P|N\d+[a-z]?)\s*(?:->|→)/i.test(line)) return "invalid";
  return readPnProse(trimmed, lineNumber, id, add);
}

function readPnProse(prose: string, lineNumber: number, id: string, add: PnAdd): PnMatch {
  const sequential = readSequential(prose, lineNumber, id, add);
  if (sequential !== "absent") return sequential;
  const parallel = readParallel(prose, lineNumber, id, add);
  if (parallel !== "absent") return parallel;
  const join = readJoin(prose, lineNumber, id, add);
  if (join !== "absent") return join;
  return readConditional(prose, lineNumber, id, add);
}

function readSequential(prose: string, lineNumber: number, id: string, add: PnAdd): PnMatch {
  const sequential = prose.match(new RegExp(`^${id}\\s+(?:then|next|(?:is\\s+)?followed by|continue(?:s)?\\s+(?:with|to)|go(?:es)?\\s+to)\\s+${id}\\.?$`, "i"));
  if (!sequential?.[1] || !sequential[2]) return "absent";
  add(sequential[1], sequential[2], lineNumber);
  return "linked";
}

function idList(value: string, id: string): string[] | undefined {
  const ids = [...value.matchAll(new RegExp(id, "gi"))].flatMap(match => match[1] === undefined ? [] : [match[1]]);
  const rest = value.replace(new RegExp(id, "gi"), "").replace(/\b(?:and|,|\s)+\b/gi, "").trim();
  return ids.length > 0 && rest === "" ? ids : undefined;
}

function readParallel(prose: string, lineNumber: number, id: string, add: PnAdd): PnMatch {
  const parallel = prose.match(new RegExp(`^From\\s+${id},\\s*(?:run|start|perform)\\s+(.+?)\\s+in\\s+parallel\\.?$`, "i"));
  if (!parallel) return "absent";
  const source = parallel[1];
  const targets = source === undefined ? undefined : idList(parallel[2] ?? "", id);
  if (source === undefined || !targets) return "invalid";
  for (const target of targets) add(source, target, lineNumber);
  return "linked";
}

function readJoin(prose: string, lineNumber: number, id: string, add: PnAdd): PnMatch {
  const join = prose.match(new RegExp(`^After\\s+(.+?),\\s*(?:continue|go)\\s+(?:with|to)\\s+${id}\\.?$`, "i"));
  if (!join) return "absent";
  const target = join[2];
  const sources = target === undefined ? undefined : idList(join[1] ?? "", id);
  if (target === undefined || !sources) return "invalid";
  for (const source of sources) add(source, target, lineNumber);
  return "linked";
}

function readConditional(prose: string, lineNumber: number, id: string, add: PnAdd): PnMatch {
  const pattern = `^From\\s+${id},\\s*if\\s+(.+?),\\s*continue\\s+(?:with|to)\\s+${id};\\s*otherwise,\\s*(?:continue\\s+(?:with|to)\\s+)?${id}\\.?$`;
  const conditional = prose.match(new RegExp(pattern, "i"));
  if (!conditional?.[1] || !conditional[3] || !conditional[4]) return "absent";
  add(conditional[1], conditional[3], lineNumber, `if ${conditional[2] ?? ""}`);
  add(conditional[1], conditional[4], lineNumber, "otherwise");
  return "linked";
}

function applyDiagram(lines: string[], steps: DetectedStep[], sourcePath: string, graph: PnGraph): void {
  applyDiagramLinks(
    lines,
    steps.map(step => ({ startLine: step.source.startLine, endLine: step.source.endLine })),
    (from, to, line, label) => {
      const origin = steps[from];
      const target = steps[to];
      if (!origin || !target) return;
      addPnLink({ graph, steps, sourcePath, fromId: origin.display, toId: target.display, line, label });
    },
    () => { graph.invalid = true; },
  );
}

function coveredStepCount(links: DetectedLink[]): number {
  const covered = new Set<number>();
  const visit = (index: number): void => {
    if (covered.has(index)) return;
    covered.add(index);
    for (const edge of links) {
      if (edge.from === index) visit(edge.to);
      if (edge.to === index) visit(edge.from);
    }
  };
  const entry = links[0];
  if (entry) visit(entry.from);
  return covered.size;
}
