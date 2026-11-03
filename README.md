# ChronoFlux Core (`@chronoflux/core`)

[![CI](https://github.com/ghanashyam03/ChronoFlux/actions/workflows/ci.yml/badge.svg)](https://github.com/ghanashyam03/ChronoFlux/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/badge/npm-v0.1.0-blue.svg)](https://github.com/ghanashyam03/ChronoFlux)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-success.svg)](package.json)

**ChronoFlux Core** is a mathematically rigorous, zero-dependency universal temporal foundation and continuous condition-state engine. It unifies nanosecond physical timeline arithmetic, geodetic WGS84 coordinates, high-precision astronomical solar positioning (< 0.02° error), IANA civil calendar evaluation with deterministic DST disambiguation, and continuous interval constraint resolution with explainable mathematical provenance.

---

## Key Highlights

- **Zero Production Dependencies**: Clean room implementation from first principles. No transitive runtime vulnerabilities or supply-chain bloat.
- **Canonical Nanosecond Timeline**: `Instant` backed by `BigInt` nanoseconds with TC39 Temporal range ($\pm 100,000,000$ days, $\approx \pm 273,790$ years).
- **Allen's Interval Algebra (1983)**: Exact evaluation of all 13 mutually exclusive pairwise interval relations and canonical disjoint `IntervalSet` algebra ($\cup, \cap, \setminus$).
- **High-Precision Ephemeris**: Analytical Meeus / NOAA solar ephemeris (< 0.02° error against 50 NOAA golden vectors) with Bennett refraction, observer horizon dip, and high-latitude polar regime classification (Midnight Sun / Polar Night).
- **Civil Time & DST Disambiguation**: Deterministic wall-clock resolution across fall-back repeated hours and spring-forward gaps (`compatible`, `earlier`, `later`, `reject`).
- **Declarative Temporal Resolver**: Compiles serializable AST queries (`Conditions.solar.elevation.gte(10)`, `Conditions.civil.hour.between(9, 17)`) into verified continuous half-open interval sets with microdegree Brent-Dekker root finding.
- **Mathematical Provenance**: Every resolved interval includes a complete `ResolutionReport` documenting governing models, boundary reasons, and numerical residuals.

---

## Quickstart

Install via npm, pnpm, or yarn:

```bash
npm install @chronoflux/core
```

Resolve daylight business hours in Tokyo:

```typescript
import { ChronoFlux, Conditions, Instant, Duration } from '@chronoflux/core';

// 1. Define observer location (Tokyo, Japan)
const tokyo = ChronoFlux.place({
  latitude: 35.6762,
  longitude: 139.6503,
  timeZoneId: 'Asia/Tokyo',
});

// 2. Define search window: 3 days in June 2026
const windowStart = Instant.fromJSON('2026-06-21T00:00:00.000Z');
const searchWindow = ChronoFlux.interval(windowStart, windowStart.add(Duration.fromDays(3)));

// 3. Declare composed query: Solar elevation >= 20° AND local civil hour 10:00-16:00
const query = Conditions.and(
  Conditions.solar.elevation.gte(20),
  Conditions.civil.hour.between(10, 16)
);

// 4. Resolve into continuous half-open intervals
const result = ChronoFlux.resolve({
  place: tokyo,
  within: searchWindow,
  where: query,
  policy: 'all',
  minDuration: Duration.fromHours(1),
});

console.log(`Matched ${result.intervals.intervals.length} intervals in ${result.report.executionTimeMs.toFixed(2)} ms:`);

for (const interval of result.intervals.intervals) {
  const start = ChronoFlux.civil.evaluate(interval.start, tokyo);
  const end = ChronoFlux.civil.evaluate(interval.end, tokyo);
  console.log(`• Local: ${start.year}-${start.month}-${start.day} ${start.hour}:00 → ${end.hour}:00 JST (${interval.duration.totalMinutes} min)`);
}
```

---

## Architecture Pillars

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ChronoFlux Core Engine                          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
    ┌───────────────────────────────┼───────────────────────────────┐
    ▼                               ▼                               ▼
┌─────────────────────────┐   ┌──────────────────────────┐   ┌─────────────────────────┐
│  Temporal Foundations   │   │  Astronomical & Civil    │   │  Temporal Logic Engine  │
│  - Instant (BigInt ns)  │   │  - Meeus / NOAA Solar    │   │  - JSON Condition AST   │
│  - Duration (Signed ns) │   │  - Bennett Refraction    │   │  - Fluent Conditions    │
│  - Place (WGS84 Geoid)  │   │  - Polar Regimes         │   │  - Brent-Dekker Roots   │
│  - Interval [start, end)│   │  - IANA Timezones        │   │  - HourBlock Partitioner│
│  - Allen Algebra (1983) │   │  - TC39 DST Disambiguate │   │  - IntervalSet Algebra  │
│  - IntervalSet (Canonical)│  │  - Delta T / Time Scales │   │  - ResolutionReport     │
└─────────────────────────┘   └──────────────────────────┘   └─────────────────────────┘
```

### 1. Temporal Foundations
- **`Instant`**: 64-bit integer nanoseconds relative to Unix Epoch (`1970-01-01T00:00:00Z`). Nanosecond arithmetic eliminates floating-point drift.
- **`Duration`**: Exact signed nanoseconds with lossless conversions to days, hours, minutes, and seconds.
- **`Place`**: Geodetic observer on the WGS84 ellipsoid. Orthometric elevation models geometric horizon dip $d_{\text{dip}} \approx \frac{1.76'}{60}\sqrt{h_{\text{elev}}}$.
- **`Interval`**: Strictly half-open $[t_{\text{start}}, t_{\text{end}})$ ranges preserving $[a, b) \cup [b, c) = [a, c)$.
- **`IntervalSet`**: Sorted, disjoint, merged interval collections implementing complete Boolean algebra.

### 2. High-Precision Astronomical Solar Model
- **Geometric Solar Elevation**: Ground truth calculations anchored to $h_{\text{geom}}$.
- **Statutory Twilights**: Day ($\ge -0.8333^\circ - d_{\text{dip}}$), Civil ($[-6^\circ, -0.8333^\circ)$), Nautical ($[-12^\circ, -6^\circ)$), Astronomical ($[-18^\circ, -12^\circ)$), and Night ($< -18^\circ$).
- **Polar Regimes**: Independent classification of `polar_day` (Midnight Sun) and `polar_night` from instantaneous illumination phase.
- **10 Diurnal Events**: `sunrise`, `sunset`, `solarNoon`, `solarMidnight`, `civilDawn`, `civilDusk`, `nauticalDawn`, `nauticalDusk`, `astronomicalDawn`, `astronomicalDusk`.
- **High-Throughput Positioning**: Pure analytical `solar.evaluatePosition` completes in $\approx 8\text{ }\mu\text{s}$ per operation.

### 3. Civil Calendar & DST Disambiguation
- **IANA Timezones**: Local wall-clock conversion with exact UTC offsets.
- **Zero Silent Fallbacks**: Throws `TypeError` if a civil query is attempted on a place without a timezone or registered `TimeZoneLookupProvider`.
- **TC39 DST Disambiguation**: Deterministic handling of spring-forward gaps and fall-back repeated hours via `'compatible'`, `'earlier'`, `'later'`, and `'reject'`.

### 4. Continuous Temporal Condition Resolver
- **Declarative AST**: Strongly typed comparison (`gt`, `gte`, `lt`, `lte`, `eq`, `neq`, `between`, `in`) and logical (`and`, `or`, `not`) operators.
- **Continuous Monotonic Root Finding**: Diurnal partitions solved with bracketed Brent-Dekker solver achieving $|h(t^*) - \theta| < 10^{-5\circ}$.
- **Intent Policies**: Filter candidate intervals with `'all'`, `'earliest'`, `'latest'`, or `'longest'`.

---

## Documentation Index

Explore the comprehensive guides in the [`docs/`](docs/) directory:

- [Installation & Engine Requirements](docs/installation.md)
- [5-Minute Quickstart Guide](docs/quickstart.md)
- [Mathematical Temporal Primitives (`Instant`, `Duration`, `Place`, `Interval`, `IntervalSet`)](docs/primitives.md)
- [Astronomical Solar Mechanics & Twilight Regimes](docs/solar.md)
- [Civil Calendar & DST Disambiguation](docs/civil.md)
- [Temporal Condition AST & Hybrid Resolver](docs/resolver.md)
- [Resolution Reports & Mathematical Provenance](docs/provenance.md)
- [Scientific Accuracy, Error Bounds & Limitations](docs/accuracy-and-limitations.md)

---

## Runnable Examples

Run practical, end-to-end demonstrations from the [`examples/`](examples/) directory:

1. [`01-solar-daylight.ts`](examples/01-solar-daylight.ts) — Resolving direct daylight windows (`elevation >= 10°`).
2. [`02-civil-business-hours.ts`](examples/02-civil-business-hours.ts) — Resolving civil business hours (`09:00 - 17:00 weekdays`).
3. [`03-solar-and-civil.ts`](examples/03-solar-and-civil.ts) — Composing solar daylight and civil business hours.
4. [`04-polar-regimes.ts`](examples/04-polar-regimes.ts) — Midnight Sun in Svalbard and Polar Night in Tromsø.
5. [`05-dst-recurring.ts`](examples/05-dst-recurring.ts) — Resolving repeated-hour fall-back transitions in New York.
6. [`06-multi-location.ts`](examples/06-multi-location.ts) — Multi-office synchronization across London, New York, and Tokyo.

Run any example with `npx tsx`:

```bash
npx tsx examples/01-solar-daylight.ts
```

---

## Verification & Testing

```bash
# Build TypeScript
npm run build

# Run Vitest test suite (405 tests across 19 files)
npm test

# Collect statement & branch coverage
npm run test:coverage

# Pack and inspect distribution tarball
npm pack --dry-run
```

---

## License

MIT License. Copyright (c) 2026 ChronoFlux Contributors.
