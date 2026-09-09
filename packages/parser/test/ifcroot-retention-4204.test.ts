/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { describe, it, expect } from 'vitest';
import { StepTokenizer } from '../src/tokenizer.js';
import { ColumnarParser } from '../src/columnar-parser.js';
import { getInheritanceChain } from '../src/ifc-schema.js';

// Issue #4204 — `columnar-entity-preparation.ts`'s `getCategory()` retained
// only IfcProduct subtypes, IfcGroup subtypes, and anything named "IfcRel*"
// (plus a 22-name helper list for non-rooted resource entities the internal
// machinery needs). Every other IfcRoot descendant — IfcTask, IfcActor,
// IfcCostItem, IfcResource, IfcStructural*, IfcProjectLibrary,
// IfcPropertySetTemplate, … — fell to CAT_SKIP and never entered the
// EntityTable: `getGlobalId`/`getTypeName` answered '' / 'Unknown' for them
// even though the scanner's byId/byType index still saw the record.
//
// The fix replaces the IFCPRODUCT-root + IFCREL-prefix test with a single
// schema-derived rule: is this type a subtype of IFCROOT at all. This locks
// in both halves: the schema fact (inheritance reaches IfcRoot) and the
// parser's behavioural consequence (the entity is retained and addressable).

describe('#4204 — every IfcRoot descendant inherits from IfcRoot per the schema', () => {
  it.each([
    'IfcTask', 'IfcActor', 'IfcCostItem', 'IfcResource', 'IfcStructuralItem',
    'IfcProjectLibrary', 'IfcPropertySetTemplate',
  ])('%s inherits from IfcRoot', (type) => {
    const chain = getInheritanceChain(type).map((c) => c.toUpperCase());
    expect(chain).toContain('IFCROOT');
  });
});

// Neutral synthetic fixture (no real-world identifiers): one instance each
// of a schema-derived-but-not-product, not-group, not-"IfcRel*" IfcRoot
// descendant, spanning several branches of the schema (process, actor,
// management, context, template).
const IFC = `#1=IFCOWNERHISTORY($,$,$,$,$,$,$,0);
#10=IFCTASK('0TaskGuid00000000001',#1,'Pour foundation',$,$,'T-01',$,$,$,.F.,$,$,.CONSTRUCTION.);
#11=IFCACTOR('0ActorGuid0000000001',#1,'Site Manager',$,$,$);
#12=IFCCOSTITEM('0CostGuid000000000001',#1,'Concrete',$,$,'C-01',.USERDEFINED.,$,$);
#13=IFCPROJECTLIBRARY('0LibGuid0000000000001',#1,'Standard Library',$,$,$,$,$);
#14=IFCPROPERTYSETTEMPLATE('0PsetTGuid000000000001',#1,'Pset_Template',$,$,$,$);`;

async function parse() {
  const source = new TextEncoder().encode(IFC);
  const tokenizer = new StepTokenizer(source);
  const entityRefs = Array.from(tokenizer.scanEntitiesFast()).map((ref) => ({
    expressId: ref.expressId,
    type: ref.type,
    byteOffset: ref.offset,
    byteLength: ref.length,
    lineNumber: ref.line,
  }));
  const parser = new ColumnarParser();
  return parser.parseLite(source.buffer.slice(0), entityRefs, {});
}

describe('#4204 — the parser retains those entities in the EntityTable', () => {
  it('resolves GlobalId for IfcTask / IfcActor / IfcCostItem / IfcProjectLibrary / IfcPropertySetTemplate', async () => {
    const store = await parse();
    expect(store.entities.getGlobalId(10)).toBe('0TaskGuid00000000001');
    expect(store.entities.getGlobalId(11)).toBe('0ActorGuid0000000001');
    expect(store.entities.getGlobalId(12)).toBe('0CostGuid000000000001');
    expect(store.entities.getGlobalId(13)).toBe('0LibGuid0000000000001');
    expect(store.entities.getGlobalId(14)).toBe('0PsetTGuid000000000001');
  });

  it('resolves the exact type name for each, instead of "Unknown"', async () => {
    const store = await parse();
    expect(store.entities.getTypeName(10)).toBe('IfcTask');
    expect(store.entities.getTypeName(11)).toBe('IfcActor');
    expect(store.entities.getTypeName(12)).toBe('IfcCostItem');
    expect(store.entities.getTypeName(13)).toBe('IfcProjectLibrary');
    expect(store.entities.getTypeName(14)).toBe('IfcPropertySetTemplate');
  });

  it('resolves the Name attribute for each', async () => {
    const store = await parse();
    expect(store.entities.getName(10)).toBe('Pour foundation');
    expect(store.entities.getName(11)).toBe('Site Manager');
    expect(store.entities.getName(12)).toBe('Concrete');
    expect(store.entities.getName(13)).toBe('Standard Library');
    expect(store.entities.getName(14)).toBe('Pset_Template');
  });
});
