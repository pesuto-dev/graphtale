# Public preview verification checkpoint

Updated 2026-09-06. Work is local and uncommitted. Nothing has been published.

## Review fixes and public repository cleanup — 2026-09-06

Numbered instruction titles containing section keywords now retain their steps
and relationships; Examples and Appendix ancestors still exclude descendants.
Inspector selections retain step excerpts when the full-file preview is truncated,
while failed reads still show an empty preview with a warning. Regression tests
cover both cases.

Removed unused imports and a validation parameter. Private session notes remain
local and ignored; credential and log exclusions were added. The release plan
links to this public evidence record instead of the private handoff.

Node 26.7.0: type checks (including unused declarations), 121 tests passed with
3 optional corpus tests skipped, 29 fixtures validated with zero issues, and
packaging passed. Fixture validation required an unsandboxed retry because the
TypeScript runner's local IPC socket was blocked. The package contains 22 files
(411.06 KB), with no development fixtures, private notes, or logs.

Current VSIX SHA-256:
`6642bbf187d4be00a3c5e7f8804cb1c80e66257cf79c83218668c17fa09bb41a`.
Earlier editor UI checks below apply to their recorded artifacts; this rebuilt
package has not been checked in an editor. Public destination and remaining
release gates are unchanged.

## Completed evidence

- Parser regressions and six independent synthetic samples pass. No skill is
  changed by parsing. See parser coverage and sample results.
- Host boundary tests cover malformed messages, known-node source navigation,
  missing/deleted files, preserving the previous graph, retry, and clipboard
  success/failure. Reads and inventory have documented limits.
- Browser checks cover complete overview bounds, inspector collapse, instruction
  and resource messages, keyboard focus, error/retry, narrow/light layout and
  the empty-state Catalog action. Browser automation caught and fixed a controlled
  selection loop and a stale resize observer.
- A VSIX installed successfully in isolated extension directories. Actual host
  smoke tests passed in VS Code 1.136.1 and Cursor 3.19.7 (VS Code API 1.128.0):
  activation, viewer tab, refresh, deleted-file refresh, recovery and read-only
  source behavior. Tests run against the extracted packaged artifact in clean
  user-data directories, not the developer source tree.
- 114 installed production dependency license files were included in
  THIRD_PARTY_NOTICES.md. This is a conservative runtime dependency inventory.

## Packaged VS Code UI check — 2026-09-06

VS Code 1.136.1 on macOS; isolated `ui-data`/`ui-ext`; disposable numbered-review
sample at `/tmp/graphtale-smoke-20260906/sample/SKILL.md`.
Installed files matched the earlier VSIX (package.json differed only by installer
metadata). Earlier VSIX SHA-256:
`08145ed299b808d03a73461bc48e79d72b20b87acb4cb731b9b10a5a0f1460b7`.

- Real packaged Flow rendered the root plus six instruction nodes.
- Selecting step 2 showed source line 8. Open instruction moved the editor to
  line 8, column 1. Catalog opened its inventory successfully.
- Screenshot: ignored `artifacts/webview-check/vscode-packaged-flow.png`.
- Restricted Mode initially disabled the command; trusting the disposable folder
  enabled it. CDP reconnects lost nested frame access; opening a fresh viewer
  and completing checks in one connection worked.
- Follow-up asset-report check passed: step 1 Open referenced resource opened
  `asset-report/assets/template.md`; step 2 opened `asset-report/scripts/report.py`
  at line 1, column 1. Editor breadcrumbs/content confirmed the destinations.
  Disposable fixture files still match the originals byte-for-byte.
  Screenshot: ignored `artifacts/webview-check/vscode-packaged-resource.png`.
- Packaged deletion/recovery check passed: refreshing after removing the disposable
  asset-report/SKILL.md showed the load error and Retry while preserving the graph.
  Restoring the file and using Retry cleared the error and restored the normal view.
  Evidence: ignored `artifacts/webview-check/vscode-packaged-retry-error2.png` and
  `artifacts/webview-check/vscode-packaged-retry-recovered.png`.
  Parent confirmed the restored SKILL.md matches the original byte-for-byte.
  Screenshot review found the Retry label wraps vertically in this narrow pane;
  record this layout follow-up separately from the successful recovery behavior.
- This is partial UI evidence. Clipboard, sidebar/picker,
  themes, keyboard, narrow layout and Cursor UI remain outstanding
  against the package.

## Retry layout source fix — 2026-09-06

The error banner let its Retry button shrink and inherit `overflow-wrap: anywhere`.
A browser reproduction measured four label lines at 420px. The scoped CSS fix
preserves button width and keeps the label on one line. Actual React preview
checks passed at 240, 320, 420 and 720px, including button bounds and no horizontal
page overflow. Screenshot reviewed: `artifacts/webview-check/retry-layout-fixed.png`.
Narrow Retry/overflow assertions were added to the existing browser verification
script. Only this layout was exercised in that run, not the full suite.

## Retry fix artifact rebuild — 2026-09-06

Node 22 `npm run package` passed, using the single prepublish build for both
bundles. The rebuilt `graphtale-0.0.1.vsix` contains 22 files (411.02 KB).
SHA-256: `1443a20d9f0e791ce2a599fc9e7390b788c222b02dd924c759d5640ee4f71cb3`.
Inspection of the CSS inside the ZIP confirmed the scoped Retry rule contains
`flex-shrink:0;white-space:nowrap`.

One isolated Luna/medium subagent installed the rebuilt package into `ui-ext`
and visually checked the real error banner in VS Code 1.136.1 after deleting
`sample/SKILL.md` and refreshing. At approximately 208px pane width (visual
estimate), Retry stayed on one line and inside the banner, with no visible page
overflow. The agent confirmed the loaded CSS included the fix. This was visual
verification, not a DOM geometry assertion. Its screenshot was emitted in the
agent tool output but was not saved locally; older error screenshots remain
pre-fix evidence and must not be relabeled.

Parent independently confirmed installed CSS matches the rebuilt ZIP and the
restored sample SHA-256 is
`a7f4407928ef543c9b50b96ab6ee029ee2fef775e906ec033ed3d2e35959266d`,
matching the agent's original-file hash. Temporary backup was removed.
No full browser suite or remaining editor checklist was run.

Persistent screenshot follow-up (2026-09-06): one isolated Luna/medium agent
saved `artifacts/webview-check/vscode-packaged-retry-narrow.png`, reviewed by
the parent. At 220px iframe width (about 208px content), Retry is on one line
inside the banner, the previous graph remains visible, and there is no visible
page overflow. The VSIX hash still matches the rebuilt artifact above.
Disposable files were restored and temporary capture files removed. Parent
verified root sample hash `a7f4407928ef543c9b50b96ab6ee029ee2fef775e906ec033ed3d2e35959266d`
and asset-report hash `7a8ddef84f5b0c7581d6b730ac0d7d164a1fdc9682a6677966cd1c8c2276320d`.
This follow-up adds persistent visual evidence only.

## Full browser verification rerun — 2026-09-06

One isolated Luna/medium subagent reran `npx tsx scripts/verify-webview.ts`
with Node 22 and `PREVIEW_URL=http://127.0.0.1:5194/preview.html?view=flow&compact=1`.
Passed: overview bounds, inspector collapse, source/resource messages, keyboard
focus, error/retry, light/narrow layout, and empty-state Catalog. The final narrow
Retry single-line and no-overflow assertions passed as part of this run.
Screenshots: `artifacts/webview-check/dark-overview.png` and `light-narrow.png`.

An initial attempt could not connect to the preview; starting the server and
running the check in the same shell succeeded. The temporary server was stopped.
The preview-data.json SHA-256 before and after matched:
`96ec65455c087504da399be4eda15ec702fe978347b61f5359cd7c78251f49cb`.
Parent independently confirmed the restored hash and screenshot files.
No implementation changes or additional release checks were made.

## Clean-snapshot Node 22 install/build — 2026-09-06

PASSED using one isolated Luna/medium agent. Current tracked and untracked
nonignored files were copied with `git ls-files -co --exclude-standard -z` and
tar into `/tmp/graphtale-clean-snapshot.426ZV0/source`; dotfiles were preserved,
with no existing `.git`, `node_modules`, or `dist` copied. This verifies the
uncommitted working snapshot on local macOS, not a committed checkout or remote CI.

Node v22.23.2 and npm 11.12.1: `npm ci` and `npm run compile` exited 0. The initial
sandbox install failed with "Exit handler never called"; an escalated network
retry succeeded. npm reported deprecated `whatwg-encoding@3.1.1` and
`prebuild-install@7.1.3`, plus one moderate audit vulnerability. These findings
were recorded without dependency changes or further investigation.

Parent verified all 221 source files matched the snapshot, both recorded exit
statuses were zero, and `dist/extension.js`, `dist/webview/index.html`,
`dist/webview/main.js`, and `dist/webview/assets/main.css` were nonempty.
Sorted source manifest SHA-256:
`781718a3a0c133decbe94644109bdba7cfc7ea82ac243a2ee05017f7c5006901`.
Logs/manifests: `/tmp/graphtale-clean-snapshot.426ZV0/logs/`.
Only handoff/evidence docs changed afterward; no tests, package rebuild, UI checks,
or publishing were performed in this bounded run.

## Final package/link review — 2026-09-06

One isolated Luna/medium agent inspected the existing final VSIX read-only.
Parent independently confirmed its recorded SHA-256, passing ZIP integrity, and
22 entries. Runtime bundles/assets, four user docs, license/notice/trademark,
and 114 dependency notice headings are present; development/test artifacts are
excluded. Metadata/docs match source except expected README link rewriting.
The packaged install guide's relative parser-coverage link resolves.

Public HTTP checks returned 200 for https://pesuto.dev/ and 404 for the declared
GitHub repository, issues, releases, and blob/main/PLAN.md URLs. Private versus
missing is undetermined. Local origin matches the declared repository. Public
repository availability, rewritten README links, and remote screenshot URLs
must be verified before release. No metadata was changed or publication attempted.
A suspected changelog case issue was ruled out: Git tracks `CHANGELOG.md`,
matching the rewritten repository URL despite the lowercase archive filename.

Archive review is complete; public-link readiness remains blocked. No rebuild,
implementation edits, suite reruns, or UI checks were performed in this review.

## Remaining release gates

Cursor launch diagnosis follow-up (2026-09-06): one isolated Luna/medium agent
found copied-app crash evidence in macOS LaunchServices (`_RegisterApplication`
/ `NSApplication`). A single retry with the signed `/Applications/Cursor.app`
binary and fresh isolated data/extensions directories produced no separate
accessible window, an empty log, and no new crash report. No navigation evidence
or screenshot was obtained. Existing `cursor-ext` is an earlier artifact:
`package.json` and `dist/extension.js` differ from the final VSIX. Future Cursor
UI verification requires an accessible isolated window and installation of the
final artifact. Do not repeat launch attempts without new evidence. Parent
reconfirmed the unchanged final VSIX and root sample hashes. No gate passed;
no implementation changes or broader checks were made.

Bounded Cursor attempt (2026-09-06): one isolated Luna/medium agent attempted
packaged step-2 Open instruction navigation. Blocked before UI verification:
the isolated Cursor launch exposed no separate window and a copied-app launch
exited with code 134. CUA showed only the existing `Cursor Agents` window;
the agent reported no CDP endpoint on the checked ports. No navigation result
or screenshot was obtained, and the installed Cursor extension was not verified
against the final artifact. This does not pass any Cursor UI gate.
Parent reconfirmed the final VSIX SHA-256 above and unchanged root sample hash
`a7f4407928ef543c9b50b96ab6ee029ee2fef775e906ec033ed3d2e35959266d`.
No implementation changes or broader checks were made.

- Complete the editor UI checklist in both editors: sidebar/picker and editor
  action, exact source/resource opening, clipboard, theme and keyboard checks.
  Host command smoke tests and browser checks cover different parts; neither is
  recorded as completion of that whole manual checklist.
- Confirm publisher/repository destination and permission to publish the preview.
- Publish only after the remaining gates pass. Author invitations and feedback
  collection need named recipients and explicit authorization to contact them.

CI now specifies Node 22 on Ubuntu and Windows. Local Node 22 verification is
recorded in the release-plan checkpoint; remote CI has not been triggered.
