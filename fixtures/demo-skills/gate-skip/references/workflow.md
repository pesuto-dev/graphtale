# workflow.md — gate skip

```
P   preflight        scripts/context.py                    -> RepoContext
N1  resolve          scripts/resolve.py                    -> Bundle
N3  classify         this loop                             -> Classification
N4  inspect          agent inspector                       -> Report
N5  answer           this loop                             -> Draft
N6  check            scripts/check.py                      -> Checked
N7  close            scripts/close.py
```

## Connections

These arrows state the intended step relationships explicitly.

```text
P -> N1
N1 -> N3
N4 -> N5
N5 -> N6
N6 -> N7
N3 -> N4 (Bug | Change)
N3 -> N5 (Question)
```
