/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import type { StateCreator } from 'zustand';
import type { ViewerState } from '../index.js';
import type { AppearanceDraftRecipe, AppearanceSourceOption } from '@/lib/appearance/draft-types.js';
import { appearanceAssets } from '@/lib/appearance/model-assets.js';

export interface AppearanceSlice {
  /** Session source metadata only; original bytes and decoded images stay in the inventory. */
  appearanceSources: readonly AppearanceSourceOption[];
  appearanceDraft: AppearanceDraftRecipe | null;
  saveAppearanceDraft(draft: AppearanceDraftRecipe): void;
  addAppearanceSource(source: AppearanceSourceOption): void;
  removeAppearanceSource(id: string): void;
}
export const createAppearanceSlice: StateCreator<ViewerState, [], [], AppearanceSlice> = (set, get) => ({
  appearanceSources: [],
  appearanceDraft: null,
  saveAppearanceDraft(draft) {
    set({ appearanceDraft: { ...draft, scope: { ...draft.scope }, settings: { ...draft.settings } } });
  },
  addAppearanceSource(source) {
    if (get().appearanceSources.some(item => item.id === source.id)) {
      if (source.thumbnailUrl) URL.revokeObjectURL(source.thumbnailUrl);
      return;
    }
    set(state => ({ appearanceSources: [...state.appearanceSources, source] }));
  },
  removeAppearanceSource(id) {
    const source = get().appearanceSources.find(item => item.id === id);
    if (source?.thumbnailUrl) URL.revokeObjectURL(source.thumbnailUrl);
    appearanceAssets.releaseOwner({ kind: 'source', id: `appearance:${id}` });
    set(state => ({ appearanceSources: state.appearanceSources.filter(item => item.id !== id) }));
  },
});
