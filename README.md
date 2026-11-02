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

### 6. Astronomical Solar Model (Jean Meeus / NOAA)
- **High-Precision Equations**: Julian centuries ($T$), geometric mean anomaly, sun equation of center, apparent longitude, right ascension, declination ($\delta$), and equation of time ($EoT$).
- **Refraction & Angles**: Saemundsson / Bennett atmospheric refraction correction, apparent ($h_{\text{app}}$) and geometric ($h_{\text{geom}} \in [-90^\circ, +90^\circ]$) elevation, solar zenith angle ($90^\circ - h$), and solar azimuth angle ($[0^\circ, 360^\circ)$ clockwise from North, with explicit `null` and `isAzimuthIndeterminate` at zenith, nadir, and geographic poles).
- **Harmonized Geometric Semantics**: Direct sunlight ($\ge -0.8333^\circ$), Civil twilight ($[-6^\circ, -0.8333^\circ)$), Nautical twilight ($[-12^\circ, -6^\circ)$), Astronomical twilight ($[-18^\circ, -12^\circ)$), and Night ($< -18^\circ$). Polar Day and Polar Night are rigorously classified on diurnal minimum and maximum geometric elevation.
- **Dynamic Uncertainty Decomposition**: Separates ephemeris numerical error ($\pm 0.01^\circ$), atmospheric refraction uncertainty ($\pm 0.05^\circ$ near horizon), dynamic event-time uncertainty ($\Delta t = \Delta h / |dh/dt|$ expanding at high latitudes and tangential grazes), and observer horizon dip ($0.0293^\circ \sqrt{\text{elevationMeters}}$).
- **Polar Edge Cases**: Graceful classification of Polar Day (Midnight Sun) and Polar Night in high latitudes (e.g. Tromsø $69.65^\circ$N, Svalbard $78.22^\circ$N, Arctic/Antarctic polar circles, and North/South poles $\pm 90^\circ$) with zero NaN errors or exceptions.
- **Complete Event Locator**: Discrete event search via `ChronoFlux.solar.nextEvent` supporting all 10 events: `sunrise`, `sunset`, `solarNoon`, `solarMidnight`, `civilDawn`, `civilDusk`, `nauticalDawn`, `nauticalDusk`, `astronomicalDawn`, and `astronomicalDusk`.
- **Safeguarded Root-Finding**: Hybrid bracketed Newton-Raphson and bisection root-finding with explicit convergence criteria and elevation verification.
- **Performance**: High-throughput instantaneous position evaluation (`solar.evaluatePosition`) and diurnal cycle event caching for repeated queries at the same place and date.

### 7. Civil Calendar & IANA Time Zone Model
- **Wall-Clock Evaluation**: Local calendar state (`year`, `month`, `day`, `hour`, `minute`, `second`, `millisecond`, `nanosecond`) for any IANA timezone identifier.
- **Strict Timezone Requirement**: Silent fallback to UTC is disabled; Place instances must have a valid `timeZoneId` or resolve via a registered `TimeZoneLookupProvider`.
- **Pluggable Geographic Timezone Provider**: Interface `TimeZoneLookupProvider` allows registering custom polygon or offline geographic timezone lookup engines.
- **Non-Heuristic DST Detection**: Inspects explicit IANA time zone descriptors and evaluates full annual 12-month offset profiles to handle unique jurisdictions (e.g. Morocco Ramadan shifts) without heuristic solstice sampling.
- **Reproducible Runtime Provenance**: Exposes underlying civil time runtime and database versions (`tz`, `icu`, `cldr`, `unicode`).
- **DST Disambiguation**: TC39-compliant resolution of civil wall-clock dates into unambiguous physical `Instant`s:
  - Spring-forward skipped hours: `'compatible'` / `'later'` advances by gap, `'earlier'` moves before gap, `'reject'` throws `RangeError`.
  - Fall-back repeated hours: `'compatible'` / `'earlier'` selects earlier EDT instance, `'later'` selects later EST instance, `'reject'` throws `RangeError`.
- **Zero Heavy Dependencies**: Leverages ECMAScript `Intl.DateTimeFormat` and native `Temporal` engines with deterministic fallback.

---

## Developer API Example

```typescript
import { ChronoFlux } from '@chronoflux/core';

// 1. Instants & Geodetic Coordinates
const now = ChronoFlux.now();
const tokyo = ChronoFlux.place({ latitude: 35.6762, longitude: 139.6503, timeZoneId: 'Asia/Tokyo' });

// 2. Astronomical Solar State
const solar = ChronoFlux.solar.evaluate(now, tokyo);
console.log(`Solar elevation: ${solar.elevationDeg.toFixed(2)}° (${solar.phase})`);
console.log(`Solar azimuth: ${solar.azimuthDeg.toFixed(2)}°`);

// 3. Solar Event Finder
const nextSunrise = ChronoFlux.solar.nextEvent({
  event: 'sunrise',
  place: tokyo,
  after: now,
});
console.log(`Next sunrise: ${nextSunrise?.toISOString()}`);

// 4. Civil Time & DST Disambiguation
const civil = ChronoFlux.civil.evaluate(now, tokyo);
console.log(`Tokyo Local Time: ${civil.year}-${civil.month}-${civil.day} ${civil.hour}:${civil.minute}`);

// Disambiguate Daylight Saving Time transitions
const instant = ChronoFlux.civil.resolve({
  year: 2026,
  month: 3,
  day: 8,
  hour: 2,
  minute: 30,
  timeZoneId: 'America/New_York',
  disambiguation: 'compatible', // Automatically advances past skipped spring-forward hour
});
```

---

## Installation & Testing

```bash
npm install
npm test
npm run test:coverage
npm run build
```

