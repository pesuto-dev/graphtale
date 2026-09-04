# Graphtale

Domain language for Graphtale (package `graphtale`): a read-only window on
Agent Skills so authors can see and trust what a skill contains and how it
runs, and so the Flow view inspires them to rethink that runtime.

Product UI strings are **English**.

## Language

**Catalog**:
The inventory of files and references that belong to a skill (links, `references/`, `scripts/`, dispatched agents, handoffs), without runtime order. Shown as a **grouped list** (not a flow canvas). Use it to open the right asset; use **Flow** to see how those assets run. Second tab.
_Avoid_: Skill graph (as synonym for Flow), dependency map, asset list, treating Catalog as a second Flow, Related-skills attach chrome in the viewer slice

**Flow**:
The ordered runtime steps of a skill (sequence, parallel, forks, gates), derived or explicit, with varying confidence. First tab; the view shown when a skill opens. Optional **Compact** packs the same DAG into LR wrap-rows: entry strip (SKILL → flow source), then runtime rows of ~4 (parallel siblings stacked). In-flow support siblings stay visible; dangling satellites are hidden. No invented edges.
_Avoid_: Procedure (old UI name), Ticket pipeline (except as a legacy label), workflow graph (outside the skill), treating Flow as the flow editor

**Diagnosis**:
A judgement of how trustworthy the Flow is (or whether it is missing), plus what is wrong, not the Flow itself.
_Avoid_: Validation (YAML-only), error toast, quality score (too vague alone)

**Fix path**:
A viewer action that improves Flow readability. In this slice: a short
banner that says *when* a prompt is needed, plus a clipboard LLM prompt
(not dumped on the canvas). No bundled repair skill as part of this product.
_Avoid_: Flow editor, auto-normalize, silent rewrite, fix-skill (inside this extension)

**Inspiration**:
The Flow view’s job beyond accuracy: a visually compelling layout that makes authors pause and rethink how the skill actually runs. First-class product goal. This slice: light visual refresh; deeper visual work after Flow is functionally correct.
_Avoid_: Decoration, decoration for its own sake, fake steps invented for spectacle, “polish later = optional forever”

**Release**:
Open-source Apache-2.0 under Pesuto (like demotale). Product name is **Graphtale**. Marketplace listing (`Graphtale - Agent Skill Flow`) must keep the intended-flow job; no editor or installer claim.
_Avoid_: Marketplace fit as synonym for Flow quality; Garansys as publisher

**Viewer slice**:
Current product phase: read-only correct Catalog + Flow (+ Diagnosis / Fix path); no writing edges or skill files to disk.
_Avoid_: Flow-editor phase, mutating installed skills
