import { describe, expect, it } from "vitest";
import {
  buildFixPrompt,
  compactFromQuery,
  diagnosisNeededWhen,
  diagnosisTitle,
  emptyDiagnosis,
  graphViewFromQuery,
  installedPluginCopy,
  withFixContext,
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
    expect(diagnosis.message).toMatch(/No supported step structure/i);
    expect(diagnosis.fixPrompt).not.toMatch(/so a viewer can show/i);
    expect(diagnosis.fixPrompt).not.toMatch(/Procedure (view|tab)/i);
    expect(diagnosis.fixPrompt).toMatch(/Do not invent new work/);
    expect(diagnosis.fixPrompt).toMatch(/## Workflow/);
    expect(diagnosis.fixPrompt).toMatch(/refreshes Flow/);
    expect(diagnosis.fixPrompt).toMatch(/Graphtale/);
  });
});

describe("diagnosis copy", () => {
  it("hides titles when Flow is already high confidence", () => {
    expect(diagnosisTitle("high")).toBe("");
    expect(diagnosisNeededWhen("high")).toBe("");
  });

  it("tells authors when the none banner is needed", () => {
    expect(diagnosisTitle("none")).toMatch(/No supported step structure detected/);
    expect(diagnosisNeededWhen("none")).toMatch(/without rewriting/i);
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

describe("withFixContext", () => {
  const prompt = buildFixPrompt("demo", "Nothing found.");
  const languagesFile = "/home/me/.graphtale/languages.json";

  it("names the skill file before the options", () => {
    const result = withFixContext(prompt, { skillFile: "/repo/skills/demo/SKILL.md", languagesFile, languages: [] });
    expect(result.indexOf("Skill file: /repo/skills/demo/SKILL.md")).toBeLessThan(result.indexOf("A) Repair the skill"));
    expect(result).toContain(`${languagesFile} (not created yet)`);
    expect(result).not.toMatch(/installed copy/);
  });

  it("warns that a plugin cache copy is overwritten on update", () => {
    const skillFile = "/home/me/.claude/plugins/cache/acme/tools/1.2.0/skills/demo/SKILL.md";
    const result = withFixContext(prompt, { skillFile, languagesFile, languages: ["nl"] });
    expect(result).toContain('installed copy of plugin "tools" (marketplace "acme", version 1.2.0)');
    expect(result).toMatch(/plugin's source repository/);
    expect(result).toContain("adds: nl");
  });

  it("offers registering a language as an alternative to editing the skill", () => {
    expect(prompt).toMatch(/B\) Keep the skill's own language/);
    expect(prompt).toContain("~/.graphtale/languages.json");
    expect(prompt).toMatch(/wait for the user's approval/);
  });
});

describe("installedPluginCopy", () => {
  it("is undefined outside the plugin cache", () => {
    expect(installedPluginCopy("/home/me/.claude/skills/demo/SKILL.md")).toBeUndefined();
  });

  it("recognizes a Windows plugin cache path", () => {
    expect(installedPluginCopy("C:\\Users\\me\\.claude\\plugins\\cache\\acme\\tools\\1.2.0\\skills\\demo\\SKILL.md"))
      .toEqual({ marketplace: "acme", plugin: "tools", version: "1.2.0" });
  });
});

it("keeps $ sequences in a skill path literal", () => {
  const skillFile = "C:\\Users\\$'me$&\\skills\\demo\\SKILL.md";
  const result = withFixContext(buildFixPrompt("demo", "x"), { skillFile, languagesFile: "C:\\l.json", languages: [] });
  expect(result).toContain(`Skill file: ${skillFile}`);
});
