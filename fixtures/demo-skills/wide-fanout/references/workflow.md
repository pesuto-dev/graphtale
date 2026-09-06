# workflow.md — wide fan-out

```
P   ingest           scripts/ingest.py                     -> Bundle
N1  split            scripts/split.py                      -> Jobs
      N2a alpha        scripts/alpha.py                    -> Alpha
      N2b bravo        scripts/bravo.py                    -> Bravo
      N2c charlie      scripts/charlie.py                  -> Charlie
      N2d delta        scripts/delta.py                    -> Delta
      N2e echo         scripts/echo.py                     -> Echo
N3  merge            scripts/merge.py                      -> Combined
N4  pack             scripts/pack.py
```

## Connections

These arrows state the intended step relationships explicitly.

```text
P -> N1
N1 -> N2a
N2a -> N3
N1 -> N2b
N2b -> N3
N1 -> N2c
N2c -> N3
N1 -> N2d
N2d -> N3
N1 -> N2e
N2e -> N3
N3 -> N4
```
