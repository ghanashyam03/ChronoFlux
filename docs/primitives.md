# Mathematical Temporal Primitives

TIME 2.0 models time as continuous, high-precision physical intervals rather than scalar timestamps or lossy floating-point numbers.

---

## 1. `Instant` — Nanosecond-Precision Timeline

An `Instant` represents an immutable point on the physical timeline measured in integer nanoseconds relative to the Unix Epoch (`1970-01-01T00:00:00Z`).

### Invariants & Semantics
- **64-bit/BigInt Precision**: Backed by `bigint` nanoseconds (`epochNanoseconds`). Zero floating-point drift.
- **Validity Range**: Aligned with the TC39 Temporal proposal: $\pm 100,000,000$ days ($\pm 8.64 \times 10^{21}$ nanoseconds), spanning roughly $\pm 273,790$ years (271,821 BCE to 275,760 CE).
- **Leap Second Handling**: Follows UTC standard POSIX convention (86,400 SI seconds per civil day). Leap second timestamps (e.g. `23:59:60`) can be parsed and mapped deterministically using configurable policies (`compatible`, `clamp`, `strict`, `reject`).

### Usage

```typescript
import { Instant } from 'time-2.0';

// From current wall-clock
const now = Instant.now();

// From ISO-8601 string
const t1 = Instant.fromJSON('2026-06-21T12:00:00.123456789Z');

// From BigInt nanoseconds
const t2 = Instant.fromEpochNanoseconds(1_782_043_200_123_456_789n);

// Temporal comparisons
if (t1.isBefore(t2)) {
  console.log('t1 occurs before t2');
}

// Difference and arithmetic
const duration = t2.since(t1);
const t3 = t1.add(duration);
```

---

## 2. `Duration` — Exact Temporal Spans

A `Duration` represents an immutable signed elapsed duration between two instants, backed by BigInt nanoseconds.

### Invariants & Semantics
- **Unit Conversions**: Exact fractional properties (`totalDays`, `totalHours`, `totalMinutes`, `totalSeconds`, `totalMilliseconds`).
- **Rounding Modes**: Supports `'trunc'`, `'floor'`, `'ceil'`, and `'halfExpand'` when converting between fractional and integer representations.
- **Zero Loss**: Never loses nanosecond fidelity during addition, subtraction, or negation.

### Usage

```typescript
import { Duration } from 'time-2.0';

const d1 = Duration.fromHours(3);
const d2 = Duration.fromMinutes(45);
const sum = d1.add(d2); // 3h 45m

console.log(sum.totalSeconds); // 13500
console.log(sum.totalHours);   // 3.75
console.log(sum.toComponents()); // { days: 0, hours: 3, minutes: 45, seconds: 0, milliseconds: 0, ... }
```

---

## 3. `Place` — WGS84 Terrestrial Observer

An immutable geographical location on the Earth's surface defined on the WGS84 reference ellipsoid.

### Invariants & Semantics
- **Latitude**: $[-90.0^\circ, +90.0^\circ]$ (positive North, negative South).
- **Longitude**: $[-180.0^\circ, +180.0^\circ]$ (positive East, negative West).
- **Elevation Datum**: `elevationMeters` is orthometric height above Mean Sea Level (MSL / geoid). Assumes an unobstructed sea horizon.
- **Elevation Horizon Dip**: Depresses the apparent horizon threshold by:
  $$d_{\text{dip}} \approx \frac{1.76'}{60} \sqrt{h_{\text{elev}}}$$
  expanding the duration of direct sunlight.
- **Timezone Safety**: Requires an explicit IANA time zone identifier (e.g. `'America/New_York'`) or a registered `TimeZoneLookupProvider`. Never silently defaults to UTC for civil calculations.

### Usage

```typescript
import { Place } from 'time-2.0';

const observatory = new Place({
  latitude: 28.2997,
  longitude: -16.5097,
  elevationMeters: 2390, // Teide Observatory (elevated horizon dip)
  timeZoneId: 'Atlantic/Canary',
});
```

---

## 4. `Interval` — Half-Open Temporal Ranges

An `Interval` represents a continuous, half-open temporal range:
$$[t_{\text{start}}, t_{\text{end}}) = \{ t \in \mathbb{R} \mid t_{\text{start}} \le t < t_{\text{end}} \}$$

### Why Half-Open?
Half-open intervals prevent off-by-one boundary collisions and guarantee that contiguous intervals merge seamlessly:
$$[a, b) \cup [b, c) = [a, c)$$

### Allen's 13 Interval Relationships
TIME 2.0 provides native computation of James F. Allen's (1983) 13 mutually exclusive interval relationships:
- `before` / `after`
- `meets` / `metBy`
- `overlaps` / `overlappedBy`
- `starts` / `startedBy`
- `during` / `contains`
- `finishes` / `finishedBy`
- `equals`

```typescript
import { Interval, Instant } from 'time-2.0';

const a = new Interval(Instant.fromJSON('2026-06-21T09:00:00Z'), Instant.fromJSON('2026-06-21T12:00:00Z'));
const b = new Interval(Instant.fromJSON('2026-06-21T12:00:00Z'), Instant.fromJSON('2026-06-21T15:00:00Z'));

console.log(a.relationTo(b)); // 'meets'
console.log(b.relationTo(a)); // 'metBy'
console.log(a.intersection(b)); // null (half-open, no overlap at the single instant)
```

---

## 5. `IntervalSet` — Canonical Algebraic Sets

An `IntervalSet` is an immutable, canonical collection of mutually disjoint, non-adjacent, sorted half-open intervals.

### Algebraic Completeness
- **Union ($\cup$)**: Merges overlapping and touching intervals.
- **Intersection ($\cap$)**: Evaluates exact overlap between two interval sets.
- **Difference ($\setminus$)**: Subtracts an interval set from another.
- **Complement ($W \setminus S$)**: Inverts an interval set relative to a bounding search window $W$.

```typescript
import { IntervalSet, Interval, Instant } from 'time-2.0';

const set1 = IntervalSet.from([
  new Interval(Instant.fromJSON('2026-06-21T09:00:00Z'), Instant.fromJSON('2026-06-21T12:00:00Z')),
  new Interval(Instant.fromJSON('2026-06-21T14:00:00Z'), Instant.fromJSON('2026-06-21T17:00:00Z')),
]);

const set2 = IntervalSet.from([
  new Interval(Instant.fromJSON('2026-06-21T11:00:00Z'), Instant.fromJSON('2026-06-21T15:00:00Z')),
]);

// Intersection: [11:00, 12:00) and [14:00, 15:00)
const overlap = set1.intersect(set2);

// Union: [09:00, 17:00)
const combined = set1.union(set2);
```
