export interface DiagramStep { startLine: number; endLine: number }

type DiagramLink = (from: number, to: number, line: number, label?: string) => void;

interface DiagramPass {
  lines: string[];
  steps: DiagramStep[];
  addByIndex: DiagramLink;
  markInvalid: () => void;
}

function diagramWord(word: string, line: string): boolean {
  return new RegExp(`(?:─.*\\b${word}\\b|\\b${word}\\b.*─)`, "i").test(line);
}

/** A P/N fence line that draws parallel, barrier, join, or a branch marker. */
export function lineIsDiagramMarker(line: string): boolean {
  return /[┐┘↓]/.test(line) || ["parallel", "barrier", "join"].some(word => diagramWord(word, line));
}

function stepIndexBefore(steps: DiagramStep[], line: number): number {
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    const step = steps.at(index);
    if (step && step.startLine <= line) return index;
  }
  return -1;
}

function stepIndexAfter(steps: DiagramStep[], line: number): number {
  return steps.findIndex(step => step.startLine > line);
}

function linkParallelBand(pass: DiagramPass, index: number): number[] | undefined {
  const line = pass.lines.at(index);
  if (line === undefined || !diagramWord("parallel", line)) return undefined;
  const barrier = pass.lines.findIndex((row, at) => at > index && diagramWord("barrier", row));
  const from = stepIndexBefore(pass.steps, index + 1);
  const to = barrier >= 0 ? stepIndexAfter(pass.steps, barrier + 1) : -1;
  const branches = pass.steps.flatMap((step, stepIndex) => (
    step.startLine > index + 1 && (barrier < 0 || step.startLine < barrier + 1) ? [stepIndex] : []
  ));
  if (from < 0 || to < 0 || branches.length === 0) {
    pass.markInvalid();
    return [];
  }
  for (const stepIndex of branches) {
    pass.addByIndex(from, stepIndex, index + 1);
    pass.addByIndex(stepIndex, to, barrier + 1);
  }
  return branches;
}

function linkBypass(pass: DiagramPass, index: number, label: string): void {
  const from = stepIndexBefore(pass.steps, index + 1);
  const to = pass.steps.findIndex(step => {
    const marker = pass.lines.at(step.startLine - 1);
    return step.startLine > index + 1 && (marker?.includes("│") ?? false);
  });
  if (to < 0) pass.markInvalid();
  else pass.addByIndex(from, to, index + 1, label);
}

function linkBranchMarker(pass: DiagramPass, index: number): void {
  const line = pass.lines[index] ?? "";
  const branch = /^\s*(.+?)\s+↓(?:\s*[│|])?\s*$/.exec(line);
  if (branch?.[1]) {
    const label = branch[1].trim();
    pass.addByIndex(stepIndexBefore(pass.steps, index + 1), stepIndexAfter(pass.steps, index + 1), index + 1, label);
  }
  const bypass = /^\s*(.+?)\s+─+.*┐\s*$/.exec(line);
  if (bypass?.[1]) linkBypass(pass, index, bypass[1].trim());
  if (!diagramWord("join", line)) return;
  pass.addByIndex(stepIndexBefore(pass.steps, index + 1), stepIndexAfter(pass.steps, index + 1), index + 1);
}

function linkUnmarkedRows(pass: DiagramPass, parallelSteps: ReadonlySet<number>): void {
  for (let index = 0; index + 1 < pass.steps.length; index += 1) {
    const current = pass.steps.at(index);
    const next = pass.steps.at(index + 1);
    if (!current || !next) continue;
    const between = pass.lines.slice(current.endLine, next.startLine - 1);
    const blocked = parallelSteps.has(index) || parallelSteps.has(index + 1) || between.some(lineIsDiagramMarker);
    if (!blocked) pass.addByIndex(index, index + 1, next.startLine);
  }
}

/** Derive edges from parallel, barrier, join, and labeled branch markers. */
export function applyDiagramLinks(lines: string[], steps: DiagramStep[], addLink: DiagramLink, markInvalid: () => void): void {
  const parallelSteps = new Set<number>();
  const pass: DiagramPass = {
    lines,
    steps,
    markInvalid,
    addByIndex: (from, to, line, label) => {
      if (from >= 0 && to >= 0) addLink(from, to, line, label);
    },
  };
  for (let index = 0; index < lines.length; index += 1) {
    const band = linkParallelBand(pass, index);
    if (!band) {
      linkBranchMarker(pass, index);
      continue;
    }
    for (const step of band) parallelSteps.add(step);
  }
  linkUnmarkedRows(pass, parallelSteps);
}
