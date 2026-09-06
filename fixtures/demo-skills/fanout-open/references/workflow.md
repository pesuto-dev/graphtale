# workflow.md — open fan-out

```
P   ingest           scripts/ingest.py                     -> Bundle
N1  split            scripts/split.py                      -> Jobs
      N2a alpha        scripts/alpha.py                    -> Alpha
      N2b bravo        scripts/bravo.py                    -> Bravo
      N2c charlie      scripts/charlie.py                  -> Charlie
```

## Connections

These arrows state the intended step relationships explicitly.

```text
P -> N1
N1 -> N2a
N1 -> N2b
N1 -> N2c
```
