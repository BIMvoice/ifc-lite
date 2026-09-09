---
'@ifc-lite/parser': minor
'@ifc-lite/cli': minor
'@ifc-lite/mcp': minor
---

Add a semantic drop census to the TypeScript parser (#4208): every load now counts how many STEP records were scanned per class, how many entered the entity table, which classes the categoriser fell to `CAT_SKIP` for, which classes are unrecognised by the schema registry, and which `IFCREL*` classes were seen but never indexed as relationship-graph edges. The census is a pure, unit-testable computation (`buildDropCensus` in `@ifc-lite/parser`) built from counts collected during the existing single-pass categorisation, so it adds no extra scan of the file. It is always present on `store.dropCensus` after a parse — its absence, not a zero count, is what means the census did not run — and is now surfaced through `ifc-lite info` (table and `--json` output) and the MCP `model_audit` tool.

Skipped classes are split into `expectedSkippedClasses` and `unexpectedSkippedClasses`, keyed on whether the class's EXPRESS inheritance chain includes `IfcRoot` (i.e. whether it carries a `GlobalId`). Geometry, placement, and style resource records (`IfcCartesianPoint`, `IfcAxis2Placement3D`, `IfcIndexedPolygonalFace`, …) have no `GlobalId`, are never `IfcRoot` descendants, and fall to `CAT_SKIP` on essentially every real IFC file — tessellated geometry alone can be the majority of a file's records. Reporting that at `model_audit`'s `warning` severity unconditionally, as the first cut of this census did, fires on every file and trains people to ignore the warning; `ifc-lite info`'s "In schema: yes" column gave no cue either, since these are all schema-known classes. `unexpectedSkippedClasses` (an `IfcRoot` descendant — something with its own identity — that still fell to `CAT_SKIP`) stays a `warning`; `expectedSkippedClasses` is now `info`. The split is derived from the schema's own inheritance chain, not a hand-maintained allowlist of class names, so it cannot drift as the schema grows and cannot silently reclassify a class that should have stayed loud.

This instrument does not fix any of the drops it reveals; those are tracked as separate follow-up issues per #4208's scope.
