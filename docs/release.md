# Preview release checklist

The preview route is a GitHub Release VSIX first. Marketplace publication is a
separate decision after installation smoke testing; no publication command is
part of this repository's package script.

Before a release, run the checks in the contributor guide, inspect the VSIX
contents, and complete [the smoke test](smoke-test.md) in a clean profile. Use
the publisher and package identity declared in `package.json` (`pesuto` /
`graphtale`) and verify any destination account before publishing.

Record tested Cursor and VS Code versions, operating systems, known parser
limitations, and the exact VSIX attached to the release. Keep screenshots
current and readable; do not use private paths or claim extension-host checks
that were not run.
