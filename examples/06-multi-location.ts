/**
 * @file 06-multi-location.ts
 * Example 6: Cross-location solar and civil synchronization.
 *
 * Demonstrates:
 * - Evaluating temporal conditions across multiple geographical locations (London, New York, Tokyo)
 * - Computing simultaneous physical solar daylight vs. civil business hours overlap
 * - Using IntervalSet intersection to find cross-office working windows where both locations
 *   experience business hours or daylight
 */

import { Time, Conditions, Instant, Duration } from '../src/index.js';

console.log('=== Example 6: Cross-Location Solar & Civil Synchronization ===\n');

// 1. Define three global offices
const london = Time.place({
  latitude: 51.5074,
  longitude: -0.1278,
  timeZoneId: 'Europe/London',
});

const newYork = Time.place({
  latitude: 40.7128,
  longitude: -74.006,
  timeZoneId: 'America/New_York',
});

const tokyo = Time.place({
  latitude: 35.6762,
  longitude: 139.6503,
  timeZoneId: 'Asia/Tokyo',
});

// 2. Global search window: 3 business days in September 2026
const start = Instant.fromJSON('2026-09-14T00:00:00.000Z'); // Monday 00:00 UTC
const window = Time.interval(start, start.add(Duration.fromDays(3)));

// 3. Resolve London business hours (09:00 - 17:00 local time)
const londonWork = Time.resolve({
  place: london,
  within: window,
  where: Conditions.civil.hour.between(9, 17),
});

// 4. Resolve New York business hours (09:00 - 17:00 local time)
const nyWork = Time.resolve({
  place: newYork,
  within: window,
  where: Conditions.civil.hour.between(9, 17),
});

// 5. Algebraic intersection: Find London & New York overlapping business hours
const transatlanticOverlap = londonWork.intervals.intersect(nyWork.intervals);

console.log(`[Transatlantic Collaboration: London & New York]`);
console.log(`Total simultaneous business windows: ${transatlanticOverlap.intervals.length}`);
transatlanticOverlap.intervals.forEach((iv, i) => {
  const lonTime = Time.civil.evaluate(iv.start, london);
  const lonEndTime = Time.civil.evaluate(iv.end, london);
  const nyTime = Time.civil.evaluate(iv.start, newYork);
  const nyEndTime = Time.civil.evaluate(iv.end, newYork);

  console.log(`  Day ${i + 1}: ${iv.duration.totalHours} hours overlap`);
  console.log(`    London:   ${lonTime.hour}:00 → ${lonEndTime.hour}:00 BST`);
  console.log(`    New York: ${nyTime.hour}:00 → ${nyEndTime.hour}:00 EDT`);
  console.log(`    UTC:      ${iv.start.toISOString()} → ${iv.end.toISOString()}`);
});
console.log();

// 6. Cross-location solar comparison: Is it daytime in Tokyo while London is working?
const tokyoDaylight = Time.resolve({
  place: tokyo,
  within: window,
  where: Conditions.solar.elevation.gte(0), // Direct daylight
});

const londonWorkDuringTokyoDaylight = londonWork.intervals.intersect(tokyoDaylight.intervals);
console.log(`[London Working Hours during Tokyo Daylight]`);
console.log(`Matching intervals: ${londonWorkDuringTokyoDaylight.intervals.length}`);
londonWorkDuringTokyoDaylight.intervals.forEach((iv, i) => {
  console.log(`  Interval ${i + 1}: ${iv.duration.totalHours.toFixed(2)}h (${iv.start.toISOString()} → ${iv.end.toISOString()})`);
});
