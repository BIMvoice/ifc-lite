/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { MeshData } from '@ifc-lite/geometry';
import {
  expandAppearanceCorners,
  equivalentAppearanceGeometry,
} from './appearance-uvs.js';
import { splitMeshForStreaming } from './scene-stream-split.js';
function sourceMesh(): MeshData {
  const indices = new Uint32Array([2, 0, 1, 3, 2, 1, 2, 3, 0]);
  return {
    expressId: 7,
    geometryItemId: 14,
    color: [1, 1, 1, 1],
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0]),
    normals: new Float32Array(12),
    indices,
    appearanceSource: {
      kind: 'canonical-item',
      indices,
      sourceIndices: indices,
    },
  };
}
describe('canonical appearance corner provenance (#4243)', () => {
  it('composes repeated fragments and expands welded vertices without losing UV seams', () => {
    const mesh = sourceMesh(),
      uvs = Array.from({ length: 18 }, (_, index) => index / 4);
    const fragments = splitMeshForStreaming(mesh, 6, 4096).flatMap((piece) =>
      splitMeshForStreaming(piece, 3, 4096),
    );
    let corner = 0;
    for (const fragment of fragments) {
      const expanded = expandAppearanceCorners(
        fragment,
        mesh.indices,
        uvs,
        mesh.indices,
      );
      assert.ok(equivalentAppearanceGeometry(fragment, expanded));
      assert.ok(
        equivalentAppearanceGeometry(expanded, fragment),
        'compressed undo remains equivalent',
      );
      for (const index of expanded.indices) {
        assert.deepEqual(
          [...expanded.uvs!.slice(index * 2, index * 2 + 2)],
          uvs.slice(corner * 2, corner * 2 + 2),
        );
        corner++;
      }
    }
    assert.equal(corner, mesh.indices.length);
    const expanded = expandAppearanceCorners(
      mesh,
      mesh.indices,
      uvs,
      mesh.indices,
    );
    assert.equal(
      expanded.positions.length / 3,
      9,
      'four welded vertices become nine independent corners',
    );
    expanded.positions[0] += 1;
    assert.equal(
      equivalentAppearanceGeometry(mesh, expanded),
      false,
      'a real geometry move must fail',
    );
  });
  it('carries target weld provenance into the next Apply and restores the old provenance on undo', () => {
    const mesh = sourceMesh(),
      target = Uint32Array.from({ length: 9 }, (_, index) => index);
    const first = expandAppearanceCorners(
      mesh,
      mesh.indices,
      new Float32Array(18),
      target,
    );
    assert.strictEqual(first.appearanceSource!.sourceIndices, target);
    const second = expandAppearanceCorners(
      first,
      target,
      new Float32Array(18).fill(0.25),
      mesh.indices,
    );
    assert.ok(equivalentAppearanceGeometry(first, second));
    assert.ok(equivalentAppearanceGeometry(second, mesh));
    assert.strictEqual(second.appearanceSource!.sourceIndices, mesh.indices);
    assert.throws(
      () =>
        expandAppearanceCorners(
          first,
          mesh.indices,
          new Float32Array(18),
          target,
        ),
      /topology changed/,
    );
  });
  it('rejects equal-size rebuilt topology, even after another streaming split', () => {
    const mesh = sourceMesh(),
      changed = { ...mesh, indices: mesh.indices.slice() };
    assert.throws(
      () =>
        expandAppearanceCorners(
          changed,
          mesh.indices,
          new Float32Array(18),
          mesh.indices,
        ),
      /provenance/,
    );
    for (const piece of splitMeshForStreaming(changed, 3, 4096)) {
      assert.throws(
        () =>
          expandAppearanceCorners(
            piece,
            mesh.indices,
            new Float32Array(18),
            mesh.indices,
          ),
        /provenance/,
      );
    }
    const altered = mesh.indices.slice();
    altered[0] = 1;
    assert.throws(
      () =>
        expandAppearanceCorners(
          mesh,
          altered,
          new Float32Array(18),
          mesh.indices,
        ),
      /topology changed/,
    );
  });
  it('survives worker clone, checks corner bounds and rejects non-finite UVs', () => {
    const mesh = structuredClone(sourceMesh());
    assert.strictEqual(mesh.appearanceSource!.indices, mesh.indices);
    assert.strictEqual(mesh.appearanceSource!.sourceIndices, mesh.indices);
    assert.equal(
      expandAppearanceCorners(
        mesh,
        mesh.indices,
        new Float32Array(18),
        mesh.indices,
      ).uvs!.length,
      18,
    );
    assert.throws(
      () =>
        expandAppearanceCorners(
          mesh,
          mesh.indices,
          new Float32Array(6),
          mesh.indices,
        ),
      /provenance/,
    );
    assert.throws(
      () =>
        expandAppearanceCorners(
          mesh,
          mesh.indices,
          new Float32Array(18).fill(Infinity),
          mesh.indices,
        ),
      /finite/,
    );
    mesh.appearanceSource!.cornerIndices = new Uint32Array(9).fill(99);
    assert.throws(
      () =>
        expandAppearanceCorners(
          mesh,
          mesh.indices,
          new Float32Array(18),
          mesh.indices,
        ),
      /out of range/,
    );
  });
});
