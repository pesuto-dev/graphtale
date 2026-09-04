# Vision PoC (Cursor Canvas)

Interaction and intended-flow reference for Graphtale, not part of the shipped
extension. **Skills are never rewritten**; the product is a viewer.

## Files

| File | Role |
| --- | --- |
| [skill-flow-vision.canvas.tsx](skill-flow-vision.canvas.tsx) | Parked UX stub; live graphs are fixtures/demo-skills/ |
| [analyse-ticket-target-flow.md](analyse-ticket-target-flow.md) | Intended-flow principles: entry → steps → support/handoff |

To open a live Cursor Canvas beside chat, copy `.canvas.tsx` files into:

`~/.cursor/projects/<workspace>/canvases/`

## Shipped behaviour

The extension shows **Flow** (runtime order with hybrid confidence; first tab)
and **Catalog** (file inventory). Flow enrichment is in-memory only. Flow
editing stays parked.
