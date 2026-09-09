/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import init, { IfcAPI } from '@ifc-lite/wasm';
import type { AppearancePlan, AppearanceRequest, AppearanceWorkerRequest, AppearanceWorkerResponse } from '../lib/appearance/planner-types.js';

/** Canonical Rust does graph eligibility, projection and IFC authoring. Exported
 * within the viewer for real-WASM contract tests; production calls only in this
 * worker. One job per worker bounds retained WebAssembly.Memory to that job. */
export async function runAppearancePlanning(source: Uint8Array, request: AppearanceRequest): Promise<AppearancePlan> {
  await init();
  const api = new IfcAPI();
  try {
    const bytes = api.planAppearance(source, JSON.stringify(request));
    return JSON.parse(new TextDecoder().decode(bytes)) as AppearancePlan;
  } finally {
    api.free();
  }
}

const isWorkerScope = typeof self !== 'undefined' &&
  typeof (globalThis as { window?: unknown }).window === 'undefined' &&
  typeof (self as unknown as Worker).postMessage === 'function';
if (isWorkerScope) {
  self.onmessage = async (event: MessageEvent<AppearanceWorkerRequest>) => {
    const job = event.data;
    if (!job || job.type !== 'plan') return;
    try {
      const plan = await runAppearancePlanning(job.source, job.request);
      (self as unknown as Worker).postMessage({ type: 'complete', id: job.id, plan } satisfies AppearanceWorkerResponse);
    } catch (error) {
      (self as unknown as Worker).postMessage({ type: 'error', id: job.id,
        message: error instanceof Error ? error.message : String(error) } satisfies AppearanceWorkerResponse);
    }
  };
}
