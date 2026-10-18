import { extractPn } from "./procedurePn";
import { conditionalWord, scanGroups, type DetectedStep, type StepGroup } from "./procedureScan";
import { ENGLISH, type Vocabulary } from "./procedureVocabulary";
import type { SourceRange } from "./shared/protocol";
import { nameFirst } from "./text";

export type { DetectedStep } from "./procedureScan";

const MAX_NAMED_STEPS = 4;

export interface DetectedLink { from: number; to: number; label?: string; source: SourceRange }
export interface Detection {
  steps: DetectedStep[];
  links: DetectedLink[];
  relationships: "explicit" | "unresolved";
  sourceKind: "numbered headings" | "numbered list" | "P/N rows";
  /** Named reasons a flow is partial. Empty when every drawn edge is explicit. */
  findings?: string[];
}

export function detectSteps(text: string, sourcePath: string, vocabulary: Vocabulary = ENGLISH): Detection | undefined {
  const usable = scanGroups(text, sourcePath, vocabulary);
  return usable.length > 0 ? detectionFromGroups(usable) : extractPn(text, sourcePath, vocabulary);
}

function detectionFromGroups(usable: StepGroup[]): Detection {
  const steps = usable.flatMap(group => group.steps);
  const links: DetectedLink[] = [];
  const conditional: string[] = [];
  let offset = 0;
  let uncertain = usable.length > 1;
  for (const group of usable) {
    uncertain = linkGroup(group, offset, { links, conditional }) || uncertain;
    offset += group.steps.length;
  }
  const sourceKind = usable.at(0)?.kind ?? "numbered list";
  const findings = [...groupFindings(usable), ...conditionalFindings(conditional)];
  return { steps, links, sourceKind, relationships: uncertain ? "unresolved" : "explicit", findings };
}

function groupFindings(usable: StepGroup[]): string[] {
  const start = (group: StepGroup): string => String(group.steps.at(0)?.source.startLine ?? 0);
  const findings = usable.filter(group => group.ambiguous)
    .map(group => `The list at line ${start(group)} is introduced as a choice, so Flow draws no edges in it.`);
  if (usable.length < 2) return findings;
  const lines = usable.map(group => `line ${start(group)}`).join(", ");
  return [...findings, `${String(usable.length)} separate step lists (${lines}); Flow does not connect them.`];
}

function conditionalFindings(conditional: string[]): string[] {
  if (conditional.length === 0) return [];
  return [`Conditional wording gives these steps no edge in or out: ${nameFirst(conditional, MAX_NAMED_STEPS, "; ")}.`];
}

/** Records a conditional step for the diagnosis; true when the step is conditional. */
function noteConditional(step: DetectedStep, conditional: string[]): boolean {
  const found = conditionalWord(step);
  if (found) conditional.push(`step ${step.display} (line ${String(found.line)}, "${found.word}")`);
  return found !== undefined;
}

function linkGroup(group: StepGroup, offset: number, out: { links: DetectedLink[]; conditional: string[] }): boolean {
  let uncertain = !!group.ambiguous;
  for (let index = 0; index < group.steps.length; index += 1) {
    const step = group.steps.at(index);
    const next = group.steps.at(index + 1);
    if (!step) continue;
    const ambiguous = !!group.ambiguous || noteConditional(step, out.conditional);
    if (ambiguous) uncertain = true;
    const nextConditional = next !== undefined && conditionalWord(next) !== undefined;
    if (next && !ambiguous && !nextConditional) out.links.push({ from: offset + index, to: offset + index + 1, source: step.source });
  }
  return uncertain;
}
