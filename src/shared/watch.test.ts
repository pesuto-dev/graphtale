import { describe, expect, it } from "vitest";
import { extraWatchFiles, isWatchedChange } from "./watch";

describe("isWatchedChange", () => {
  it("treats any file under the open skill root as a change", () => {
    expect(
      isWatchedChange("/repo/analyse-ticket/workflow.md", "/repo/analyse-ticket", []),
    ).toBe(true);
    expect(
      isWatchedChange("/repo/analyse-ticket/prompts/classify.md", "/repo/analyse-ticket", []),
    ).toBe(true);
    expect(isWatchedChange("/repo/other/SKILL.md", "/repo/analyse-ticket", [])).toBe(false);
  });

  it("also watches linked files outside the skill folder", () => {
    const extras = extraWatchFiles(["/home/user/.claude/references/evidence-sources.md"]);
    expect(
      isWatchedChange(
        "/home/user/.claude/references/evidence-sources.md",
        "/repo/analyse-ticket",
        extras,
      ),
    ).toBe(true);
    expect(
      isWatchedChange("/home/user/.claude/references/other.md", "/repo/analyse-ticket", extras),
    ).toBe(false);
  });

  it("matches Windows paths regardless of drive-letter case and separators", () => {
    expect(isWatchedChange("c:\\Users\\me\\.claude\\skills\\pa\\SKILL.md", "C:\\Users\\me\\.claude\\skills\\pa", [])).toBe(true);
    expect(isWatchedChange("c:\\Users\\me\\.graphtale\\languages.json", "D:\\skills\\pa", ["C:\\Users\\me\\.graphtale\\languages.json"])).toBe(true);
    expect(isWatchedChange("/Repo/pa/SKILL.md", "/repo/pa", [])).toBe(false);
  });
});
