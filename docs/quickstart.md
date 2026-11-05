# Quickstart Guide

Get up and running with `time-2.0` (TIME 2.0) in less than 5 minutes.

## 1. Overview

TIME 2.0 unifies three core capabilities into a single cohesive engine:
1. **Mathematical Temporal Primitives**: Nanosecond-precision `Instant` (BigInt), typed `Duration`, WGS84 `Place`, and Allen interval algebra on `Interval` and `IntervalSet`.
2. **Physical & Civil State Models**: Astronomical solar positioning (< 0.02° error) and IANA timezone evaluation with deterministic DST disambiguation.
3. **Continuous Temporal Condition Resolver**: Fluent AST query builder (`Conditions`) resolved into verified continuous half-open interval sets with explainable mathematical provenance (`ResolutionReport`).

---

## 2. Minimal Runnable Example

Create a file `quickstart.mjs`:

```javascript
import { Time, Conditions, Instant, Duration, Place, Interval } from 'time-2.0';

// 1. Define an observer location (Tokyo, Japan)
const tokyo = Time.place({
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
const result = Time.resolve({
  place: tokyo,
  within: searchWindow,
  where: query,
  policy: 'all',
  minDuration: Duration.fromHours(1),
});

console.log(`Matched ${result.intervals.intervals.length} intervals in ${result.report.executionTimeMs.toFixed(2)} ms:\n`);

for (const interval of result.intervals.intervals) {
  const localStart = Time.civil.evaluate(interval.start, tokyo);
  const localEnd = Time.civil.evaluate(interval.end, tokyo);
  console.log(`• UTC:   ${interval.start.toISOString()} → ${interval.end.toISOString()}`);
  console.log(`  Tokyo: ${localStart.year}-${localStart.month}-${localStart.day} ${localStart.hour}:00 → ${localEnd.hour}:00 (${interval.duration.totalMinutes} min)\n`);
}

// 5. Inspect mathematical provenance
console.log('Mathematical Provenance:');
console.log(`- Solver iterations: ${result.report.iterationCount}`);
console.log(`- Models used: ${result.report.modelsUsed.join(', ')}`);
```

Run with Node:

```bash
node quickstart.mjs
```
