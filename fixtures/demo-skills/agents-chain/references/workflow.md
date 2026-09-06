# workflow.md — agents chain

```
P   intake           this loop                             -> Brief
N1  plan             this loop                             -> Plan
N3  draft            this loop                             -> Draft
N6  review           agent reviewer                        -> Notes
N7  ship             this loop
```

## Connections

These arrows state the intended step relationships explicitly.

```text
P -> N1
N1 -> N3
N3 -> N6
N6 -> N7
```
