# Appearance workspace integration

Implementation slice for ready issue #4243, under development. This connects the
controlled Appearance dock to the existing model, renderer, history and export
services; it is not full-feature release acceptance.

## Workflow

Open **Author → Appearance**, the activity rail, or the Appearance command in the
command palette. Choose a target model, upload a PNG/JPEG, and select the model,
selected objects, exact IFC class or exact type. Types with identical names remain
separate by their entity identity. Federation selections resolve through the
store, including the zero-offset single-model case.

Existing UVs retain the source layout. Planar and box projection use physical
metres in the IFC world frame. Alignment controls set rotation and offsets;
invalid numeric input disables Apply rather than submitting an earlier value.
Changes regenerate a cancellable preview. Compare restores the original GPU
appearance; Discard cancels pending work and restores the committed model.

Closing the panel releases its worker and draft GPU resources while retaining the
logical source/scope/mapping settings. Reopening regenerates the same draft;
a discarded draft stays inactive. Missing sources or models do not silently
resume a different draft. Upload ownership survives duplicate uploads and
publication failures without leaking provisional object URLs or image leases.

Apply uses the existing compound appearance command and Undo/Redo stack. Normal
IFC export uses the compact effective snapshot and packages retained images as
IFCZIP. The export dialog reports **IFC + images** when resources are present.
Appearance editing in an active room remains unavailable until collaborative
compound authoring is supported; users can share a completed model for viewing.

## Evidence and remaining acceptance

The real WebGPU viewer has exercised the initially untextured IFCOpenShell wall
and public Convento model through preview, Apply, Undo/Redo, normal IFCZIP
export/reopen and selection. Convento model-wide application covers 20 owners and
115 geometry parts; a second federated model retains its original geometry and
appearance. See the [recorded preview](evidence/appearance/convento-entire-model-planar-preview.png).

Mounted tests cover cancellation during debounce/worker work, stale revisions,
source ownership failures, duplicate uploads, draft restoration and toolbar entry
points. Scope tests cover federation, exact type identity and deleted owners.

The current source-metadata class/type catalog does not yet incorporate SDK
retypes or edited type relationships. A Rust catalog over the effective IFC
snapshot must replace that path before this slice is ready. Apply also still has
a measured main-thread stall; independent transaction/dependency optimizations
and cooperative preparation must pass interaction qualification. Fresh room
viewing preserves appearance, but the offered IFCX export/reopen loses textures
and is tracked separately in #4325. These gaps prevent declaring F1 complete.
