import { EXCLUDED, HEADING } from "./detectionPatterns";
import type { DetectedStep, Detection } from "./detectionTypes";
import { addDiagramEdges, isDiagramMarker } from "./pnDiagram";
import { connectedCount, type EdgeState } from "./pnLinks";
import { addProseEdges } from "./pnProse";
import { visibleLines } from "./visibleLines";

type Parent = { level: number; excluded: boolean };

/** P/N rows from a workflow document. Order stays unresolved unless the source states it. */
export function extractPn(text: string, sourcePath: string): Detection | undefined {
  if (!pnDocument(text, sourcePath)) return undefined;
  const lines = dropExcluded(visibleLines(text, true));
  const steps = collectSteps(lines, sourcePath);
  if (steps.length === 0) return undefined;
  const linked = connectSteps(lines, steps, sourcePath);
  return { steps, links: linked.links, sourceKind: "P/N rows", relationships: linked.explicit ? "explicit" : "unresolved" };
}

function pnDocument(text: string, sourcePath: string): boolean {
  return /\b(?:workflow|operations)\.md$/i.test(sourcePath) || /^#{1,6}\s+workflow\b/im.test(text);
}

function dropExcluded(lines: string[]): string[] {
  const parents: Parent[] = [];
  return lines.map((line) => {
    const heading = line.match(HEADING);
    if (heading) pushParent(parents, heading);
    return parents.some((parent) => parent.excluded) ? "" : line;
  });
}

function pushParent(parents: Parent[], heading: RegExpMatchArray): void {
  const level = heading[1]?.length ?? 1;
  while (parents.length > 0) {
    const parent = parents.at(-1);
    if (!parent || parent.level < level) break;
    parents.pop();
  }
  const inherited = parents.some((parent) => parent.excluded);
  parents.push({ level, excluded: EXCLUDED.test(heading[2] ?? "") || inherited });
}

function collectSteps(lines: string[], sourcePath: string): DetectedStep[] {
  const steps: DetectedStep[] = [];
  let excluded = false;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? "";
    const heading = line.match(HEADING);
    if (heading) excluded = EXCLUDED.test(heading[2] ?? "");
    const row = stepRow(line, excluded);
    if (!row) continue;
    steps.push({
      display: row[1] ?? "",
      title: row[2] ?? "",
      resource: row[3],
      body: line.trim(),
      source: { path: sourcePath, startLine: index + 1, endLine: index + 1 },
    });
  }
  return steps;
}

function stepRow(line: string, excluded: boolean): RegExpMatchArray | undefined {
  if (excluded) return undefined;
  const row = line.match(/^\s*(P|N\d+[a-z]?)\s+(.+?)(?:\s{2,}(.+))?\s*$/i);
  const sequential = line.trim().match(/^(P|N\d+[a-z]?)\s+(?:then|next|(?:is\s+)?followed by|continue(?:s)?\s+(?:with|to)|go(?:es)?\s+to)\s+(P|N\d+[a-z]?)\.?$/i);
  if (!row || /->|→/.test(row[2] ?? "") || sequential) return undefined;
  return row;
}

function connectSteps(lines: string[], steps: DetectedStep[], sourcePath: string): { links: EdgeState["links"]; explicit: boolean } {
  const state: EdgeState = { steps, links: [], invalid: false, sourcePath, lines };
  addProseEdges(state);
  if (lines.some(isDiagramMarker)) addDiagramEdges(state);
  const explicit = !state.invalid && connectedCount(steps, state.links) === steps.length;
  return { links: state.links, explicit };
}
