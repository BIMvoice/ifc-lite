/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * `infoCommand`'s table output renders `unexpectedSkippedClasses`,
 * `expectedSkippedClasses`, and `unindexedRelClasses` from the drop census
 * (#4208) but never rendered `unknownClasses` — even though it is present
 * in the `--json` payload. Vendor extensions and schema-registry misses are
 * a genuinely loud signal (independently flagged by CodeRabbit); a human
 * running `ifc-lite info` without `--json` never saw them. This test pins
 * that the human-readable table now surfaces `unknownClasses` too.
 */

import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { infoCommand } from './info.js';

// A minimal STEP file with one recognised entity (IFCWALLSTANDARDCASE) and
// one keyword the bundled schema registry does not recognise at all
// (IFCNOTAREALIFCTYPE), mirroring the "flags a keyword the schema registry
// does not recognise" fixture in @ifc-lite/parser's drop-census.test.ts.
const IFC_WITH_UNKNOWN_CLASS = `ISO-10303-21;
HEADER;
FILE_DESCRIPTION((''),'2;1');
FILE_NAME('','',(''),(''),'','','');
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;
#1=IFCOWNERHISTORY($,$,$,$,$,$,$,0);
#2=IFCNOTAREALIFCTYPE('bogus');
#10=IFCWALLSTANDARDCASE('wall-guid',#1,'Wall A',$,$,$,$,$);
ENDSEC;
END-ISO-10303-21;
`;

describe('infoCommand table output', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    stdoutSpy?.mockRestore();
  });

  it('renders unknownClasses alongside the other drop-census tables', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ifc-info-unknown-'));
    const file = join(dir, 'unknown-class.ifc');
    await writeFile(file, IFC_WITH_UNKNOWN_CLASS);

    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await infoCommand([file]);
    const out = stdoutSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('');

    expect(out).toContain('unknown');
    expect(out).toContain('IFCNOTAREALIFCTYPE');
  });

  it('keeps unknownClasses in the --json payload (unchanged)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ifc-info-unknown-json-'));
    const file = join(dir, 'unknown-class.ifc');
    await writeFile(file, IFC_WITH_UNKNOWN_CLASS);

    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await infoCommand([file, '--json']);
    const out = stdoutSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('');
    const summary = JSON.parse(out) as { dropCensus: { unknownClasses: Array<{ type: string }> } };

    expect(summary.dropCensus.unknownClasses.some(c => c.type === 'IFCNOTAREALIFCTYPE')).toBe(true);
  });
});
