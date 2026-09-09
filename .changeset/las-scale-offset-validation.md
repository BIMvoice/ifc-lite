---
"@ifc-lite/pointcloud": patch
---

Reject a zero or non-finite X/Y/Z scale factor and a non-finite offset in a LAS/LAZ header instead of silently collapsing every point to the header offset (or NaN). `decodeLasPoints`'s bbox fold now also skips a non-finite coordinate instead of poisoning the box to `±Infinity`, matching the guard already used by the E57 and IFCX point-cloud paths.
