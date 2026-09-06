import type { SourceRange } from "./shared/protocol";

export type DetectedStep = { display: string; title: string; body: string; source: SourceRange; resource?: string };
export type DetectedLink = { from: number; to: number; label?: string; source: SourceRange };
export type Detection = {
  steps: DetectedStep[];
  links: DetectedLink[];
  relationships: "explicit" | "unresolved";
  sourceKind: "numbered headings" | "numbered list" | "P/N rows";
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
  let parents: Array<{ level: number; excluded: boolean }> = [];
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
  if (usable.length) {
    const steps = usable.flatMap(g => g.steps);
    const links: DetectedLink[] = [];
    let offset = 0;
    let uncertain = usable.length > 1;
    for (const g of usable) {
      for (let i = 0; i < g.steps.length; i++) {
        const step = g.steps[i];
        const ambiguous = !!g.ambiguous || CONDITIONAL.test(visibleLines(step.body).join("\n"));
        uncertain ||= ambiguous;
        if (i + 1 < g.steps.length && !ambiguous && !CONDITIONAL.test(visibleLines(g.steps[i + 1].body).join("\n"))) {
          links.push({ from: offset + i, to: offset + i + 1, source: step.source });
        }
      }
      offset += g.steps.length;
    }
    return { steps, links, sourceKind: usable[0].kind, relationships: uncertain ? "unresolved" : "explicit" };
  }
  return extractPn(text, sourcePath);
}

function extractPn(text: string, sourcePath: string): Detection | undefined {
  // P/N tables are supported in workflow documents, never arbitrary program fences.
  if (!/\b(?:workflow|operations)\.md$/i.test(sourcePath) && !/^#{1,6}\s+workflow\b/im.test(text)) return undefined;
  const parents: Array<{ level: number; excluded: boolean }> = [];
  const lines = visibleLines(text, true).map(line => {
    const heading = line.match(HEADING);
    if (heading) {
      const level = heading[1].length;
      while (parents.length && parents.at(-1)!.level >= level) parents.pop();
      parents.push({ level, excluded: EXCLUDED.test(heading[2]) || parents.some(p => p.excluded) });
    }
    return parents.some(p => p.excluded) ? "" : line;
  });
  const steps: DetectedStep[] = [];
  let excluded = false;
  for (let i = 0; i < lines.length; i++) {
    const heading = lines[i].match(HEADING);
    if (heading) excluded = EXCLUDED.test(heading[2]);
    if (excluded) continue;
    const row = lines[i].match(/^\s*(P|N\d+[a-z]?)\s+(.+?)(?:\s{2,}(.+))?\s*$/i);
    if (!row || /->|→/.test(row[2])) continue;
    steps.push({ display: row[1], title: row[2], resource: row[3], body: lines[i].trim(), source: { path: sourcePath, startLine: i + 1, endLine: i + 1 } });
  }
  if (!steps.length) return undefined;
  const links: DetectedLink[] = [];
  let invalid = false;
  const indexFor = (id: string) => steps.map((s, i) => s.display === id ? i : -1).filter(i => i >= 0);
  for (let i = 0; i < lines.length; i++) {
    const edge = lines[i].trim().match(/^(P|N\d+[a-z]?)\s*(?:->|→)\s*(P|N\d+[a-z]?)(?:\s+\(([^)]+)\))?\s*$/i);
    if (!edge) {
      if (/^\s*(P|N\d+[a-z]?)\s*(?:->|→)/i.test(lines[i])) invalid = true;
      continue;
    }
    const from = indexFor(edge[1]), to = indexFor(edge[2]);
    if (from.length !== 1 || to.length !== 1 || from[0] === to[0]) { invalid = true; continue; }
    const reachable = (start: number, target: number, seen = new Set<number>()): boolean => {
      if (start === target) return true;
      if (seen.has(start)) return false;
      seen.add(start);
      return links.some(link => link.from === start && reachable(link.to, target, seen));
    };
    if (reachable(to[0], from[0])) { invalid = true; continue; }
    if (!links.some(e => e.from === from[0] && e.to === to[0])) links.push({ from: from[0], to: to[0], label: edge[3], source: { path: sourcePath, startLine: i + 1, endLine: i + 1 } });
  }
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
  return { steps, links, sourceKind: "P/N rows", relationships: !invalid && covered.size === steps.length ? "explicit" : "unresolved" };
}
