export type IndexedStep = { display: string };
export type IndexedLink = { from: number; to: number };

/** English list of source lines: "lines 3 and 5" or "lines 3, 5, and 8". */
export function formatLines(lines: number[]): string {
  if (lines.length === 2) return `lines ${lines[0]} and ${lines[1]}`;
  return `lines ${lines.slice(0, -1).join(", ")}, and ${lines[lines.length - 1]}`;
}

/** One sentence per display id that appears on more than one P/N row. */
export function duplicateFindings(steps: Array<{ display: string; line: number }>): string[] {
  const linesFor = new Map<string, number[]>();
  for (const step of steps) {
    const rows = linesFor.get(step.display) ?? [];
    rows.push(step.line);
    linesFor.set(step.display, rows);
  }
  const duplicates = [...linesFor.entries()].filter(([, rows]) => rows.length > 1);
  duplicates.sort((a, b) => a[1][0] - b[1][0] || a[0].localeCompare(b[0]));
  return duplicates.map(([id, rows]) => `Duplicate step id ${id} on ${formatLines(rows)}.`);
}

/** True when `start` can already reach `target` through accepted links. */
export function reaches(links: IndexedLink[], start: number, target: number, seen = new Set<number>()): boolean {
  if (start === target) return true;
  if (seen.has(start)) return false;
  seen.add(start);
  return links.some(link => link.from === start && reaches(links, link.to, target, seen));
}

/** Shortest accepted path from `start` to `target`, including both ends. */
export function pathBetween(links: IndexedLink[], start: number, target: number): number[] | undefined {
  const queue: number[][] = [[start]];
  const seen = new Set<number>([start]);
  while (queue.length) {
    const path = queue.shift();
    if (!path) break;
    const node = path[path.length - 1];
    for (const link of links) {
      if (link.from !== node || seen.has(link.to)) continue;
      const next = [...path, link.to];
      if (link.to === target) return next;
      seen.add(link.to);
      queue.push(next);
    }
  }
  return undefined;
}

/** Names the cycle an omitted edge would close, then names that edge. */
export function cycleFinding(steps: IndexedStep[], links: IndexedLink[], from: number, to: number): string {
  const path = pathBetween(links, to, from);
  const chain = (indexes: number[]) => indexes.map(index => steps[index].display).join("->");
  const cycle = path ? chain([...path, to]) : chain([from, to]);
  return `Cycle ${cycle}; omitted edge ${chain([from, to])}.`;
}

function diagramWord(word: string, line: string): boolean {
  return new RegExp(`(?:─.*\\b${word}\\b|\\b${word}\\b.*─)`, "i").test(line);
}

/** A P/N fence line that draws parallel, barrier, join, or a branch marker. */
export function lineIsDiagramMarker(line: string): boolean {
  return /[┐┘↓]/.test(line) || ["parallel", "barrier", "join"].some(word => diagramWord(word, line));
}

type DiagramStep = { startLine: number; endLine: number };

/** Derive edges from parallel, barrier, join, and labeled branch markers. */
export function applyDiagramLinks(
  lines: string[],
  steps: DiagramStep[],
  addLink: (from: number, to: number, line: number, label?: string) => void,
  markInvalid: () => void,
): void {
  const parallelSteps = new Set<number>();
  const indexBefore = (line: number) => {
    for (let index = steps.length - 1; index >= 0; index--) if (steps[index].startLine <= line) return index;
    return -1;
  };
  const indexAfter = (line: number) => steps.findIndex(step => step.startLine > line);
  const addByIndex = (from: number, to: number, line: number, label?: string) => {
    if (from >= 0 && to >= 0) addLink(from, to, line, label);
  };
  for (let i = 0; i < lines.length; i++) {
    if (diagramWord("parallel", lines[i])) {
      const barrier = lines.findIndex((line, index) => index > i && diagramWord("barrier", line));
      const from = indexBefore(i + 1);
      const to = barrier >= 0 ? indexAfter(barrier + 1) : -1;
      const branches = steps.map((step, index) => ({ step, index })).filter(({ step }) =>
        step.startLine > i + 1 && (barrier < 0 || step.startLine < barrier + 1),
      );
      if (from < 0 || to < 0 || !branches.length) { markInvalid(); continue; }
      for (const { index } of branches) {
        parallelSteps.add(index);
        addByIndex(from, index, i + 1);
        addByIndex(index, to, barrier + 1);
      }
    }
    const branch = lines[i].match(/^\s*(.+?)\s+↓(?:\s*[│|])?\s*$/);
    if (branch) addByIndex(indexBefore(i + 1), indexAfter(i + 1), i + 1, branch[1].trim());
    const bypass = lines[i].match(/^\s*(.+?)\s+─+.*┐\s*$/);
    if (bypass) {
      const from = indexBefore(i + 1);
      const to = steps.findIndex(step => step.startLine > i + 1 && lines[step.startLine - 1].includes("│"));
      if (to < 0) markInvalid();
      else addByIndex(from, to, i + 1, bypass[1].trim());
    }
    if (diagramWord("join", lines[i])) addByIndex(indexBefore(i + 1), indexAfter(i + 1), i + 1);
  }
  for (let i = 0; i + 1 < steps.length; i++) {
    const between = lines.slice(steps[i].endLine, steps[i + 1].startLine - 1);
    if (!parallelSteps.has(i) && !parallelSteps.has(i + 1) && !between.some(lineIsDiagramMarker)) {
      addByIndex(i, i + 1, steps[i + 1].startLine);
    }
  }
}
