# Local file and inventory limits

Parser inputs are capped at 256 KiB per document. A larger, missing, unreadable,
or binary SKILL.md is rejected by the host; refresh retains the last good graph
and shows Retry. Optional linked documents are read up to 256 KiB with a warning;
the resulting flow cannot receive high confidence after truncation.

Catalog text and inspector previews read at most 64 KiB per file. Binary files
are listed where discovered but their content is not previewed. Warnings include
file labels, never file contents. YAML diagnostics do not dump source excerpts.

Each recursive inventory visits at most 2,000 directory entries, descends eight
levels and collects at most 400 files. The combined Catalog is capped at 400
nodes, and Flow at 500 steps. Home/workspace discovery examines at most 2,000
entries per skill root and returns at most 400 skills. Limits produce warnings
in the viewer. Symlinks are not followed during recursive inventory.

These limits exceed the small committed release samples while bounding accidental
large inputs. They are guardrails, not a measured large-corpus performance claim.
Reads remain synchronous; async discovery/caching remains a follow-up.
