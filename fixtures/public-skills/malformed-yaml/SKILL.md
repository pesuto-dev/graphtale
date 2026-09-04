---
name: [broken
description: this yaml is invalid
---

# Broken

This folder is for catalog resilience tests. The validator must report YAML
errors and still list the skill. `scripts/validate-skills.ts` skips `malformed*`.
