import type { DetectedLink, DetectedStep } from "./detectionTypes";

export type EdgeState = {
  steps: DetectedStep[];
  links: DetectedLink[];
  invalid: boolean;
  sourcePath: string;
  lines: string[];
};

export type EdgeEnds = { fromId: string; toId: string; line: number; label?: string };

export function addLink(state: EdgeState, ends: EdgeEnds): void {
  const fromIndex = soleIndex(state.steps, ends.fromId);
  const toIndex = soleIndex(state.steps, ends.toId);
  if (fromIndex === undefined || toIndex === undefined || fromIndex === toIndex) {
    state.invalid = true;
    return;
  }
  if (reachable(state.links, toIndex, fromIndex)) {
    state.invalid = true;
    return;
  }
  if (alreadyLinked(state.links, fromIndex, toIndex)) return;
  state.links.push({
    from: fromIndex,
    to: toIndex,
    label: ends.label,
    source: { path: state.sourcePath, startLine: ends.line, endLine: ends.line },
  });
}

function soleIndex(steps: DetectedStep[], id: string): number | undefined {
  const matches = indexesFor(steps, id);
  return matches.length === 1 ? matches[0] : undefined;
}

function alreadyLinked(links: DetectedLink[], from: number, to: number): boolean {
  return links.some((edge) => edge.from === from && edge.to === to);
}

export function connectedCount(steps: DetectedStep[], links: DetectedLink[]): number {
  const covered = new Set<number>();
  const visit = (index: number): void => {
    if (covered.has(index)) return;
    covered.add(index);
    for (const edge of links) followEdge(edge, index, visit);
  };
  if (links.length > 0) visit(links[0]?.from ?? 0);
  return covered.size;
}

function followEdge(edge: DetectedLink, index: number, visit: (index: number) => void): void {
  if (edge.from === index) visit(edge.to);
  if (edge.to === index) visit(edge.from);
}

function indexesFor(steps: DetectedStep[], id: string): number[] {
  return steps.map((step, index) => step.display === id ? index : -1).filter((index) => index >= 0);
}

function reachable(links: DetectedLink[], start: number, target: number, seen = new Set<number>()): boolean {
  if (start === target) return true;
  if (seen.has(start)) return false;
  seen.add(start);
  return links.some((link) => link.from === start && reachable(links, link.to, target, seen));
}
