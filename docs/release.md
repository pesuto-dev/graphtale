# Preview release checklist

The release workflow runs on a `v*` tag. In parallel it checks that `OVSX_PAT`
is set and that the tag matches `package.json`, and runs the full CI workflow
(lint, type-check, tests, fixture validation and compile on Ubuntu and Windows
for Node 22 and 24). Only when both pass does the publish job publish the VSIX
that CI built: to Open VSX, to the Visual Studio Marketplace when the `VSCE_PAT`
repository secret is set, and to the GitHub Release. A missing `VSCE_PAT` or a
Marketplace error does not block Open VSX or the GitHub Release. The publish job
installs the locked `ovsx` and `vsce` with `npm ci --ignore-scripts`; nothing is
fetched with `npx` at publish time. `npm run package` does not publish.

For a dry run, start **Release** by hand (Actions, **Run workflow**). It checks
`OVSX_PAT`, runs CI, and runs the publish job up to the point of publishing: it
downloads the tested VSIX, installs the locked tools and prints their versions.
It skips the tag check and the three publish steps, so it does not prove the
tokens are valid. Do this before the first tag after a workflow change: an Open
VSX version cannot be published twice.

Before a release, run the checks in the contributor guide, inspect the VSIX
contents, and complete [the smoke test](smoke-test.md) in a clean profile. Use
the publisher and package identity declared in `package.json` (`pesuto` /
`graphtale`) and verify any destination account before publishing.

Record tested Cursor and VS Code versions, operating systems, known parser
limitations, and the exact VSIX attached to the release. Keep screenshots
current and readable; do not use private paths or claim extension-host checks
that were not run.
