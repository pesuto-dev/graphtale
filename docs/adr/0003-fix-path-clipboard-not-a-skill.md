# Fix path is a clipboard prompt, not a bundled fix skill

The viewer slice helps authors spot an unreadable Flow and gives a copyable LLM prompt. Shipping a `/fix-skill` (or equivalent) is outside this product: that is skill-authoring tooling, not a second agent product inside the extension.

## Status

accepted

## Consequences

The UI may show a short reason plus “Copy prompt for chat”. The full prompt belongs on the clipboard, not as a wall of text in the banner. Do not ship a separate skill package as part of the vsix. Revisit later only if Fix path fails in practice without its own skill.
