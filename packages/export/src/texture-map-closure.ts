/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { asSourceBytes, type IfcSourceBytes } from '@ifc-lite/parser';
import { refGroupFromArg } from './reference-collector.js';
import { readEntityArgs, type EntityByteRangeIndex } from './subset-entity-reader.js';
import type { EffectiveEntityIndex } from './effective-index.js';

export const TEXTURE_MAP_TYPES = ['IFCINDEXEDTRIANGLETEXTUREMAP', 'IFCINDEXEDPOLYGONALTEXTUREMAP', 'IFCTEXTUREMAP'] as const;
const TARGET_TYPES = new Set(['IFCTRIANGULATEDFACESET', 'IFCPOLYGONALFACESET', 'IFCFACE']);

/** #4243: rescue by MappedTo geometry, never by a shared image or UV resource.
 * Effective reference groups replace overridden targets; refsOf intentionally
 * unions original and edited refs and would resurrect a hidden map after retargeting.
 */
export function textureMapTarget(
  source: Uint8Array | IfcSourceBytes,
  index: EntityByteRangeIndex & Pick<EffectiveEntityIndex, 'refGroupsOf'>,
  expressId: number,
): number | undefined {
  const sourceGroups = readEntityArgs({ source: asSourceBytes(source) }, index, expressId)?.args.map(refGroupFromArg);
  const groups = index.refGroupsOf?.(expressId, sourceGroups) ?? sourceGroups ?? [];
  // Maps/Vertices point only to texture resources; MappedTo is the unique
  // face/face-set reference. This also handles IFC2X3 IfcTextureMap's slot.
  for (const group of groups) {
    if (typeof group !== 'number') continue;
    const type = index.get(group)?.type?.toUpperCase();
    if (type && TARGET_TYPES.has(type)) return group;
  }
  return undefined;
}
