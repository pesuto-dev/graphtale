# workflow.md — pair support

```
P   ingest           scripts/ingest.py                     -> Bundle
N1  gather           scripts/gather.py                     -> Notes
N5  compose          this loop                             -> Draft
      schemas/report.schema.json is the shape.
N5v review           agent report-reviewer                 -> Verdict
N6  check            scripts/check.py
N7  write            scripts/write_report.py
```

## P — ingest

Load the bundle with `scripts/ingest.py`.

## N1 — gather

Collect notes with `scripts/gather.py`.

## N5 — compose

Build the draft. `schemas/report.schema.json` is the shape.

## N5v — review

Refute or confirm via `agent report-reviewer`.

## Connections

These arrows state the intended step relationships explicitly.

```text
P -> N1
N1 -> N5
N5 -> N5v
N5v -> N6
N6 -> N7
```
