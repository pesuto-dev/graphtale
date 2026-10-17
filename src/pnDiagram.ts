import type { DetectedStep } from "./detectionTypes";
import { addLink, type EdgeState } from "./pnLinks";

type IndexEnds = { from: number; to: number; line: number; label?: string };

export function isDiagramMarker(line: string): boolean {
  return /[┐┘↓]/.test(line) || ["parallel", "barrier", "join"].some((word) => diagramWord(word, line));
}

export function addDiagramEdges(state: EdgeState): void {
  const parallelSteps = new Set<number>();
  for (let index = 0; index < state.lines.length; index++) {
    addParallel(state, index, parallelSteps);
    addBranch(state, index);
    addBypass(state, index);
    addJoin(state, index);
  }
  addDiagramSequence(state, parallelSteps);
}

function addParallel(state: EdgeState, index: number, parallelSteps: Set<number>): void {
  if (!diagramWord("parallel", state.lines[index] ?? "")) return;
  const barrier = state.lines.findIndex((line, lineIndex) => lineIndex > index && diagramWord("barrier", line));
  const from = indexBefore(state.steps, index + 1);
  const to = barrier >= 0 ? indexAfter(state.steps, barrier + 1) : -1;
  const branches = parallelBranches(state, index, barrier);
  if (from < 0 || to < 0 || branches.length === 0) {
    state.invalid = true;
    return;
  }
  for (const stepIndex of branches) linkBranch(state, parallelSteps, { from, to, stepIndex, index, barrier });
}

function linkBranch(
  state: EdgeState,
  parallelSteps: Set<number>,
  branch: { from: number; to: number; stepIndex: number; index: number; barrier: number },
): void {
  parallelSteps.add(branch.stepIndex);
  addByIndex(state, { from: branch.from, to: branch.stepIndex, line: branch.index + 1 });
  addByIndex(state, { from: branch.stepIndex, to: branch.to, line: branch.barrier + 1 });
}

function parallelBranches(state: EdgeState, index: number, barrier: number): number[] {
  return state.steps.flatMap((step, stepIndex) => {
    const afterStart = step.source.startLine > index + 1;
    const beforeBarrier = barrier < 0 || step.source.startLine < barrier + 1;
    return afterStart && beforeBarrier ? [stepIndex] : [];
  });
}

function addBranch(state: EdgeState, index: number): void {
  const branch = (state.lines[index] ?? "").match(/^\s*(.+?)\s+↓(?:\s*[│|])?\s*$/);
  if (!branch) return;
  addByIndex(state, {
    from: indexBefore(state.steps, index + 1),
    to: indexAfter(state.steps, index + 1),
    line: index + 1,
    label: (branch[1] ?? "").trim(),
  });
}

function addBypass(state: EdgeState, index: number): void {
  const bypass = (state.lines[index] ?? "").match(/^\s*(.+?)\s+─+.*┐\s*$/);
  if (!bypass) return;
  const from = indexBefore(state.steps, index + 1);
  const to = state.steps.findIndex((step) => step.source.startLine > index + 1 && (state.lines[step.source.startLine - 1] ?? "").includes("│"));
  if (to < 0) {
    state.invalid = true;
    return;
  }
  addByIndex(state, { from, to, line: index + 1, label: (bypass[1] ?? "").trim() });
}

function addJoin(state: EdgeState, index: number): void {
  if (!diagramWord("join", state.lines[index] ?? "")) return;
  addByIndex(state, {
    from: indexBefore(state.steps, index + 1),
    to: indexAfter(state.steps, index + 1),
    line: index + 1,
  });
}

function addDiagramSequence(state: EdgeState, parallelSteps: Set<number>): void {
  for (let index = 0; index + 1 < state.steps.length; index++) {
    const current = state.steps[index];
    const next = state.steps[index + 1];
    if (!current || !next || sequenceBlocked({ state, parallelSteps, index, current, next })) continue;
    addByIndex(state, { from: index, to: index + 1, line: next.source.startLine });
  }
}

function sequenceBlocked(input: {
  state: EdgeState;
  parallelSteps: Set<number>;
  index: number;
  current: DetectedStep;
  next: DetectedStep;
}): boolean {
  const between = input.state.lines.slice(input.current.source.endLine, input.next.source.startLine - 1);
  return input.parallelSteps.has(input.index) || input.parallelSteps.has(input.index + 1) || between.some(isDiagramMarker);
}

function addByIndex(state: EdgeState, ends: IndexEnds): void {
  if (ends.from < 0 || ends.to < 0) return;
  const fromStep = state.steps[ends.from];
  const toStep = state.steps[ends.to];
  if (!fromStep || !toStep) return;
  addLink(state, { fromId: fromStep.display, toId: toStep.display, line: ends.line, label: ends.label });
}

function indexBefore(steps: DetectedStep[], line: number): number {
  for (let index = steps.length - 1; index >= 0; index--) {
    const step = steps[index];
    if (step && step.source.startLine <= line) return index;
  }
  return -1;
}

function indexAfter(steps: DetectedStep[], line: number): number {
  return steps.findIndex((step) => step.source.startLine > line);
}

function diagramWord(word: string, line: string): boolean {
  return new RegExp(`(?:─.*\\b${word}\\b|\\b${word}\\b.*─)`, "i").test(line);
}
