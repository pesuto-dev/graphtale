# Contributing to Graphtale

Graphtale is a read-only viewer for Agent Skills. Contributions should improve
source-grounded Flow or Catalog review. Skill editing, execution tracing,
installers, backend services, and LLM features are outside the current scope.

## Setup

Use Node.js 22 and install dependencies from a clean checkout:

```bash
npm install
```

Before opening a pull request, run `npm run check`, `npm test`, `npm run
validate`, and `npm run package`. `npm run package` invokes the single
`vscode:prepublish` build and creates a local `.vsix`; it does not publish it.
For UI work, `npm run preview` provides a browser preview. Extension-host
behavior still needs a local Cursor or VS Code run.

## Fixtures and parser changes

Fixtures are intentionally small and self-contained under `fixtures/`; hidden
skill directories may require `ls -a` or `find` when inspecting them. Keep
fixture skill files unchanged during parsing. Add a focused regression when a
parser change affects supported structure, source attribution, relationships,
or diagnosis. Use explicit arrows for branches and avoid relying on names,
roles, indentation, or displayed numbering to imply runtime relationships.

Document new syntax and known limits in [docs/parser-coverage.md](docs/parser-coverage.md).
Keep examples synthetic or include attribution and reuse terms.

## Pull requests

Describe the source evidence for a changed Flow and include the checks you ran.
For UI changes, include the affected view and theme or panel-size conditions.
Please remove private skill contents from reports and reproduce issues with the
smallest safe example.
