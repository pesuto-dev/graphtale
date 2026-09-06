# workflow.md — gate and fan-out

```
P   ingest           scripts/ingest.py                     -> Bundle
N1  split            scripts/split.py                      -> Jobs
      N2a left         scripts/left.py                     -> Left
      N2b right        scripts/right.py                    -> Right
N3  classify         this loop                             -> Classification
N4  inspect          agent inspector                       -> Report
N5  answer           this loop                             -> Draft
N6  check            scripts/check.py
N7  close            scripts/close.py
```

## Connections

These arrows state the intended step relationships explicitly.

```text
P -> N1
N1 -> N2a
N2a -> N3
N1 -> N2b
N2b -> N3
N4 -> N5
N5 -> N6
N6 -> N7
N3 -> N4 (Bug | Change)
N3 -> N5 (Question)
```
