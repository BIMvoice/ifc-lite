---
'@ifc-lite/parser': minor
'@ifc-lite/cli': minor
'@ifc-lite/mcp': minor
---

Add a semantic drop census to the TypeScript parser (#4208): every load now counts how many STEP records were scanned per class, how many entered the entity table, which classes the categoriser fell to `CAT_SKIP` for, which classes are unrecognised by the schema registry, and which `IFCREL*` classes were seen but never indexed as relationship-graph edges. The census is a pure, unit-testable computation (`buildDropCensus` in `@ifc-lite/parser`) built from counts collected during the existing single-pass categorisation, so it adds no extra scan of the file. It is always present on `store.dropCensus` after a parse — its absence, not a zero count, is what means the census did not run — and is now surfaced through `ifc-lite info` (table and `--json` output) and the MCP `model_audit` tool.

This instrument does not fix any of the drops it reveals; those are tracked as separate follow-up issues per #4208's scope.
