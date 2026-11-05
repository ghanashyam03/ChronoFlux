/**
 * @file consumer.js
 * External ESM consumer smoke test verifying time-2.0 (TIME 2.0) installed via npm tarball.
 */

import assert from 'node:assert';
import TimeDefault, {
  Time,
  ChronoFlux,
  Instant,
  Duration,
  Place,
  Interval,
  IntervalSet,
  Conditions,
} from 'time-2.0';

console.log('[consumer.js] Verifying time-2.0 (TIME 2.0) ESM package...');

// 1. Facade and default export equality & backwards compatibility
assert.strictEqual(TimeDefault, Time);
assert.strictEqual(ChronoFlux, Time); // ChronoFlux alias points to Time
assert.strictEqual(typeof Time.now, 'function');
assert.strictEqual(typeof Time.instant, 'function');
assert.strictEqual(typeof Time.duration.hours, 'function');

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

// 4. Solar and Civil evaluation via Time facade
const solarPos = Time.solar.evaluatePosition(t0, nyc);
assert.strictEqual(typeof solarPos.elevationDeg, 'number');
assert.strictEqual(typeof solarPos.azimuthDeg, 'number');

const civilState = Time.civil.evaluate(t0, nyc);
assert.strictEqual(civilState.hour, 8); // 12:00 UTC = 08:00 EDT
assert.strictEqual(civilState.isDaylightSaving, true);

// 5. Conditions and Resolver
const daylightBizHours = Conditions.and(
  Conditions.solar.elevation.gte(10),
  Conditions.civil.hour.between(9, 17)
);

const res = Time.resolve({
  place: nyc,
  within: searchWindow,
  where: daylightBizHours,
  policy: 'all',
});

// Backward-compat check
const resCompat = ChronoFlux.resolve({
  place: nyc,
  within: searchWindow,
  where: daylightBizHours,
  policy: 'all',
});
assert.strictEqual(res.intervals.intervals.length, resCompat.intervals.intervals.length);

assert(res.intervals.intervals.length > 0, 'Expected resolved intervals');
assert(res.report.modelsConsulted.includes('solar'));
assert(res.report.modelsConsulted.includes('civil'));
assert.strictEqual(typeof res.report.executionTimeMs, 'number');

console.log('[consumer.js] All ESM checks passed successfully!');
