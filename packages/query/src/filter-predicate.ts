/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * A `where(...)` / `--where` predicate needs to compare a stored property or
 * quantity value against a caller-supplied filter value. Three call sites
 * implemented this independently (the CLI's `HeadlessBackend`, the MCP
 * backend, and the `ifc-lite query --where` flag), and a fourth — the
 * viewer's embedded SDK backend, `bim`'s primary consumption path — never
 * picked up the boolean-normalization/case-insensitive-`contains` fix the
 * other three carry, so the identical `bim.query().where(...)` call silently
 * matched fewer rows there than in the CLI/MCP. This module is the single
 * home for that comparison so the four call sites can't drift apart again.
 */

export type FilterComparisonOp = '=' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'exists' | 'matches';

/**
 * Normalize boolean-like values for comparison. IFC STEP encodes booleans as
 * `.T.`/`.F.` tokens; parsed property values are typically real JS booleans
 * by the time they reach a filter, but a caller-supplied filter value (a CLI
 * flag, a raw mutation) may arrive as one of the string spellings instead.
 * Collapsing every spelling to the same `'true'`/`'false'` string lets the
 * `String(a) === String(b)` comparisons below treat them all as equal.
 */
export function normalizeBooleanValue(value: unknown): unknown {
  if (value === true || value === '.T.' || value === 'true' || value === 'TRUE') return 'true';
  if (value === false || value === '.F.' || value === 'false' || value === 'FALSE') return 'false';
  return value;
}

/**
 * `matches`'s `expected` side is a bare regex *source* — no `/…/` delimiters,
 * no flag suffix. That is deliberately the same shape `SelectorText`'s
 * `{ kind: 'regex', source }` carries in `packages/query/src/selector/ast.ts`
 * (`readRegex` in `tokenize.ts` already strips the delimiters and unescapes
 * `\/`), so a selector adapter can hand a parsed regex filter's `source`
 * straight to this operator without re-deriving delimiter stripping.
 * Matching is case-sensitive by construction (no implicit `i` flag, unlike
 * `contains`, which lowercases both sides) — the pattern's author controls
 * case sensitivity, not this function.
 *
 * An invalid pattern does not throw — `compareFilterValue` is a boolean
 * predicate on every other branch (`>` against a non-numeric `expected` is
 * `Number(x) > NaN` which is already `false`, never a throw), so a malformed
 * regex is treated the same way: it cannot match anything, so the predicate
 * is `false`. A caller that wants to surface "this pattern is invalid" as a
 * loud error (e.g. a selector adapter validating user input before running a
 * query) must do that at parse time, before values ever reach here.
 */
function matchesRegex(actual: unknown, expected: unknown): boolean {
  let re: RegExp;
  try {
    re = new RegExp(String(expected));
  } catch {
    return false;
  }
  return re.test(String(actual));
}

/**
 * Evaluate a single comparison operator against a stored value and a
 * filter value. Booleans are normalized first (see {@link normalizeBooleanValue}),
 * and `contains` is case-insensitive — the settled semantics across the
 * CLI/MCP query backends, now shared rather than duplicated.
 *
 * `exists` answers "is this property/quantity present", not "does it carry a
 * non-null value" — a caller passes `actual` here only once it has already
 * confirmed the property was found (e.g. `IFCPROPERTYSINGLEVALUE('FireRating',
 * $,$,$)` is present in its pset with a `$` nominal value, which parses to
 * `null`; it still exists). So `exists` is unconditional true once reached.
 *
 * `matches` is a regex test — see {@link matchesRegex} for the exact
 * delimiter/flag/error contract. It is NOT boolean-normalized: normalizing
 * `true`/`false` to the strings `'true'`/`'false'` before every other
 * operator exists so `.T.`/`true`/`TRUE` compare as equal, which has nothing
 * to do with regex matching, and normalizing first would only make a pattern
 * like `/^\.T\.$/` (deliberately matching the raw STEP token) silently see
 * `'true'` instead.
 */
export function compareFilterValue(actual: unknown, operator: FilterComparisonOp, expected: unknown): boolean {
  if (operator === 'exists') return true;
  if (operator === 'matches') return matchesRegex(actual, expected);
  const normActual = normalizeBooleanValue(actual);
  const normExpected = normalizeBooleanValue(expected);
  switch (operator) {
    case '=': return String(normActual) === String(normExpected);
    case '!=': return String(normActual) !== String(normExpected);
    case '>': return Number(normActual) > Number(normExpected);
    case '<': return Number(normActual) < Number(normExpected);
    case '>=': return Number(normActual) >= Number(normExpected);
    case '<=': return Number(normActual) <= Number(normExpected);
    case 'contains': return String(normActual).toLowerCase().includes(String(normExpected).toLowerCase());
    default: return false;
  }
}
