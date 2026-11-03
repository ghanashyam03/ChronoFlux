/**
 * @file 01-solar-daylight.ts
 * Example 1: Resolving daylight windows (solar elevation >= 10°).
 *
 * Demonstrates:
 * - Observer place setup (San Francisco, CA)
 * - 3-day search window
 * - Continuous monotonic branch root-finding for elevation >= 10°
 * - Inspecting boundary residuals and duration of daylight windows
 */

import { ChronoFlux, Conditions, Instant, Duration } from '../src/index.js';

// 1. Observer: San Francisco, California
const sf = ChronoFlux.place({
  latitude: 37.7749,
  longitude: -122.4194,
  timeZoneId: 'America/Los_Angeles',
});

// 2. Search window: 3 days around the summer solstice 2026
const start = Instant.fromJSON('2026-06-20T07:00:00.000Z');
const window = ChronoFlux.interval(start, start.add(Duration.fromDays(3)));

console.log('=== Example 1: Resolving Daylight Windows (elevation >= 10°) ===');
console.log(`Observer: San Francisco (${sf.latitude}°, ${sf.longitude}°)`);
console.log(`Window:   ${window.start.toISOString()} → ${window.end.toISOString()}\n`);

// 3. Declare condition: solar elevation >= 10 degrees
const daylight = Conditions.solar.elevation.gte(10);

// 4. Resolve continuous intervals
const result = ChronoFlux.resolve({
  place: sf,
  within: window,
  where: daylight,
  policy: 'all',
});

console.log(`Resolved ${result.intervals.intervals.length} daylight intervals in ${result.report.executionTimeMs.toFixed(2)} ms:\n`);

result.intervals.intervals.forEach((iv, idx) => {
  const localStart = ChronoFlux.civil.evaluate(iv.start, sf);
  const localEnd = ChronoFlux.civil.evaluate(iv.end, sf);
  const startStr = `${localStart.hour.toString().padStart(2, '0')}:${localStart.minute.toString().padStart(2, '0')}`;
  const endStr = `${localEnd.hour.toString().padStart(2, '0')}:${localEnd.minute.toString().padStart(2, '0')}`;

  console.log(`[Daylight Window ${idx + 1}]`);
  console.log(`  Local Time: ${startStr} → ${endStr} PDT (${iv.duration.totalHours.toFixed(2)} hours)`);
  console.log(`  UTC Range:  ${iv.start.toISOString()} → ${iv.end.toISOString()}`);

  const explanation = result.report.explanations[idx];
  if (explanation?.startExplanation.details?.residualDeg !== undefined) {
    console.log(`  Start Root Residual: ${explanation.startExplanation.details.residualDeg.toExponential(2)}°`);
  }
  console.log();
});
