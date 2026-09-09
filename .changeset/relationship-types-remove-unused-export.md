---
'@ifc-lite/parser': major
---

Remove the unused `RELATIONSHIP_TYPES` export. It carried a comment
asserting it "MUST include ALL RelationshipType enum values to prevent
semantic loss," but nothing in the codebase read the set — parsing is
actually gated by `HIERARCHY_REL_TYPES`, `PROPERTY_REL_TYPES`, and
`REL_TYPE_MAP`. Consumers relying on `HIERARCHY_REL_TYPES` /
`PROPERTY_REL_TYPES` / `REL_TYPE_MAP` are unaffected; anyone importing
`RELATIONSHIP_TYPES` directly should switch to one of those.
