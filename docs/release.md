# Preview release checklist

The release workflow builds the VSIX, publishes it to Open VSX, publishes that
same VSIX to the Visual Studio Marketplace when the `VSCE_PAT` repository
secret is set, and attaches it to the GitHub Release. A missing `VSCE_PAT` or
a Marketplace error does not block Open VSX or the GitHub Release. `npm run
package` does not publish.

Before a release, run the checks in the contributor guide, inspect the VSIX
contents, and complete [the smoke test](smoke-test.md) in a clean profile. Use
the publisher and package identity declared in `package.json` (`pesuto` /
`graphtale`) and verify any destination account before publishing.

Record tested Cursor and VS Code versions, operating systems, known parser
limitations, and the exact VSIX attached to the release. Keep screenshots
current and readable; do not use private paths or claim extension-host checks
that were not run.
