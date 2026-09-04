# workflow.md — synthetic P/N graph

```
P   ingest           scripts/ingest.py                     -> Bundle
N1  split            scripts/split.py                      -> Jobs
      N2a left         scripts/left.py                     -> Left
      N2b worker       agent worker                        -> Notes
      N2c right        scripts/right.py                    -> Right
N3  classify         this loop, references/classify.md     -> Label
N4  inspect          agent inspector                       -> Report
N4v verify           scripts/verify.py                     -> Checked
N5  compose          this loop                             -> Draft
      schemas/analysis.schema.json is the shape; references/output-template.md says what each slot means.
N5v review           agent reviewer                        -> Verdict
N6  check            scripts/check.py
N7  render + N8 write  scripts/write_report.py
```

## P — ingest

Load the bundle with `scripts/ingest.py`.

## N1 — split

Split work with `scripts/split.py`.

## N5 — compose

Build the draft. `schemas/analysis.schema.json` is the shape;
`references/output-template.md` says what each slot means.
