import * as path from "node:path";

export const DEMO_SKILL = `---
name: review-change
description: Review a change using its source evidence.
---

## Instructions

1. Read request

2. Gather files

3. Compare edits

4. Check evidence

5. Write findings

6. Return review
`;

/** Example skill the recorder writes under {tmpdir}/graphtale-demo-ws. */
export function demoSkillFile(tmpdir: string): string {
  return path.join(tmpdir, "graphtale-demo-ws", ".cursor", "skills", "review-change", "SKILL.md");
}
