---
"@ifc-lite/query": minor
"@ifc-lite/sdk": minor
"@ifc-lite/cli": minor
"@ifc-lite/mcp": minor
---

Added `matches` (regex) to the shared property/quantity comparison operator (#4094, follow-up to #4091). This is one of the three prerequisites #4094 names for honouring `/regex/` selector text end to end (GlobalId and `+` group support remain open); it now works everywhere `compareFilterValue` already backs `bim.query().where(...)` -- the CLI `HeadlessBackend`, the MCP backend, and the viewer's SDK adapter -- with no further plumbing, since all three already delegated to it.

`expected` is a bare regex source with no `/.../ ` delimiters (the same shape `parseSelector`'s regex literal already carries), tested against `String(actual)`. It is case-sensitive and does not boolean-normalize its operands (unlike every other operator here), and an invalid pattern returns `false` rather than throwing, the same way a non-numeric `expected` against `>`/`<` already does.

Reachable from:
- `bim.query().where(pset, prop, 'matches', pattern)` (SDK, and every backend built on it).
- The MCP `query_entities` tool's `property.op`.
- `ifc-lite query --where "Pset.Prop~=pattern"` and `ifc-lite export --where "Pset.Prop~=pattern"` (new `~=` token; plain `~` still means `contains`).

Not included here: `ifc-lite mutate --where` has its own separate, non-delegating comparator (`matchesFilter` in `mutate.ts`) and was left untouched; the CLI `--select`/selector flag, the MCP `selector` parameter, `bim.query().select()`, and the viewer's remaining unsupported selector constructs (`parent=`, `query:`, `+` group unions, material `Category`, GlobalId as a comparison, quantity rows through a property term) are all still open, tracked on #4094.
