# workflow.md — pair fan-out

```
P   ingest           scripts/ingest.py                     -> Bundle
N1  split            scripts/split.py                      -> Jobs
      N2a left         scripts/left.py                     -> Left
      N2b right        scripts/right.py                    -> Right
N3  merge            scripts/merge.py                      -> Combined
N4  pack             scripts/pack.py
```

## Connections

These arrows state the intended step relationships explicitly.

```text
P -> N1
N1 -> N2a
N2a -> N3
N3 -> N4
N1 -> N2b
N2b -> N3
```
