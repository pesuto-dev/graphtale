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
