/**
 * @file consumer.js
 * External ESM consumer smoke test verifying @chronoflux/core installed via npm tarball.
 */

import assert from 'node:assert';
import ChronoFluxDefault, {
  ChronoFlux,
  Instant,
  Duration,
  Place,
  Interval,
  IntervalSet,
  Conditions,
} from '@chronoflux/core';

console.log('[consumer.js] Verifying @chronoflux/core ESM package...');

// 1. Facade and default export equality
assert.strictEqual(ChronoFluxDefault, ChronoFlux);
assert.strictEqual(typeof ChronoFlux.now, 'function');
assert.strictEqual(typeof ChronoFlux.instant, 'function');
assert.strictEqual(typeof ChronoFlux.duration.hours, 'function');

// 2. Primitives: Instant & Duration
const t0 = Instant.fromJSON('2026-06-21T12:00:00.000Z');
const dur = Duration.fromHours(2);
const t1 = t0.add(dur);
assert.strictEqual(t1.toISOString(), '2026-06-21T14:00:00.000Z');

// 3. Place & Interval
const nyc = new Place({
  latitude: 40.7128,
  longitude: -74.006,
  timeZoneId: 'America/New_York',
});
const searchWindow = new Interval(
  Instant.fromJSON('2026-06-21T04:00:00.000Z'),
  Instant.fromJSON('2026-06-22T04:00:00.000Z')
);

// 4. Solar and Civil evaluation
const solarPos = ChronoFlux.solar.evaluatePosition(t0, nyc);
assert.strictEqual(typeof solarPos.elevationDeg, 'number');
assert.strictEqual(typeof solarPos.azimuthDeg, 'number');

const civilState = ChronoFlux.civil.evaluate(t0, nyc);
assert.strictEqual(civilState.hour, 8); // 12:00 UTC = 08:00 EDT
assert.strictEqual(civilState.isDaylightSaving, true);

// 5. Conditions and Resolver
const daylightBizHours = Conditions.and(
  Conditions.solar.elevation.gte(10),
  Conditions.civil.hour.between(9, 17)
);

const res = ChronoFlux.resolve({
  place: nyc,
  within: searchWindow,
  where: daylightBizHours,
  policy: 'all',
});

assert(res.intervals.intervals.length > 0, 'Expected resolved intervals');
assert(res.report.modelsConsulted.includes('solar'));
assert(res.report.modelsConsulted.includes('civil'));
assert.strictEqual(typeof res.report.executionTimeMs, 'number');

console.log('[consumer.js] All ESM checks passed successfully!');
