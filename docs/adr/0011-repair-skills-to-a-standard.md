# Fix prompts repair skills to a standard, with one plan and a verifier

Status: accepted, 2026-10-18. Extends ADR 0010.

Repairing one real skill took three rounds. The heading diagnosis said "no numbered list" while the
skill had two, under headings Flow does not read. The next diagnosis said only that some relationships
were unresolved. The prompt left the choice of repair open, so the model had to work out from
Graphtale's source how headings match and why conditional steps get no edges. The model that runs a fix
prompt is unknown and may be small, so the prompt cannot rely on that kind of exploration.

## Decision

Graphtale defines a [skill structure standard](../skill-standard.md), and the fix prompt repairs the
skill itself towards it, so an agent running the skill and Flow read the same order.

- The order lives in the skill: `## Workflow` in SKILL.md, or `references/workflow.md` linked from
  SKILL.md. Graphtale keeps no flow file of its own outside the skill. Such a file would leave skills
  unrepaired for the agents that run them.
- Diagnoses name their cause with source lines: the conditional word and its line, separate step lists,
  and numbered lists under headings Flow does not read as steps.
- The prompt states the reading rules, then one repair that Graphtale chooses from the skill's
  structure: rename one heading, write a prefilled `references/workflow.md` skeleton and its link line,
  or ask whether the skill has an order at all. Routers, references and modes are valid shapes, and the
  prompt says to change nothing when the user confirms there is no order.
- Ownership comes first: plugin copies and skills installed by the skills CLI are repaired at their
  source, a linked skill at its real path, and another copy with the same name is named.
- Every plan that edits a file ends with a verifier: record file hashes, allow only the planned changes,
  check the P/N format and ids, and trace every row and label to a source line. A second agent may run
  the checks independently.

Graphtale itself still never writes skill files (ADR 0002, 0003). Flow output is unchanged; only the
diagnosis text and the fix prompt change.

## Evidence

The diagnoses and plans were run against 45 installed skills to find the problem classes. Claude Haiku
then applied a prototype of this prompt to copies of seven of them: two-lane, two-list, numbered-heading,
Dutch and prose skills reached a high-confidence Flow, or correctly stayed unchanged, in one round. A
mixed skill with two modes failed until the prompt stated the id rules, and a Haiku verifier caught a
planted SKILL.md edit and a stray P line.

Rejected: reading only a step's first line for conditional words. Eight more skills reached high
confidence, but two of them gained an order their text does not state (a catalogue of scenarios, and
two alternative routes chained as one).

## Consequences

The prompt is longer, and its rules must match the parser. `src/skillStandard.test.ts` parses the
standard's examples and checks that the prompt and the standard list the same conditional words.
Skip words in a `#` title still hide a whole skill; that parser limitation is documented in the
standard and left for a separate change.
