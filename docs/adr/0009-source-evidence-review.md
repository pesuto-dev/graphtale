# Visual review follows source evidence

Status: accepted for public preview, 2026-09-06.

Graphtale reviews supported instruction structure and file inventory. Earlier
ADRs using “runtime” describe intended order, never observed execution. A parser
limitation does not imply a bad skill. Source path and line ranges belong to the
instruction; any referenced script, agent or document remains a separate target.

Branches require explicit arrow evidence. Ticket names, role order, indentation,
and P/N identifiers cannot create branches. Unsupported relationships remain
partial. The optional clarification prompt is secondary to inspecting the source
and Catalog. This supersedes execution-sounding wording in ADRs 0002–0006.
