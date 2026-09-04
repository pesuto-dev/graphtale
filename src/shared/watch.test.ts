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
});
