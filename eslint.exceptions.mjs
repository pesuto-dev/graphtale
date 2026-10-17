/**
 * Temporary per-file ESLint exceptions.
 *
 * TODO(coding-standards): remove a file after it satisfies every listed rule.
 * New files do not belong here. Do not add eslint-disable comments in source.
 * The module split that retires these entries is a follow-up PR. Landing it
 * here would rewrite the same files as open PRs #11, #12, #13, #15, and #16.
 *
 * @type {Record<string, string[]>}
 */
export const temporaryExceptions = {
  "scripts/capture-marketplace-screenshots.ts": [
    "@typescript-eslint/consistent-type-definitions",
    "@typescript-eslint/no-confusing-void-expression",
    "@typescript-eslint/no-unnecessary-condition",
    "@typescript-eslint/prefer-includes",
    "@typescript-eslint/restrict-template-expressions",
  ],
  "scripts/generate-preview-data.ts": [
    "@typescript-eslint/restrict-template-expressions",
  ],
  // L10 Async function 'main' has too many lines (70). Maximum allowed is 60.
  "scripts/verify-webview.ts": [
    "@typescript-eslint/consistent-type-definitions",
    "@typescript-eslint/no-confusing-void-expression",
    "@typescript-eslint/use-unknown-in-catch-callback-variable",
    "max-lines-per-function",
  ],
  // L34 Arrow function has too many lines (96). Maximum allowed is 60.
  "src/discover.test.ts": [
    "max-lines-per-function",
  ],
  // discoverSkills complexity 11; claudePluginSkillDirs complexity 13; listSkillsIn complexity 19.
  "src/discover.ts": [
    "@typescript-eslint/consistent-type-definitions",
    "@typescript-eslint/prefer-regexp-exec",
    "@typescript-eslint/restrict-template-expressions",
    "complexity",
  ],
  "src/extension.ts": [
    "@typescript-eslint/no-confusing-void-expression",
    "@typescript-eslint/no-empty-function",
  ],
  "src/fileAccess.test.ts": [
    "@typescript-eslint/no-confusing-void-expression",
    "@typescript-eslint/no-unsafe-argument",
    "@typescript-eslint/no-unsafe-assignment",
    "@typescript-eslint/restrict-template-expressions",
  ],
  // walkTextFiles > visit: complexity 12, nesting 4.
  "src/fileAccess.ts": [
    "@typescript-eslint/consistent-type-definitions",
    "@typescript-eslint/restrict-template-expressions",
    "complexity",
    "max-depth",
  ],
  "src/panel.test.ts": [
    "@typescript-eslint/consistent-type-definitions",
    "@typescript-eslint/no-empty-function",
    "@typescript-eslint/no-extraneous-class",
    "@typescript-eslint/no-unsafe-assignment",
    "@typescript-eslint/no-unsafe-member-access",
  ],
  // L216 Method 'sendFile' has a complexity of 12. Maximum allowed is 10.
  "src/panel.ts": [
    "@typescript-eslint/no-confusing-void-expression",
    "@typescript-eslint/restrict-template-expressions",
    "complexity",
  ],
  "src/parsePipeline.test.ts": [
    "@typescript-eslint/no-deprecated",
  ],
  "src/parsePipeline.ts": [
    "@typescript-eslint/no-deprecated",
  ],
  // L75 Arrow function has too many lines (227). Maximum allowed is 60.
  "src/parseProcedure.test.ts": [
    "max-lines-per-function",
  ],
  // parseProcedure complexity 15; partialResult 6 params; resolveResource complexity 16.
  "src/parseProcedure.ts": [
    "@typescript-eslint/array-type",
    "@typescript-eslint/consistent-type-definitions",
    "@typescript-eslint/no-deprecated",
    "@typescript-eslint/prefer-regexp-exec",
    "@typescript-eslint/restrict-template-expressions",
    "complexity",
    "max-params",
  ],
  "src/parseSkill.ts": [
    "@typescript-eslint/consistent-type-definitions",
    "@typescript-eslint/restrict-template-expressions",
  ],
  // visibleLines callback complexity 14; detectSteps 75 lines, complexity 34;
  // extractPn 132 lines, complexity 40; nesting 4 and two non-null assertions.
  "src/procedureDetection.ts": [
    "@typescript-eslint/array-type",
    "@typescript-eslint/consistent-type-definitions",
    "@typescript-eslint/no-non-null-assertion",
    "@typescript-eslint/prefer-optional-chain",
    "@typescript-eslint/prefer-regexp-exec",
    "@typescript-eslint/prefer-string-starts-ends-with",
    "complexity",
    "max-depth",
    "max-lines-per-function",
  ],
  // L46 Forbidden non-null assertion.
  "src/procedureEvidence.test.ts": [
    "@typescript-eslint/no-confusing-void-expression",
    "@typescript-eslint/no-non-null-assertion",
  ],
  // L16 Arrow function has too many parameters (6). Maximum allowed is 4.
  "src/releaseSamples.test.ts": [
    "max-params",
  ],
  // node predicate complexity 11; isHostToWebview complexity 22; isWebviewToHost complexity 11.
  "src/shared/protocol.ts": [
    "@typescript-eslint/consistent-type-definitions",
    "complexity",
  ],
  "src/shared/reload.ts": [
    "@typescript-eslint/array-type",
  ],
  // addMarkdownLinks 6 params; addDispatchedAgents 65 lines, complexity 18, 6 params, nesting 4;
  // addSkillMentions 5 params.
  "src/skillLinks.ts": [
    "@typescript-eslint/restrict-template-expressions",
    "complexity",
    "max-depth",
    "max-lines-per-function",
    "max-params",
  ],
  // L59 Function 'kindFor' has a complexity of 14. Maximum allowed is 10. L133 Function 'addFolderFiles' has too many parameters (7). Maximum allowed is 4. L153 Function 'addFileNode' has too many parameters (8). Maximum allowed is 4.
  "src/skillPaths.ts": [
    "complexity",
    "max-params",
  ],
  "src/validate.ts": [
    "@typescript-eslint/consistent-type-definitions",
    "@typescript-eslint/restrict-template-expressions",
  ],
  "src/viewerAccess.ts": [
    "@typescript-eslint/array-type",
  ],
  // Rollup's asset `name` is deprecated in favor of `names`. Left in place so the CSS filename stays `assets/main.css`.
  "vite.config.ts": [
    "@typescript-eslint/no-deprecated",
  ],
  // L22 Missing return type on function. L30 Function 'AppShell' has too many lines (180). Maximum allowed is 60. L30 Function 'AppShell' has a complexity of 43. Maximum allowed is 10.
  "webview/App.tsx": [
    "@typescript-eslint/explicit-module-boundary-types",
    "@typescript-eslint/no-confusing-void-expression",
    "@typescript-eslint/restrict-template-expressions",
    "complexity",
    "max-lines-per-function",
  ],
  // L72 Function 'CatalogInventory' has too many lines (90). Maximum allowed is 60. L72 Missing return type on function.
  "webview/CatalogInventory.tsx": [
    "@typescript-eslint/consistent-type-definitions",
    "@typescript-eslint/explicit-module-boundary-types",
    "@typescript-eslint/no-confusing-void-expression",
    "max-lines-per-function",
  ],
  // L9 Function 'roundedWrapPath' has too many parameters (7). Maximum allowed is 4. L60 Missing return type on function.
  "webview/CompactWrapEdge.tsx": [
    "@typescript-eslint/consistent-type-definitions",
    "@typescript-eslint/explicit-module-boundary-types",
    "@typescript-eslint/restrict-template-expressions",
    "max-params",
  ],
  // L7 Function 'Inspector' has too many lines (130). Maximum allowed is 60. L7 Function 'Inspector' has a complexity of 22. Maximum allowed is 10. L7 Missing return type on function.
  "webview/Inspector.tsx": [
    "@typescript-eslint/explicit-module-boundary-types",
    "@typescript-eslint/no-confusing-void-expression",
    "@typescript-eslint/restrict-template-expressions",
    "complexity",
    "max-lines-per-function",
  ],
  // L7 Missing return type on function.
  "webview/Legend.tsx": [
    "@typescript-eslint/explicit-module-boundary-types",
  ],
  // L5 Function 'KindIcon' has too many lines (64). Maximum allowed is 60. L71 Missing return type on function.
  "webview/ShapeMark.tsx": [
    "@typescript-eslint/explicit-module-boundary-types",
    "max-lines-per-function",
  ],
  // L29 Function 'SkillNodeView' has too many lines (97). Maximum allowed is 60. L29 Function 'SkillNodeView' has a complexity of 19. Maximum allowed is 10. L29 Missing return type on function.
  "webview/SkillNodeView.tsx": [
    "@typescript-eslint/explicit-module-boundary-types",
    "complexity",
    "max-lines-per-function",
  ],
  // L19 Arrow function has too many lines (153). Maximum allowed is 60.
  "webview/compactColumns.test.ts": [
    "max-lines-per-function",
  ],
  "webview/compactColumns.ts": [
    "@typescript-eslint/consistent-type-definitions",
    "@typescript-eslint/prefer-nullish-coalescing",
    "@typescript-eslint/prefer-optional-chain",
  ],
  // describe callback 103 lines; twelve non-null assertions in the geometry fixtures.
  "webview/compactGeometry.test.ts": [
    "@typescript-eslint/no-non-null-assertion",
    "max-lines-per-function",
  ],
  // L63 Function 'styleCompactEdge' has too many lines (62). Maximum allowed is 60. L63 Function 'styleCompactEdge' has a complexity of 30. Maximum allowed is 10.
  "webview/compactGeometry.ts": [
    "@typescript-eslint/consistent-type-definitions",
    "@typescript-eslint/prefer-nullish-coalescing",
    "@typescript-eslint/prefer-optional-chain",
    "complexity",
    "max-lines-per-function",
  ],
  // L12 Arrow function has too many lines (82). Maximum allowed is 60.
  "webview/compactLayout.test.ts": [
    "max-lines-per-function",
  ],
  // L74 Missing return type on function.
  "webview/compactTestHelpers.ts": [
    "@typescript-eslint/explicit-module-boundary-types",
  ],
  // L4 Arrow function has a complexity of 16. Maximum allowed is 10.
  "webview/edges.ts": [
    "complexity",
  ],
  "webview/layout.ts": [
    "@typescript-eslint/no-unnecessary-condition",
    "@typescript-eslint/prefer-nullish-coalescing",
  ],
  // applyHostMessage 74 lines, complexity 22; useEffect omits `bindings` (recreated each render).
  "webview/useHostMessages.ts": [
    "@typescript-eslint/consistent-type-definitions",
    "@typescript-eslint/no-confusing-void-expression",
    "@typescript-eslint/no-deprecated",
    "@typescript-eslint/no-unnecessary-condition",
    "complexity",
    "max-lines-per-function",
    "react-hooks/exhaustive-deps",
  ],
  // L23 Function 'useViewState' has too many lines (166). Maximum allowed is 60. L23 Missing return type on function.
  "webview/useViewState.ts": [
    "@typescript-eslint/explicit-module-boundary-types",
    "@typescript-eslint/no-confusing-void-expression",
    "@typescript-eslint/no-unnecessary-condition",
    "@typescript-eslint/no-unnecessary-type-assertion",
    "max-lines-per-function",
  ],
  "webview/vscode.ts": [
    "@typescript-eslint/consistent-type-definitions",
  ],
};
