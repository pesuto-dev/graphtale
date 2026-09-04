import { describe, expect, it } from "vitest";
import {
  buildFixPrompt,
  compactFromQuery,
  diagnosisNeededWhen,
  diagnosisTitle,
  emptyDiagnosis,
  graphViewFromQuery,
} from "./protocol";

describe("graphViewFromQuery", () => {
  it("defaults to Flow", () => {
    expect(graphViewFromQuery("")).toBe("flow");
    expect(graphViewFromQuery("?view=flow")).toBe("flow");
    expect(graphViewFromQuery("?view=procedure")).toBe("flow");
  });

  it("opens Catalog only when the query asks for it", () => {
    expect(graphViewFromQuery("?view=catalog")).toBe("catalog");
  });
});

describe("compactFromQuery", () => {
  it("is off unless the query asks for Compact", () => {
    expect(compactFromQuery("")).toBe(false);
    expect(compactFromQuery("?view=flow")).toBe(false);
    expect(compactFromQuery("?view=flow&compact=1")).toBe(true);
    expect(compactFromQuery("?compact=true")).toBe(true);
    expect(compactFromQuery("?compact=0")).toBe(false);
  });
});

describe("emptyDiagnosis", () => {
  it("says when Flow is missing, not that the skill is broken", () => {
    const diagnosis = emptyDiagnosis("prose-only");
    expect(diagnosis.message).toMatch(/no numbered steps/i);
    expect(diagnosis.fixPrompt).not.toMatch(/so a viewer can show/i);
    expect(diagnosis.fixPrompt).not.toMatch(/Procedure/);
    expect(diagnosis.fixPrompt).toMatch(/Do not invent new work/);
    expect(diagnosis.fixPrompt).toMatch(/## First Steps/);
    expect(diagnosis.fixPrompt).toMatch(/Refresh/);
    expect(diagnosis.fixPrompt).toMatch(/Graphtale/);
  });
});

describe("diagnosis copy", () => {
  it("hides titles when Flow is already high confidence", () => {
    expect(diagnosisTitle("high")).toBe("");
    expect(diagnosisNeededWhen("high")).toBe("");
  });

  it("tells authors when the none banner is needed", () => {
    expect(diagnosisTitle("none")).toMatch(/No flow in this markdown/);
    expect(diagnosisNeededWhen("none")).toMatch(/only if you want Flow/i);
  });

  it("tells authors when a partial workflow needs finishing", () => {
    expect(diagnosisTitle("partial")).toBe("Partial flow");
    expect(diagnosisNeededWhen("partial")).toMatch(/incomplete/i);
  });

  it("asks chat to keep existing behaviour", () => {
    const prompt = buildFixPrompt("thin", "Found workflow.md but could not parse ordered steps.");
    expect(prompt).toContain("thin");
    expect(prompt).toMatch(/Do not change what the skill does/);
    expect(prompt).toMatch(/numbered headings or a P\/N ASCII graph/);
  });
});
