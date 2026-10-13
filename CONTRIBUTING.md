# Contributing to Graphtale

Graphtale is a read-only viewer for Agent Skills. Contributions should improve
source-grounded Flow or Catalog review. Skill editing, execution tracing,
installers, backend services, and LLM features are outside the current scope.

## Setup

Use Node.js 22 or 24 (the versions CI runs) and npm. From a clean checkout:

```bash
npm install
```

Useful commands:

| Command | What it does |
| --- | --- |
| `npm run lint` | ESLint on TypeScript and script sources |
| `npm run check` | Type-check the extension host and the webview |
| `npm test` | Vitest (`src/**/*.test.ts` and `webview/**/*.test.ts`) |
| `npm run validate` | Check committed skill fixtures |
| `npm run compile` | Bundle the extension host and the webview into `dist/` |
| `npm run preview` | Browser preview of the webview with fixture data |
| `npm run package` | Build and create a local `.vsix` (does not publish) |

Before opening a pull request, run `npm run lint`, `npm run check`, `npm test`,
and `npm run validate`. Run `npm run package` when you change the build,
manifest, or files that ship in the VSIX.

`npm run preview` does not exercise the extension host. Host behavior still
needs a local Cursor or VS Code **Run Extension** session
(`.vscode/launch.json`). The extension host is not available in a headless
cloud environment.

## Fixtures and parser changes

Fixtures are intentionally small and self-contained under `fixtures/`. Hidden
skill directories may require `ls -a` or `find`. Keep fixture skill files
unchanged during parsing. Add a focused regression when a parser change affects
supported structure, source attribution, relationships, or diagnosis. Use
explicit arrows for branches. Do not rely on names, roles, indentation, or
displayed numbering to imply runtime relationships.

Document new syntax and known limits in [docs/parser-coverage.md](docs/parser-coverage.md).
Keep examples synthetic, or include attribution and reuse terms.

`fixtures/user-skills/` (except its README) is gitignored. Do not commit skills
copied from a machine. `fixtures/empty-home` is the fake home directory tests
use so user-level discovery stays deterministic.

## Pull requests

1. Branch from `main`. Keep the change focused on one review improvement.
2. Describe the user-visible result and, for a Flow change, the source evidence
   that justifies the drawn steps and edges.
3. List the checks you ran. For UI changes, name the view and the theme or
   panel size you tried, and include a screenshot when the layout changed.
4. Remove private skill contents from the description, fixtures, and logs.
   Reproduce issues with the smallest safe example. The issue templates ask for
   the same thing.
5. Do not publish to npm, the Marketplace, or Open VSX, and do not push release
   tags, from a contribution.

CI runs lint, type-check, tests, fixture validation, and a compile on Ubuntu
and Windows for Node 22 and 24. It builds the VSIX on Ubuntu with Node 22.

## Packaging notes

Users install a `.vsix` (`npm run package`, which runs `vscode:prepublish`).
`prepublishOnly` runs the same compile so a future `npm publish` would pack the
built extension as well. This repository does not publish on its own.

`package.json` `files` is the ship list for both the npm tarball and the VSIX.
`vsce` refuses to combine that list with a `.vscodeignore` file, so there is
no separate ignore file. The host source map stays out of the package. When
you change what ships, check both outputs:

```bash
npm run compile
npm pack --dry-run
npm run package
```
