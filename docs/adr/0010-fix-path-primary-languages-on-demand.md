# Fix path is the primary banner action; other languages are opt-in

Status: accepted, 2026-10-18. Supersedes the "secondary" sentence in ADR 0009.

Authors who hit a partial or missing Flow did not see how to repair it: the prompt
sat behind a collapsed "Optional" control, did not name the file, and did not say
that a plugin install is a copy. The banner now leads with **Copy fix prompt**,
explains in one line what happens next, and offers **Open SKILL.md** next to
Catalog. Flow refreshes on its own shortly after a watched file changes.

The prompt names the skill file. When that file sits in the Claude Code plugin cache,
the prompt says edits there are lost on update and points to the plugin's source
repository. It asks the AI tool to show a diff and wait for approval. Graphtale itself
still never writes skill files (ADR 0002, 0003).

English section headings are the default vocabulary. Graphtale does not ship other
languages. When a skill uses another language, the prompt lets the user choose:
repair the skill with English structure (default), or register that language's step
and skip headings in `~/.graphtale/languages.json`. A registered language applies to
every skill on that machine. Anything a repair adds is English; existing text may
stay in its own language.

A SKILL.md that routes to separate local files from a table or bullet list (a router
skill) is shown as unordered branches with partial confidence instead of no Flow.
This detection reads structure and paths, not words, so it works in any language.

## Consequences

The clipboard stays the only hand-off; there is no bundled fix skill. A broken
`languages.json` falls back to English with a Flow warning. The languages file is
polled, because it lives outside the workspace and may not exist yet.
