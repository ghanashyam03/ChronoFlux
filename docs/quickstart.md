# Quickstart Guide

Get up and running with `@chronoflux/core` in less than 5 minutes.

## 1. Overview

ChronoFlux unifies three core capabilities into a single cohesive engine:
1. **Mathematical Temporal Primitives**: Nanosecond-precision `Instant` (BigInt), typed `Duration`, WGS84 `Place`, and Allen interval algebra on `Interval` and `IntervalSet`.
2. **Physical & Civil State Models**: Astronomical solar positioning (< 0.02° error) and IANA timezone evaluation with deterministic DST disambiguation.
3. **Continuous Temporal Condition Resolver**: Fluent AST query builder (`Conditions`) resolved into verified continuous half-open interval sets with explainable mathematical provenance (`ResolutionReport`).

---

## 2. Minimal Runnable Example

Create a file `quickstart.mjs`:

```javascript
import { ChronoFlux, Conditions, Instant, Duration, Place, Interval } from '@chronoflux/core';

// 1. Define an observer location (Tokyo, Japan)
const tokyo = ChronoFlux.place({
  latitude: 35.6762,
  longitude: 139.6503,
  timeZoneId: 'Asia/Tokyo',
});

// 2. Define a search window: 3 days in June 2026
const windowStart = Instant.fromJSON('2026-06-21T00:00:00.000Z');
const searchWindow = new Interval(windowStart, windowStart.add(Duration.fromDays(3)));

// 3. Declare a multi-model condition:
// Find windows where:
// - Solar elevation >= 20° (sufficient direct daylight)
// AND
// - Local civil hour is between 10:00 and 16:00 (core operating hours)
const query = Conditions.and(
  Conditions.solar.elevation.gte(20),
  Conditions.civil.hour.between(10, 16)
);

// 4. Resolve the condition into verified half-open intervals
const result = ChronoFlux.resolve({
  place: tokyo,
  within: searchWindow,
  where: query,
  policy: 'all',
  minDuration: Duration.fromHours(1),
});

console.log(`Matched ${result.intervals.intervals.length} intervals in ${result.report.executionTimeMs.toFixed(2)} ms:\n`);

for (const interval of result.intervals.intervals) {
  const localStart = ChronoFlux.civil.evaluate(interval.start, tokyo);
  const localEnd = ChronoFlux.civil.evaluate(interval.end, tokyo);
  console.log(`• UTC:   ${interval.start.toISOString()} → ${interval.end.toISOString()}`);
  console.log(`  Tokyo: ${localStart.year}-${localStart.month}-${localStart.day} ${localStart.hour}:00 → ${localEnd.hour}:00 (${interval.duration.totalMinutes} min)\n`);
}

// 5. Inspect mathematical provenance
console.log('Governing Models:', result.report.modelsConsulted.join(', '));
console.log('Query AST:', result.report.query);
```

Run with Node.js:

```bash
node quickstart.mjs
```

---

## 3. Core Facade Cheat Sheet

| Feature | Method | Description |
| :--- | :--- | :--- |
| **Current Time** | `ChronoFlux.now()` | Captures wall-clock `Instant` |
| **Instant Construction** | `ChronoFlux.instant(value)` | From epoch nanoseconds, milliseconds, `Date`, or ISO-8601 string |
| **Duration Units** | `ChronoFlux.duration.hours(h)` | Nanoseconds, microseconds, milliseconds, seconds, minutes, hours, days |
| **Place Definition** | `ChronoFlux.place({ latitude, longitude, ... })` | Immutable WGS84 observer position with optional elevation & timezone |
| **Half-Open Interval** | `ChronoFlux.interval(start, end)` | Continuous $[t_{\text{start}}, t_{\text{end}})$ range |
| **Interval Sets** | `ChronoFlux.intervalSet.from(intervals)` | Canonical sorted, disjoint, merged interval collection |
| **Solar Position** | `ChronoFlux.solar.evaluatePosition(instant, place)` | Instantaneous elevation, azimuth, zenith (< 8 µs/op) |
| **Solar Events** | `ChronoFlux.solar.nextEvent({ type, place, after })` | High-precision Brent-Dekker solver for sunrise, sunset, twilights |
| **Civil Wall Clock** | `ChronoFlux.civil.evaluate(instant, place)` | Wall-clock date, hour, minute, second, UTC offset, and DST status |
| **DST Disambiguation**| `ChronoFlux.civil.resolve({ ... })` | Resolves wall-clock times across fall-back repeated hours and spring-forward gaps |
| **Condition Builder** | `ChronoFlux.conditions` (`Conditions`) | Fluent, JSON-serializable temporal predicate AST builder |
| **Interval Resolver** | `ChronoFlux.resolve({ place, within, where, policy })` | Solves continuous intervals with mathematical boundary explanations |
