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
