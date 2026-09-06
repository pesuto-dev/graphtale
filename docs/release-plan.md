# Public preview release plan

Date: 2026-09-05. Status: slice 1 implemented and verified; later slices have
implementation in progress with release gates still open.

Current evidence: [release-verification.md](release-verification.md). Later slices
have local implementation in progress; unchecked release gates still require verification.

## Outcome and scope

Publish a small, trustworthy, read-only skill reviewer for people who write or
maintain Agent Skills. Users can inspect supported step structures, understand
which files belong to a skill, and follow the visualization back to its source.
Unsupported structure is a parser limitation, not evidence that a skill is bad.

Target positioning: **Graphtale — Visual review for Agent Skills.**

Keep the current extension host / webview / shared types architecture. Implement
the slices below in order, as small reviewable changes. Each slice should leave
the app usable. No flow editing, skill installation, execution tracing, backend,
LLM integration, or new graph format is needed for this release.

## Starting evidence

The review found passing typechecks, 81 passing tests, 3 skipped local-corpus
tests, 19 fixtures without validation issues, and a successful ~442 kB VSIX.
These checks ran locally on Node 26; CI specifies Node 22. A clean installation
in an extension host has not yet been verified.

Reproduced parser defects:

- P/N steps N3 Bake, N4 Cool, N5 Serve create an unsupported Question/Bug/Change
  branch and receive high confidence.
- A numbered Examples list containing Red and Blue becomes a high-confidence flow.
- Numbered level-two headings directly in SKILL.md are not detected.
- Falling back to SKILL.md steps can retain workflow.md as their source.

Other findings: shallow message validation; unhandled file-operation errors;
synchronous unbounded reads; skipped symlinked skills; incomplete discovery of
unlinked assets; a clipped primary marketplace screenshot; missing contributor
guidance and publication smoke tests.

## 1. Correct the parser and preserve evidence — release blocker

Primary files: src/parseProcedure.ts, src/shared/protocol.ts, parser tests and fixtures.

- [x] Add regression fixtures for the four reproduced defects before changing behavior.
- [x] Remove generic dependence on ticket names, fixed P/N identifiers, role order,
  implicit N2 parallelism, and the N7+N8 label special case. Inspect both
  buildPnGraph and buildLegacyRoleGraph.
- [x] Extract small internal modules for detection, source resolution, and graph
  construction as needed for these fixes. Keep the existing parser entry point;
  do not build a plugin framework.
- [x] Return source path and line ranges with detected steps. Keep a linked
  resource separate from the instruction that describes using it.
- [x] Detect supported numbered headings consistently in SKILL.md and linked
  workflow/operations files. Respect section boundaries, nesting and code fences.
- [x] Treat examples, alternative choices, and repeated Markdown `1.` numbering
  explicitly; assign unique internal IDs independently of displayed numbering.
- [x] Preserve recognized steps in source order. Create a branch or parallel edge
  only when supported syntax expresses it. Where relationships are ambiguous,
  show partial coverage or omit the unsupported relationship.
- [x] Distinguish explicit, inferred and unresolved relationships. Derive overall
  diagnosis from evidence and coverage, not merely from finding a numbered list.
- [x] Update golden expectations to match source evidence. Where a fixture intends
  a branch, make that branch explicit rather than retaining hardcoded behavior.

Acceptance: the reproduced defects are fixed; every drawn branch is justified by
source text; unrelated workflows retain their own names and ordering; uncertain
relationships cannot silently produce a fully confident diagnosis. No skill file
is changed by parsing.

Validation: focused parser regression tests, full npm test, npm run check,
npm run validate. Cover absent files, prose-only skills, numbered lists/headings,
examples, nested lists, code fences, branches and fallback source attribution.

Slice 1 verification (2026-09-05): 98 tests passed, 3 optional local-corpus
checks skipped; type-check, fixture validation (23 skills, zero issues), and
both bundles passed on Node 26.7.0. No extension-host verification was performed.
See [parser coverage](parser-coverage.md) for supported syntax and limitations.
Terra/high implemented the initial change and Luna/medium reviewed it; the parent
completed the remaining fixes after the implementation agent hit a credit error.

## 2. Make file and message handling resilient — release blocker

Primary files: src/shared/protocol.ts, src/panel.ts, src/discover.ts, src/parseSkill.ts.

- [ ] Validate required fields and enums for each host/webview message. Reject
  malformed payloads before using paths, graph data or clipboard text.
- [ ] Resolve UI file-open requests through known graph nodes and source locations;
  resolve skill-switch requests through the discovered catalog. Retain legitimate
  external references instead of restricting everything to the skill directory.
- [ ] Catch missing/unreadable/deleted files during open and refresh. Preserve the
  last good graph with a visible stale/error state and a retry action.
- [ ] Bound file reads and recursive inventory work, skip binary previews, and
  surface truncation. Choose and document limits using representative fixtures.
- [ ] Keep error details useful without dumping file contents into logs.

Acceptance: malformed messages, deleted SKILL.md files, unreadable references and
oversized inputs do not cause uncaught errors or silently erase the current view.

Validation: focused boundary/error tests plus a smoke test of open, refresh,
delete, retry and copy actions in an actual extension host.

## 3. Make the source and limitations obvious — release blocker

Depends on slices 1 and 2. Primary files: webview/App.tsx, webview/Inspector.tsx,
webview/styles.css, src/panel.ts, src/shared/protocol.ts.

- [ ] Open the exact instruction line from a selected step; expose a separate
  action to open its referenced script/agent/resource where applicable.
- [ ] Explain detected structure and uncertainty in plain language. Avoid claiming
  to show actual runtime behavior or implying confidence is a probability.
- [ ] Replace “No flow in this markdown” with wording such as “No supported step
  structure detected”. Give a reason and a direct action to inspect the files.
- [ ] Keep Flow as the first tab, with a useful empty state and one-click Catalog
  access. Keep the rewrite prompt optional and secondary.
- [ ] Make the inspector collapsible and ensure the overview fits without clipping;
  preserve usable navigation for large graphs rather than forcing illegible labels.
- [ ] Check focus visibility, keyboard actions, narrow panels, and light/dark themes.

Acceptance: a new user can inspect an ordinary skill without rewriting it, find
the evidence for a step, and distinguish supported structure from uncertainty.
The first demo shows a readable complete flow.

Validation: source-navigation tests where practical; manual checks in VS Code and
Cursor. Do not treat browser preview alone as extension integration coverage.

## 4. Check unfamiliar skills — release blocker

- [ ] Select 5–10 varied skills: simple numbered steps, prose-only instructions,
  linked workflows, scripts/assets, explicit branches and ambiguous structure.
- [ ] Record source URL/revision and reuse terms for third-party samples. Commit
  permitted fixtures with attribution, or create clearly labelled reproductions.
- [ ] Review expected steps and relationships manually before looking at parser output.
- [ ] Record detected structure, missing steps, unsupported/invented relationships,
  source-navigation correctness and usefulness of Catalog.
- [ ] Add minimal regressions for each discovered correctness bug; keep required
  release tests independent of locally installed skills.

Acceptance: zero known invented relationships in this sample; unsupported cases
are explained honestly; supported steps navigate to the correct source. A sample
pass is evidence for a preview, not a universal compatibility claim.

## 5. Prepare a welcoming public release — release blocker

Can begin after slice 1; final screenshots follow slices 3 and 4.

- [ ] Align README, package description, CONTEXT.md and relevant ADRs with visual
  skill review and parser limitations. Keep existing product/package identity.
- [ ] Put installation and a 60-second quickstart before development instructions.
  Include a small copyable skill and a complete 5–7-step demo.
- [ ] Replace the clipped hero screenshot with a readable overview; add a short
  Markdown-to-flow example. Use neutral paths in public screenshots.
- [ ] Add CONTRIBUTING.md: setup, tests, fixture conventions and scope boundaries.
- [ ] Add concise issue templates for incorrect flow, discovery issues and ideas.
  Ask for a minimal reproducible skill with private information removed.
- [ ] Document local data access, lack of backend/API requirement, supported
  environments and hobby-project support expectations.
- [ ] Review bundled third-party license texts/notices and fixture attribution.
  Check README links in both the repository and packaged extension.
- [ ] Add vscode:prepublish and make packaging/publication use the same build.
  Avoid redundant builds in CI where straightforward.
- [ ] Run CI on Node 22; add a Windows check for path/discovery behavior if feasible.
- [ ] Confirm publisher/repository destinations and choose preview distribution:
  GitHub Release VSIX first, then Marketplace; consider Open VSX if needed for
  the intended editors. Document the selected installation route.

Acceptance: a contributor can run the project from a clean checkout; a user can
install the built artifact and see the promised result; release materials explain
both capabilities and limitations without requiring knowledge of internal fixtures.

## 6. Release gate and feedback

- [ ] npm run check, npm test, npm run validate and npm run package pass.
- [ ] Install the generated VSIX in a clean VS Code profile and in Cursor.
- [ ] Exercise sidebar/picker, editor action, Flow/Catalog, source navigation,
  external references, refresh, deletion recovery, clipboard and empty state.
- [ ] Verify light/dark theme, narrow panel and basic keyboard navigation.
- [ ] Confirm package contents and that a new checkout can reproduce the build.
- [ ] Record known limitations and the tested editor versions in the release notes.
- [ ] Publish the preview when implementation and verification are complete.
  This plan itself does not publish anything.
- [ ] Ask 3–5 skill authors to try their own skills. Collect: what they understood
  faster, what was misleading, and whether they would use it on their next edit.

Success for the preview: people can explain a skill more easily and trust the
source links. Downloads alone do not determine the next feature.

## After the preview

These are planned follow-ups rather than reasons to delay the first release:

- Support symlinked skill directories with real-path deduplication and cycle safety.
- Expand Catalog to unlinked assets and useful custom folders without noisy or
  binary content previews; make the inventory scope explicit meanwhile.
- Measure discovery/parsing on a large corpus; add async I/O, catalog caching and
  debouncing where measurements show UI blocking. Move this into slice 2 if the
  release sample already produces visible stalls.
- Memoize layout calculation if interaction measurements justify it.
- Remove deprecated pipeline aliases once internal consumers and fixtures migrate.
- Consider export/shareable diagrams only when users ask for them repeatedly.

Flow editing, automatic rewriting, an LLM fallback and observed runtime remain
parked. Revisit scope after the first user feedback, not during release hardening.

## Effort guide

Rough planning allowance, not a deadline: parser/evidence work 3–5 evenings;
resilience 1–2; source navigation and UI 2–3; independent samples 1–2; release
materials and smoke tests 1–2. Aim for roughly 8–14 focused evenings, with parser
syntax and unfamiliar-skill findings as the largest uncertainties. Re-estimate
after slice 1 and reduce supported syntax before expanding the project scope.
