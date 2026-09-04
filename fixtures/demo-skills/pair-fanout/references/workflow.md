# workflow.md — pair fan-out

```
P   ingest           scripts/ingest.py                     -> Bundle
N1  split            scripts/split.py                      -> Jobs
      N2a left         scripts/left.py                     -> Left
      N2b right        scripts/right.py                    -> Right
N3  merge            scripts/merge.py                      -> Combined
N4  pack             scripts/pack.py
```
