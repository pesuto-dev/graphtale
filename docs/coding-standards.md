# Coding standards

Graphtale follows the [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html),
[`typescript-eslint` `strict-type-checked` and `stylistic-type-checked`](https://typescript-eslint.io/users/configs),
and the [React](https://react.dev/) guidance that components render UI while hooks own state and effects.
This file is the repo-specific bar. Hard limits are enforced; preferred sizes are review guidance.

File names match the main export (`SkillNodeView.tsx`, `parseProcedure.ts`). That differs from Google's
lowercase file names so a component file and its export stay the same word. Do not add two files whose
names differ only by case: a Windows checkout cannot hold both.

## Layout

One responsibility per module. Pure logic stays out of filesystem, VS Code, and React.

Target folders for the follow-up split:

| Area | Folder |
| --- | --- |
| Skill parser | `src/parser/` |
| Extension host (panel, watchers, commands) | `src/host/` |
| Webview components | `webview/components/` |
| Webview hooks | `webview/hooks/` |
| Pure webview logic (layout, graph mapping) | `webview/lib/` |
| Webview CSS | `webview/styles/` |

`src/` and `webview/` are still flat. Do not move files in a feature PR. Until the split lands, put a
new file next to the module it extends.

## Sizes

Counts below skip blank lines and comment-only lines, matching ESLint `max-lines`.

| Unit | Preferred | Hard limit | Enforced by |
| --- | --- | --- | --- |
| TypeScript file | under 250 lines | 400 | `max-lines`, `npm run check:sizes` |
| Function | 40 lines or fewer | 60 | `max-lines-per-function` |
| Cyclomatic complexity | — | 10 | `complexity` |
| Nesting | — | 3 | `max-depth` |
| Parameters | — | 4, otherwise one options object | `max-params` |
| CSS file | under 200 lines | 300 | `npm run check:sizes` |

## Types

`strict` is on in `tsconfig.json` and `tsconfig.webview.json`.

`noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are part of this standard where they are
feasible. They are not enabled yet. Turning them on currently fails `tsc` in the parser and the webview,
the same files open pull requests are editing. TODO: enable both flags in the follow-up that splits those modules.

- No `any`. Use `unknown` and narrow it.
- No non-null assertions (`!`).
- Exported functions have an explicit return type (`explicit-module-boundary-types`).
- Results with more than one outcome are discriminated unions (`type` plus a literal tag).

## Names and exports

- Named exports only. The only default exports are tool configs that require one (`vite.config.ts`, `vitest.config.ts`).
- `PascalCase` for components, types, and classes. `camelCase` for values and functions. `use*` for hooks.
- The file name is the main export.

## React

- Components are presentational: props in, markup out.
- State, effects, and subscriptions live in custom hooks.
- An effect that subscribes, starts a timer, or registers a listener returns a cleanup.

`react-hooks/rules-of-hooks` and `react-hooks/exhaustive-deps` are errors on `webview/**`.

## Errors

Do not swallow a failure in an empty `catch`. Parser and host failures become a diagnosis or an error
the viewer already shows (banner, warning list, Retry). Do not log skill contents.

## Tests

- Colocate tests with the source: `*.test.ts` / `*.test.tsx`.
- Vitest. Component tests use jsdom and Testing Library.
- One behavior per test.

Testing Library and jsdom are the bar for new component tests. This change does not add those
dependencies; open pull requests #13 and #15 already introduce them.

## CSS

- One file per component or domain under `webview/styles/`.
- Design tokens are custom properties. A literal color, space, or font size belongs on a token, not in a rule.
- Class names are kebab-case and start with the component prefix (`.inspector-head`, `.skill-node`).
  React Flow's `react-flow__*` classes stay as that library spells them.
- `--vscode-*` keeps the editor's token name. Our own tokens are kebab-case.

`stylelint-config-standard` is the CSS lint, with two project adjustments: `no-descending-specificity`
is off because compact and high-contrast layers repeat selectors on purpose, and the class / custom-property
patterns above are allowed. `webview/styles.css` is ignored until the split; the size script still flags it.

## Enforcement

```bash
npm run lint          # ESLint, including the size and complexity rules
npm run lint:css      # stylelint
npm run check:sizes   # TypeScript 400, CSS 300
```

CI runs all three. A file that already misses a rule is listed in `eslint.exceptions.mjs` or in
`scripts/check-file-sizes.mjs`, with a TODO. Do not add `eslint-disable` comments in source. Do not add
a new file to those lists to pass CI. Remove an entry when the file meets the rule.
