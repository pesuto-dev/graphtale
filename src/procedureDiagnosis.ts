import type { Detection } from "./procedureDetection";
import type { ProcedureDiagnosis } from "./shared/protocol";
import { buildFixPrompt } from "./shared/protocol";

const UNRESOLVED = "Some relationships are unresolved or only part of the structure is supported.";
const EXPLICIT = "The ordered steps are stated in the source.";

export type CappedDetection = { detection: Detection; warning?: string };

/** Keep the first `maxSteps` steps and the links that stay inside that prefix. */
export function limitFlowSteps(detection: Detection, maxSteps: number): CappedDetection {
  if (detection.steps.length <= maxSteps) return { detection };
  const total = detection.steps.length;
  return {
    warning: `Flow shows ${maxSteps} of ${total} steps.`,
    detection: {
      ...detection,
      steps: detection.steps.slice(0, maxSteps),
      links: detection.links.filter(link => link.from < maxSteps && link.to < maxSteps),
    },
  };
}

export type FlowDiagnosisOptions = {
  detection: Detection;
  sourceName: string;
  skillName: string;
  warning?: string;
  hasWarnings: boolean;
};

/** Banner copy for one detected flow. Named findings replace the generic sentence. */
export function flowDiagnosis(options: FlowDiagnosisOptions): ProcedureDiagnosis {
  const findings = options.detection.findings ?? [];
  const notes = options.warning ? [...findings, options.warning] : [...findings];
  const detail = diagnosisDetail(options.detection.relationships, findings, notes);
  const confidence = options.detection.relationships === "explicit" && !options.hasWarnings ? "high" : "partial";
  const shown = options.detection.steps.length;
  return {
    confidence,
    message: `Flow detected from ${options.sourceName} as ${options.detection.sourceKind} (${shown} steps). ${detail}`,
    fixPrompt: buildFixPrompt(options.skillName, detail),
  };
}

function diagnosisDetail(relationships: Detection["relationships"], findings: string[], notes: string[]): string {
  if (relationships === "unresolved" && findings.length === 0) return [...notes, UNRESOLVED].join(" ");
  if (notes.length === 0) return EXPLICIT;
  return notes.join(" ");
}
