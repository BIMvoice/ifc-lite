/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { calibrateAppearancePlane, type PlaneCalibrationRequest } from './plane-calibration.js';

test('actual WASM calibrates a rotated page once across object boundaries and raster DPI (#4260)', async t => {
  const artifact = new URL('../../../../../packages/wasm/pkg/ifc-lite_bg.wasm', import.meta.url);
  try { await access(artifact); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    t.skip('Run pnpm build:wasm for the actual plane calibration contract'); return;
  }
  const { default: init } = await import('@ifc-lite/wasm');
  await init({ module_or_path: await readFile(artifact) });
  const request: PlaneCalibrationRequest = {
    rasterToSource: [0, 0.5, 0.5, 0, 10, 20], rasterSize: [200, 400],
    sourcePoints: [[10, 20], [110, 20]], distanceMetres: 10,
    worldAnchor: [1000, 2000, 3], worldDirection: [1, 0, 0], planeNormal: [0, 0, 1],
  };
  const result = await calibrateAppearancePlane(request);
  assert.equal(result.mapping.frame, 'world');
  assert.deepEqual(result.rasterCorners, [[1000, 2000, 3], [1000, 2010, 3], [1020, 2010, 3], [1020, 2000, 3]]);
  const { origin, axisU, axisV, metresPerTile } = result.mapping;
  // Both adjacent objects evaluate the same world-space projector, with no
  // per-object bounds/normalization: their shared boundary must have the same UV.
  const uv = (point: [number, number, number]) => [axisU, axisV].map((axis, index) =>
    axis.reduce((sum, value, i) => sum + value * (point[i] - origin[i]), 0) / metresPerTile[index]);
  assert.deepEqual(uv([1010, 2005, 3]), [0.5, 0.5]);
  assert.deepEqual(uv([1000, 2000, 3]), [0, 1]);
  assert.deepEqual(uv([1020, 2010, 3]), [1, 0]);
  const higherDpi = await calibrateAppearancePlane({ ...request,
    rasterToSource: [0, 0.25, 0.25, 0, 10, 20], rasterSize: [400, 800] });
  assert.deepEqual(higherDpi, result);
  await assert.rejects(calibrateAppearancePlane({ ...request, distanceMetres: 0 }), /positive measured distance/);
  assert.deepEqual(await calibrateAppearancePlane(request), result, 'rejected calibration leaves later calls usable');
});
