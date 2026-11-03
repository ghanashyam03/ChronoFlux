/**
 * @file 03-solar-and-civil.ts
 * Example 3: Composing solar and civil conditions (Direct daylight AND business hours).
 *
 * Demonstrates:
 * - Cross-domain condition composition: Solar AST combined with Civil AST via Conditions.and()
 * - Exact intersection between continuous physical sunrise/sunset and discrete human work shifts
 * - Filtering by policy="longest" and minimum duration constraint
 * - Inspecting multi-model boundary explanations in ResolutionReport
 */

import { ChronoFlux, Conditions, Instant, Duration } from '../src/index.js';

// 1. Observer: Sydney, Australia
const sydney = ChronoFlux.place({
  latitude: -33.8688,
  longitude: 151.2093,
  timeZoneId: 'Australia/Sydney',
});

// 2. Search window: 5 days in Southern winter (July 2026)
const start = Instant.fromJSON('2026-07-06T00:00:00.000Z');
const window = ChronoFlux.interval(start, start.add(Duration.fromDays(5)));

console.log('=== Example 3: Composing Solar & Civil Conditions ===');
console.log(`Observer: Sydney, Australia (${sydney.latitude}°, ${sydney.longitude}°)`);
console.log(`Window:   ${window.start.toISOString()} → ${window.end.toISOString()}\n`);

// 3. Declare composed query:
// - Direct solar elevation >= 15° (optimal sunlight for outdoor commercial operations)
// - AND civil hour between 8 and 18 (08:00 to 18:00 local time)
// - AND civil dayOfWeek between 1 and 5 (weekdays only)
const query = Conditions.and(
  Conditions.solar.elevation.gte(15),
  Conditions.civil.hour.between(8, 18),
  Conditions.civil.dayOfWeek.between(1, 5)
);

// 4. Resolve candidate intervals
const result = ChronoFlux.resolve({
  place: sydney,
  within: window,
  where: query,
  policy: 'all',
  minDuration: Duration.fromHours(3),
});

console.log(`Resolved ${result.intervals.intervals.length} matching operational daylight windows:\n`);

result.intervals.intervals.forEach((iv, idx) => {
  const localStart = ChronoFlux.civil.evaluate(iv.start, sydney);
  const localEnd = ChronoFlux.civil.evaluate(iv.end, sydney);
  const startStr = `${localStart.hour.toString().padStart(2, '0')}:${localStart.minute.toString().padStart(2, '0')}`;
  const endStr = `${localEnd.hour.toString().padStart(2, '0')}:${localEnd.minute.toString().padStart(2, '0')}`;

  console.log(`[Window ${idx + 1}] Local AEST: ${startStr} → ${endStr} (${iv.duration.totalHours.toFixed(2)} hours)`);
  console.log(`  Start boundary: ${result.report.explanations[idx]?.startExplanation.reason}`);
  console.log(`  End boundary:   ${result.report.explanations[idx]?.endExplanation.reason}`);
  console.log();
});
