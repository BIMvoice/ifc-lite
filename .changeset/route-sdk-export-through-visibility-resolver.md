---
"@ifc-lite/viewer": patch
---

Fix `sdk.export.ifc()` (the scripting console, extension host, and BroadcastChannel bridge) still exporting the whole model when the hierarchy panel's Class tab filter is active and the caller passes the full entity set with `visibleOnly: true` — the same #4328 bug the dialog export paths were fixed for, reproduced on the SDK surface because its own filter resolver only read `hiddenEntitiesByModel`/`isolatedEntitiesByModel` and never `classFilter`, `selectedStoreys`, or `typeVisibility`. It now routes through the same `resolveExportVisibility()` resolver as ExportDialog/GLBExportDialog whenever the caller's refs cover the whole model; an explicit subset of refs is unaffected and still exports exactly what was named, regardless of visibility state.
