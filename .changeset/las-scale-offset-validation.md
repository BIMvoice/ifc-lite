---
"@ifc-lite/pointcloud": patch
---

Reject a zero or non-finite X/Y/Z scale factor and a non-finite offset in a LAS/LAZ header instead of silently collapsing every point to the header offset (or NaN). `decodeLasPoints`'s bbox fold now also skips a non-finite coordinate instead of poisoning the box to `±Infinity`, and falls back to a finite zero bbox when every coordinate in a chunk is non-finite (e.g. a finite-but-huge scale that overflows on multiplication), matching the guard already used by the E57 and IFCX point-cloud paths.
