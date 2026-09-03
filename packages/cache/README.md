# @ifc-lite/cache

Binary cache format for IFClite. Caches the parsed data store and geometry in a compact binary format so a previously-loaded IFC reopens in milliseconds instead of re-running the full parse + tessellation pipeline. Content-addressable (xxHash64 of the source IFC), so cache invalidation is automatic.

**Properties and quantities are not part of that speedup.** `BinaryCacheWriter.write` serializes whatever the data store's property/quantity tables already hold. A STEP-parsed store resolves properties lazily on demand and never populates those tables, so a cache written straight from a STEP parse round-trips with EMPTY property/quantity tables — a cache-restored model queries properties exactly as slow as a fresh parse (see `docs/guide/querying.md`). If your application needs fast repeat property queries too, retain the source buffer alongside the cache entry and re-attach on-demand extraction on read, the way the viewer's cache hook does.

## Installation

```bash
npm install @ifc-lite/cache
```

## Skip the parse on warm load

```typescript
import {
  xxhash64Hex,
  BinaryCacheReader,
  BinaryCacheWriter,
  toCacheDataStore,
} from '@ifc-lite/cache';

const ifcBuffer = await file.arrayBuffer();
const cacheKey = xxhash64Hex(ifcBuffer);

// Try cache first
const cached = await myStorage.get(cacheKey); // your IndexedDB / fs / S3 lookup
if (cached) {
  const reader = new BinaryCacheReader();
  const { geometry } = await reader.read(cached);
  renderer.loadGeometry(geometry?.meshes ?? []);
  return; // first triangles in milliseconds
}

// Cold path — full parse + tessellation, then write the cache.
// dataStore comes from the parser; process() returns a GeometryResult.
// parseColumnar takes the raw ArrayBuffer, not a Uint8Array view of it.
const dataStore = await parser.parseColumnar(ifcBuffer);
const geometry = await geometryProcessor.process(new Uint8Array(ifcBuffer));

const writer = new BinaryCacheWriter();
// toCacheDataStore adapts the parser's IfcDataStore (string `schemaVersion`)
// to the CacheDataStore shape write() requires (numeric `schema` enum) —
// see the note above about what it does and does not carry over.
const cacheBuffer = await writer.write(toCacheDataStore(dataStore), geometry, ifcBuffer, { includeGeometry: true });
await myStorage.put(cacheKey, cacheBuffer);
```

## Pure GLB read

If you already have a GLB blob (from a server, S3, etc.), skip the binary cache wrapper and load directly:

```typescript
import { loadGLBToMeshData, parseGLB } from '@ifc-lite/cache';

const meshes = loadGLBToMeshData(new Uint8Array(glbBuffer)); // synchronous
// MeshData[] ready to feed into @ifc-lite/renderer

// Or get the parsed GLB structure if you need lower-level access
const { json, bin } = parseGLB(glbBuffer);
```

## Hashing utilities

Two hash functions are exposed for cache key generation:

```typescript
import { xxhash64, xxhash64Hex } from '@ifc-lite/cache';

const hexKey = xxhash64Hex(buffer);  // ~5 GB/s, 16-char hex string
const rawKey = xxhash64(buffer);     // same hash as a bigint
```

The cache keys models by the xxHash64 of the source IFC, and `reader.validate(cacheBuffer, sourceBuffer)` uses the same hash to detect when the source has changed.

## Format versioning

The binary layout is versioned via the exported `FORMAT_VERSION` constant. Readers accept entries written by the current or an older format version (with backward-compatible decoding, e.g. the per-mesh geometry-class byte added in v5) and reject entries written by a newer one, so mixed-version deployments fail safely toward a cold parse.

## Source-hash contract (and `omitSourceHash`)

By default the header stores the full-file `xxhash64` of the source in `sourceHash`, and `reader.validate()` / `read({ sourceBuffer })` compare against it. Hashing a large source can be a multi-second main-thread cost, so a caller that validates the source **another way** (e.g. an application-layer content hash plus a file modified-time guard, as the viewer's source-decoupled cache tier does) can pass `omitSourceHash: true`:

```typescript
// Skip the full-file hash; validate the source at the application layer instead.
const cacheBuffer = await writer.write(dataStore, geometry, ifcBuffer, {
  includeGeometry: true,
  omitSourceHash: true,
});
```

Such an entry stores `sourceHash = 0n` and sets `HeaderFlags.SourceHashUnset`. Read it back via `CacheHeaderInfo.hasSourceHash`:

- `hasSourceHash === true`  → `sourceHash` is a real full-file hash; `validate()` and `read({ sourceBuffer })` work as usual.
- `hasSourceHash === false` → `sourceHash` is unset. `read({ sourceBuffer })` **skips** header validation (it does not fail-close on a valid cache), and `validate()` **throws** a clear error instead of returning a misleading `false`. Validate the source yourself (e.g. compare a stored content hash / mtime).

This is backward compatible: entries written before the flag existed have it unset-as-in-absent, so their `sourceHash` remains a real hash and continues to validate normally.

## API

See the [API Reference](https://ifclite.dev/docs/api/typescript/#ifc-litecache).

## License

[MPL-2.0](../../LICENSE)
