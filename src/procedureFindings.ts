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
  duplicates.sort((left, right) => left[1][0] - right[1][0] || left[0].localeCompare(right[0]));
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
  while (queue.length > 0) {
    const path = queue.shift();
    if (!path) break;
    const extended = extendPath({ links, path, node: path[path.length - 1], target, seen });
    if (extended.found) return extended.found;
    extended.more.forEach(next => queue.push(next));
  }
  return undefined;
}

function extendPath(step: {
  links: IndexedLink[];
  path: number[];
  node: number | undefined;
  target: number;
  seen: Set<number>;
}): { found?: number[]; more: number[][] } {
  const more: number[][] = [];
  if (step.node === undefined) return { more };
  for (const link of step.links) {
    if (link.from !== step.node || step.seen.has(link.to)) continue;
    const next = [...step.path, link.to];
    if (link.to === step.target) return { found: next, more };
    step.seen.add(link.to);
    more.push(next);
  }
  return { more };
}

/** Names the cycle an omitted edge would close, then names that edge. */
export function cycleFinding(steps: IndexedStep[], links: IndexedLink[], from: number, to: number): string {
  const path = pathBetween(links, to, from);
  const chain = (indexes: number[]) => indexes.map(index => steps[index]?.display ?? "").join("->");
  const cycle = path ? chain([...path, to]) : chain([from, to]);
  return `Cycle ${cycle}; omitted edge ${chain([from, to])}.`;
}
