# workflow.md — long P/N chain

```
P   ingest           scripts/ingest.py                     -> Bundle
N1  parse            scripts/parse.py                      -> Parsed
N3  normalize        scripts/normalize.py                  -> Clean
N6  enrich           scripts/enrich.py                     -> Rich
N7  score            scripts/score.py                      -> Scored
N8  pack             scripts/pack.py                       -> Packed
N9  ship             scripts/ship.py                       -> Shipped
N10 done             scripts/done.py
```

## Connections

These arrows state the intended step relationships explicitly.

```text
P -> N1
N1 -> N3
N3 -> N6
N6 -> N7
N7 -> N8
N8 -> N9
N9 -> N10
```
