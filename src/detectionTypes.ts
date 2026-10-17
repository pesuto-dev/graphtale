import type { SourceRange } from "./shared/protocol";

export type DetectedStep = {
  display: string;
  title: string;
  body: string;
  source: SourceRange;
  resource?: string;
};

export type DetectedLink = {
  from: number;
  to: number;
  label?: string;
  source: SourceRange;
};

export type Detection = {
  steps: DetectedStep[];
  links: DetectedLink[];
  relationships: "explicit" | "unresolved";
  sourceKind: "numbered headings" | "numbered list" | "P/N rows";
};
