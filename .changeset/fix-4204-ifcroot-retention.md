---
"@ifc-lite/parser": patch
---

The columnar parser now retains every `IfcRoot` descendant in the `EntityTable`, derived from the schema registry's inheritance chain, instead of only `IfcProduct` subtypes, `IfcGroup` subtypes and anything named `IfcRel*`. `IfcTask`, `IfcActor`, `IfcCostItem`, `IfcResource`, `IfcStructural*`, `IfcProjectLibrary`, `IfcPropertySetTemplate` and other non-product `IfcObject`/`IfcContext`/`IfcPropertyTemplateDefinition` classes previously fell to `CAT_SKIP` and were unaddressable: `getGlobalId` and `getTypeName` answered `''` and `'Unknown'` for them even though the scanner's byId/byType index still saw the record. A schema-registry sanity check now throws rather than parsing silently if the inheritance walk ever fails to reach `IfcRoot`.
