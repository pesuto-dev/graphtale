export type NodeKind = "skill" | "reference" | "agent" | "script" | "shared" | "gate";

/** Catalog = file inventory; Flow = runtime steps shown in the UI. */
export type GraphView = "catalog" | "flow";

/** Default tab is Flow. `procedure` remains a preview-query alias. */
export function graphViewFromQuery(search: string): GraphView {
  const view = new URLSearchParams(search).get("view");
  if (view === "catalog") {
    return "catalog";
  }
  return "flow";
}

/** Preview harness: `/preview.html?view=flow&compact=1` opens Compact. */
export function compactFromQuery(search: string): boolean {
  const value = new URLSearchParams(search).get("compact");
  return value === "1" || value === "true";
}

export type LayoutDirection = "LR" | "TB";

export type ProcedureConfidence = "high" | "partial" | "none";

export type UseChip = {
  label: string;
  targetId?: string;
};

/** Location of text that directly supports a detected flow element. */
export type SourceRange = {
  path: string;
  startLine: number;
  endLine: number;
};

/** How much of a drawn relationship is stated by the source. */
export type RelationshipEvidence = "explicit" | "inferred" | "unresolved";

export type SkillNode = {
  id: string;
  label: string;
  kind: NodeKind;
  path: string;
  /** The instruction that describes this step. */
  source?: SourceRange;
  /** A script, agent, or document used by the instruction, when resolved. */
  resourcePath?: string;
  summary: string;
  uses: UseChip[];
  inferred?: boolean;
  isEntry?: boolean;
  isBlock?: boolean;
  pending?: boolean;
  excerpt?: string;
};

export type SkillEdge = {
  from: string;
  to: string;
  inferred?: boolean;
  /** Low-confidence / conditional flow edges render dashed in the UI. */
  confidence?: "high" | "low";
  relationship?: RelationshipEvidence;
  source?: SourceRange;
  label?: string;
};

export type SkillGraph = {
  skillId: string;
  skillName: string;
  rootPath: string;
  nodes: SkillNode[];
  edges: SkillEdge[];
  warnings?: string[];
};

export type ProcedureDiagnosis = {
  confidence: ProcedureConfidence;
  message: string;
  fixPrompt: string;
};

export type ProcedureResult = {
  graph: SkillGraph;
  diagnosis: ProcedureDiagnosis;
};

export type CatalogSkill = {
  id: string;
  name: string;
  description: string;
  rootPath: string;
  /** YAML frontmatter failed to parse; catalog still lists the folder. */
  frontmatterError?: string;
};

export type FileContentPayload = {
  nodeId: string;
  path: string;
  text: string;
  notice?: string;
  wrapper?: {
    path: string;
    prefix: string;
    suffix: string;
  };
};

export type HostToWebview =
  | {
      type: "graph";
      graph: SkillGraph;
      /** @deprecated use procedure — kept during migration */
      pipeline?: SkillGraph;
      procedure: SkillGraph;
      diagnosis: ProcedureDiagnosis;
      catalog: CatalogSkill[];
      direction: LayoutDirection;
    }
  | { type: "fileContent"; payload: FileContentPayload }
  | { type: "direction"; direction: LayoutDirection }
  | { type: "stale"; stale: boolean }
  | { type: "copyResult"; ok: boolean }
  | { type: "error"; message: string; retryable: boolean };

export type WebviewToHost =
  | { type: "ready" }
  | { type: "selectNode"; nodeId: string }
  | { type: "openFile"; nodeId: string; target?: "instruction" | "resource" | "wrapper" }
  | { type: "setDirection"; direction: LayoutDirection }
  | { type: "openSkill"; rootPath: string }
  | { type: "refresh" }
  | { type: "copyText"; text: string };

type RecordValue = Record<string, unknown>;
const record = (v: unknown): v is RecordValue => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === "string" && v.length <= 1_048_576;
const identifier = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 4096 && !v.includes("\0");
const bool = (v: unknown): v is boolean => typeof v === "boolean";
const oneOf = (v: unknown, values: string[]): boolean => typeof v === "string" && values.includes(v);
const optional = (v: unknown, check: (v: unknown) => boolean): boolean => v === undefined || check(v);
const list = (v: unknown, check: (v: unknown) => boolean, max = 10_000): boolean => Array.isArray(v) && v.length <= max && v.every(check);
const direction = (v: unknown): boolean => oneOf(v, ["LR", "TB"]);
const source = (v: unknown): boolean => record(v) && identifier(v.path) && Number.isSafeInteger(v.startLine) &&
  Number(v.startLine) >= 1 && Number.isSafeInteger(v.endLine) && Number(v.endLine) >= Number(v.startLine);
const node = (v: unknown): boolean => record(v) && identifier(v.id) && text(v.label) &&
  oneOf(v.kind, ["skill", "reference", "agent", "script", "shared", "gate"]) && identifier(v.path) && text(v.summary) &&
  list(v.uses, chip => record(chip) && text(chip.label) && optional(chip.targetId, identifier), 1000) &&
  optional(v.source, source) && optional(v.resourcePath, identifier) && optional(v.excerpt, text) &&
  ["inferred", "isEntry", "isBlock", "pending"].every(key => optional(v[key], bool));
const edge = (v: unknown): boolean => record(v) && identifier(v.from) && identifier(v.to) &&
  optional(v.inferred, bool) && optional(v.confidence, x => oneOf(x, ["high", "low"])) &&
  optional(v.relationship, x => oneOf(x, ["explicit", "inferred", "unresolved"])) && optional(v.source, source) && optional(v.label, text);
function graph(v: unknown): boolean {
  if (!record(v) || !text(v.skillId) || !text(v.skillName) || !(v.rootPath === "" || identifier(v.rootPath)) ||
    !list(v.nodes, node) || !list(v.edges, edge, 30_000) || !optional(v.warnings, x => list(x, text))) return false;
  const ids = new Set((v.nodes as SkillNode[]).map(n => n.id));
  return ids.size === (v.nodes as SkillNode[]).length && (v.edges as SkillEdge[]).every(e => ids.has(e.from) && ids.has(e.to));
}
const catalogSkill = (v: unknown): boolean => record(v) && identifier(v.id) && text(v.name) && text(v.description) &&
  identifier(v.rootPath) && optional(v.frontmatterError, text);

export function isHostToWebview(value: unknown): value is HostToWebview {
  if (!record(value)) return false;
  switch (value.type) {
    case "graph": return graph(value.graph) && graph(value.procedure) && optional(value.pipeline, graph) &&
      record(value.diagnosis) && oneOf(value.diagnosis.confidence, ["high", "partial", "none"]) &&
      text(value.diagnosis.message) && text(value.diagnosis.fixPrompt) && list(value.catalog, catalogSkill) && direction(value.direction);
    case "fileContent": return record(value.payload) && identifier(value.payload.nodeId) && identifier(value.payload.path) &&
      text(value.payload.text) && optional(value.payload.notice, text) && optional(value.payload.wrapper, wrapper =>
        record(wrapper) && identifier(wrapper.path) && text(wrapper.prefix) && text(wrapper.suffix));
    case "direction": return direction(value.direction);
    case "stale": return bool(value.stale);
    case "copyResult": return bool(value.ok);
    case "error": return text(value.message) && bool(value.retryable);
    default: return false;
  }
}

export function isWebviewToHost(value: unknown): value is WebviewToHost {
  if (!record(value)) return false;
  switch (value.type) {
    case "ready": case "refresh": return true;
    case "selectNode": return identifier(value.nodeId);
    case "openFile": return identifier(value.nodeId) && optional(value.target, x => oneOf(x, ["instruction", "resource", "wrapper"]));
    case "openSkill": return identifier(value.rootPath);
    case "setDirection": return direction(value.direction);
    case "copyText": return text(value.text) && value.text.length <= 65_536;
    default: return false;
  }
}

export function emptyDiagnosis(skillName = "skill"): ProcedureDiagnosis {
  return {
    confidence: "none",
    message:
      "No supported step structure was detected. The instructions may use prose or syntax this parser does not recognize.",
    fixPrompt: buildFixPrompt(
      skillName,
      "No numbered steps, P/N workflow graph, Instructions/First Steps section, or workflow.md flow was found.",
    ),
  };
}

export function diagnosisTitle(confidence: ProcedureConfidence): string {
  switch (confidence) {
    case "high":
      return "";
    case "partial":
      return "Partial flow";
    case "none":
      return "No supported step structure detected";
    default: {
      const _exhaustive: never = confidence;
      return _exhaustive;
    }
  }
}

/** Shown in the banner: when this message matters, and what to do. */
export function diagnosisNeededWhen(confidence: ProcedureConfidence): string {
  switch (confidence) {
    case "high":
      return "";
    case "partial":
      return "Some relationships are incomplete or ambiguous. Inspect the source and Catalog to review the rest of the skill.";
    case "none":
      return "You can review the files in Catalog without rewriting the skill. This is a parser limitation, not a judgement of the skill.";
    default: {
      const _exhaustive: never = confidence;
      return _exhaustive;
    }
  }
}

export function buildFixPrompt(skillName: string, detail: string): string {
  return [
    `The Agent Skill "${skillName}" has instructions that the visual reviewer could not fully interpret. Optionally clarify their intended order for readers.`,
    "",
    "Do not change what the skill does. Do not invent new work.",
    "",
    "Observed:",
    detail,
    "",
    "Add ONE of these, using only steps already implied by the existing text:",
    "",
    "1) In SKILL.md, a numbered section such as:",
    "",
    "## First Steps",
    "1. …",
    "2. …",
    "",
    "2) Or a references/workflow.md (or workflow.md) with numbered headings or a P/N ASCII graph, naming scripts/ and agents the skill already uses.",
    "",
    "After saving, click Refresh in Graphtale. Catalog stays the file list; Flow should show the ordered steps.",
  ].join("\n");
}
