# Marketplace assets

Screenshots for the VS Code / Cursor marketplace listing (1280×720).

Regenerate after UI changes:

```bash
npm run compile:webview
npm run screenshots
```

| File | Preview |
| --- | --- |
| `procedure-analyse-ticket.png` | Flow view on the golden `analyse-ticket-pn` fixture |
| `catalog-analyse-ticket.png` | Catalog inventory for the same skill |
| `procedure-none-diagnosis.png` | Honest “none” diagnosis for prose-only skills |

These PNGs are included in the packaged `.vsix` so Open VSX / marketplace README
embeds resolve. Regenerate after UI changes; do not hand-edit the images.
