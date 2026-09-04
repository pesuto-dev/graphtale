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

export type SkillNode = {
  id: string;
  label: string;
  kind: NodeKind;
  path: string;
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
  label?: string;
};

export type SkillGraph = {
  skillId: string;
  skillName: string;
  rootPath: string;
  nodes: SkillNode[];
  edges: SkillEdge[];
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
  | { type: "copyResult"; ok: boolean };

export type WebviewToHost =
  | { type: "ready" }
  | { type: "selectNode"; nodeId: string }
  | { type: "openFile"; path: string }
  | { type: "setDirection"; direction: LayoutDirection }
  | { type: "openSkill"; rootPath: string }
  | { type: "refresh" }
  | { type: "copyText"; text: string };

export function isHostToWebview(value: unknown): value is HostToWebview {
  if (!value || typeof value !== "object" || !("type" in value)) {
    return false;
  }
  const type = (value as { type: unknown }).type;
  return type === "graph" || type === "fileContent" || type === "direction" || type === "stale" || type === "copyResult";
}

export function isWebviewToHost(value: unknown): value is WebviewToHost {
  if (!value || typeof value !== "object" || !("type" in value)) {
    return false;
  }
  const type = (value as { type: unknown }).type;
  return (
    type === "ready" ||
    type === "selectNode" ||
    type === "openFile" ||
    type === "setDirection" ||
    type === "openSkill" ||
    type === "refresh" ||
    type === "copyText"
  );
}

export function emptyDiagnosis(skillName = "skill"): ProcedureDiagnosis {
  return {
    confidence: "none",
    message:
      "This markdown has no numbered steps, First Steps/Instructions, P/N graph, or workflow.md flow.",
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
      return "No flow in this markdown";
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
      return "Needed when Flow looks incomplete. Finish numbered steps or a P/N graph in the linked workflow. Catalog still lists the files.";
    case "none":
      return "Needed only if you want Flow to draw this skill. Add numbered First Steps or Instructions in SKILL.md, or a workflow.md with steps, using work the skill already does.";
    default: {
      const _exhaustive: never = confidence;
      return _exhaustive;
    }
  }
}

export function buildFixPrompt(skillName: string, detail: string): string {
  return [
    `The Agent Skill "${skillName}" does not state an explicit runtime order. Add one so a reader (and an agent) can follow the steps the skill already runs.`,
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
