/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { RelationshipType } from '@ifc-lite/data';
import type { ViewerState } from '@/store';
import type { AppearanceScope } from '@/components/viewer/appearance/types.js';

/** Resolve rendered owners through the store, including overlay-created products. */
export function appearanceScope(state: ViewerState, modelId: string, scope: AppearanceScope) {
  const model = state.models.get(modelId);
  const store = model?.ifcDataStore;
  const products = new Set<number>();
  // Instanced owners may have no flat mesh at all. Include them so the planner
  // reports eligibility instead of silently narrowing a model-wide scope.
  for (const globalId of model?.geometryResult?.instancedGeometryAabbs?.keys() ?? []) {
    const ref = state.resolveGlobalIdFromModels(globalId);
    if (ref?.modelId === modelId) products.add(ref.expressId);
  }
  for (const globalId of model?.geometryResult?.instancedGeometryHashes?.keys() ?? []) {
    const ref = state.resolveGlobalIdFromModels(globalId);
    if (ref?.modelId === modelId) products.add(ref.expressId);
  }
  for (const mesh of model?.geometryResult?.meshes ?? []) {
    const ids = mesh.entityIds ? new Set(mesh.entityIds) : [mesh.expressId];
    for (const globalId of ids) {
      const ref = state.resolveGlobalIdFromModels(globalId);
      if (ref?.modelId === modelId) products.add(ref.expressId);
    }
  }
  const selected = new Set<number>();
  const selection = new Set(state.selectedEntityIds);
  if (state.selectedEntityId !== null) selection.add(state.selectedEntityId);
  for (const globalId of selection) {
    const ref = state.resolveGlobalIdFromModels(globalId);
    if (ref?.modelId === modelId && products.has(ref.expressId)) selected.add(ref.expressId);
  }
  const classes = new Set<string>();
  const types = new Map<number, string>();
  const productTypes = new Map<number, readonly number[]>();
  for (const id of products) {
    if (!store) break;
    classes.add(store.entities.getTypeName(id));
    const ids = Array.from(store.relationships.getRelated(id, RelationshipType.DefinesByType, 'inverse'));
    productTypes.set(id, ids);
    for (const typeId of ids) types.set(typeId, store.entities.getName(typeId) || `${store.entities.getTypeName(typeId)} #${typeId}`);
  }
  const productIds = [...products].filter(id => {
    if (state.mutationViews.get(modelId)?.isDeleted(id)) return false;
    switch (scope.kind) {
      case 'model': return true;
      case 'selection': return selected.has(id);
      case 'class': return store?.entities.getTypeName(id) === scope.ifcClass;
      case 'type': return productTypes.get(id)?.includes(scope.typeId) ?? false;
    }
  }).sort((a, b) => a - b);
  return {
    productIds, selectionCount: selected.size,
    classes: [...classes].sort().map(value => ({ value, label: value })),
    types: [...types].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id),
  };
}
