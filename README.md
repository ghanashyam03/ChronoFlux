# ChronoFlux: Universal Temporal Foundations (Phase 1)

ChronoFlux provides a mathematically rigorous, high-resolution temporal foundation designed for complex civil, astronomical, and continuous-state scheduling environments.

## Core Architectural Invariants

### 1. Canonical Nanosecond Precision (Option B)
- **Canonical Storage**: `epochNanoseconds: bigint` representing an integer count of nanoseconds relative to Unix Epoch (`1970-01-01T00:00:00Z`).
- **Semantic Wall-Clock Anchor**: `Instant` represents an epoch-based UTC wall-clock time, strictly distinct from monotonic hardware timers (`performance.now`, `process.hrtime`).
- **POSIX / TC39 Leap Seconds Convention**: Aligned with POSIX and TC39 `Temporal.Instant`, the scale assumes standard 86,400 SI seconds per day, abstracting leap seconds.
- **Precision vs. Measurement Accuracy**: Nanosecond `BigInt` representation guarantees exact arithmetic and zero rounding loss in interval calculations; it does not imply nanosecond physical sensor accuracy.
- **Supported Range**: $\pm 100,000,000$ days ($\pm 8.64 \times 10^{21}$ ns) spanning $\approx \pm 273,790$ years around Unix epoch (~271,821 BCE to ~275,760 CE). Exceeding this range strictly throws `RangeError`.

### 2. Physical Duration vs. Calendar Arithmetic
- **Signed Integer Nanoseconds**: `Duration` is stored as `nanoseconds: bigint`.
- **SI Consistency**: Only fixed elapsed physical units (days, hours, minutes, seconds, milliseconds, microseconds, nanoseconds) are supported.
- **Calendar Separation**: Variable calendar units (months, years) are deliberately excluded to eliminate timezone- and daylight-saving-dependent ambiguities.

### 3. Geodetic Place (WGS84)
- **Coordinates**: Latitude strictly validated in $[-90.0, +90.0]^\circ$, longitude in $[-180.0, +180.0]^\circ$.
- **Optional Elevation**: Height above WGS84 ellipsoid in meters.
- **Contextual Timezone Separation**: `timeZoneId` is contextual metadata, not an intrinsic physical coordinate property.

### 4. Continuous Interval & Allen's 13 Relations
- **Half-Open Intervals**: $[start, end) = \{ t \mid start \le t < end \}$.
- **Strict Invariant**: Requires $start < end$. Zero-length or reversed intervals are forbidden by contract and throw `RangeError`. Empty sets are represented exclusively as `IntervalSet.empty()`.
- **Allen's Interval Algebra (1983)**: Evaluates pairwise interval relations across all 13 elementary mutually exclusive states:
  `before`, `after`, `meets`, `metBy`, `overlaps`, `overlappedBy`, `starts`, `startedBy`, `during`, `contains`, `finishes`, `finishedBy`, `equals`.
- **Involution**: Guaranteed $A.\text{relationTo}(B) \equiv \text{converse}(B.\text{relationTo}(A))$.

### 5. Canonical IntervalSet & Set Algebra
- **Canonical Representation**: Sorted strictly by start instant, pairwise disjoint, and non-adjacent ($e_i < s_{i+1}$).
- **Adjacent Interval Normalization**: Adjacent intervals $[a, b)$ and $[b, c)$ are normalized into $[a, c)$.
- **Set Operations**:
  - Union ($A \cup B$)
  - Intersection ($A \cap B$)
  - Difference ($A \setminus B$)
  - Bounded Complement ($\text{within} \setminus S$)

---

## Installation & Testing

```bash
npm install
npm test
npm run test:coverage
npm run build
```
