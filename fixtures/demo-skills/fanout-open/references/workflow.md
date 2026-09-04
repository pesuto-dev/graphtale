# workflow.md — open fan-out

```
P   ingest           scripts/ingest.py                     -> Bundle
N1  split            scripts/split.py                      -> Jobs
      N2a alpha        scripts/alpha.py                    -> Alpha
      N2b bravo        scripts/bravo.py                    -> Bravo
      N2c charlie      scripts/charlie.py                  -> Charlie
```
