import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { DEMO_SKILL, demoSkillFile } from "./demoWorkspace";

describe("demoSkillFile", () => {
  it("places SKILL.md in the graphtale demo workspace", () => {
    expect(demoSkillFile("/tmp")).toBe(path.join("/tmp", "graphtale-demo-ws", ".cursor", "skills", "review-change", "SKILL.md"));
  });
});

describe("DEMO_SKILL", () => {
  it("includes the Compare edits step the recording clicks", () => {
    expect(DEMO_SKILL).toContain("3. Compare edits");
  });
});
