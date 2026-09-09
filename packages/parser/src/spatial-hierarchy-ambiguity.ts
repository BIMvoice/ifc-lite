/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * Detects elements whose direct storey containment is ambiguous in the
 * SOURCE FILE itself, i.e. more than one `IfcRelContainedInSpatialStructure`
 * edge names a *different* storey-like spatial structure as the RelatingStructure
 * for the same element (#4311).
 *
 * `elementToStorey` resolves each of these to a single winner (first-declared
 * wins, see spatial-hierarchy-builder.ts); this module answers the question
 * that resolution silently discards - was there more than one candidate at
 * all. It intentionally does NOT depend on how the tie-break itself is
 * decided (declaration order, reachability, or anything else): the input is
 * `byStorey`, the per-storey list of DIRECTLY contained elements that
 * `SpatialHierarchyBuilder.assemble()` already produces regardless of tie-break
 * strategy, so this stays correct across future changes to the resolution
 * logic without needing to change with it.
 *
 * Two edges that repeat the SAME (storey, element) pair are not ambiguous -
 * `RelationshipGraphBuilder` dedupes same-source/target/type `IfcRel*`
 * instances into one edge before either side of this ever sees them
 * (`relationship-graph.ts`), so a genuine duplicate declaration of the exact
 * same fact never reaches `byStorey` twice for the same storey. Only a
 * SECOND, DIFFERENT storey claiming the element counts.
 */

/** elementId -> storeyId, DIRECT storey containment only (one entry per
 *  storey; see `SpatialHierarchy.byStorey`). */
export type ByStorey = ReadonlyMap<number, readonly number[]>;

/**
 * Returns the set of element ids that appear under more than one distinct
 * storey in `byStorey`. O(total direct storey-element pairs); no extra graph
 * traversal beyond what `byStorey` already required to build.
 */
export function computeAmbiguousStorey(byStorey: ByStorey): Set<number> {
  const firstStorey = new Map<number, number>();
  const ambiguous = new Set<number>();
  for (const [storeyId, elementIds] of byStorey) {
    for (const elementId of elementIds) {
      const seen = firstStorey.get(elementId);
      if (seen === undefined) {
        firstStorey.set(elementId, storeyId);
      } else if (seen !== storeyId) {
        ambiguous.add(elementId);
      }
    }
  }
  return ambiguous;
}
