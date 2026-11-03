/**
 * @file 05-dst-recurring.ts
 * Example 5: DST fall-back repeated-hour resolution and recurring schedules.
 *
 * Demonstrates:
 * - Handling Daylight Saving Time transition days in America/New_York (Nov 1, 2026)
 * - Resolving ambiguous wall-clock hour queries (hour == 1) during the fall-back shift
 * - Synthesizing both physical occurrences of the repeated hour into canonical intervals
 * - Disambiguating specific instances via Conditions.civil.isDaylightSaving
 */

import { ChronoFlux, Conditions, Instant, Duration } from '../src/index.js';

console.log('=== Example 5: DST Fall-Back Repeated-Hour Resolution ===\n');

// 1. Observer: New York (America/New_York)
const nyc = ChronoFlux.place({
  latitude: 40.7128,
  longitude: -74.006,
  timeZoneId: 'America/New_York',
});

// 2. Search window: The entire 24+1 hour transition day of Nov 1, 2026
// Clocks fall back from 02:00 EDT to 01:00 EST. The day is 25 hours long!
const transitionDayStart = Instant.fromJSON('2026-11-01T04:00:00.000Z'); // 00:00 EDT
const transitionDayEnd = Instant.fromJSON('2026-11-02T05:00:00.000Z');   // 00:00 EST next day
const window = ChronoFlux.interval(transitionDayStart, transitionDayEnd);

console.log(`Location: New York (${nyc.timeZoneId})`);
console.log(`Window:   ${window.start.toISOString()} → ${window.end.toISOString()}`);
console.log(`Duration: ${window.duration.totalHours} hours (25-hour fall-back day)\n`);

// 3. Query: civil.hour == 1 (Wall-clock 01:00 - 02:00)
// On this day, 01:00 to 02:00 happens TWICE:
// - Occurrence 1: 01:00 - 02:00 EDT (UTC-4) -> 05:00 - 06:00 UTC
// - Occurrence 2: 01:00 - 02:00 EST (UTC-5) -> 06:00 - 07:00 UTC
const hour1Query = Conditions.civil.hour.eq(1);

const result = ChronoFlux.resolve({
  place: nyc,
  within: window,
  where: hour1Query,
});

console.log(`Query "civil.hour == 1" produced ${result.intervals.intervals.length} distinct continuous intervals:`);
result.intervals.intervals.forEach((iv, i) => {
  const startState = ChronoFlux.civil.evaluate(iv.start, nyc);
  const endState = ChronoFlux.civil.evaluate(iv.end, nyc);
  console.log(`  [Instance ${i + 1}] UTC: ${iv.start.toISOString()} → ${iv.end.toISOString()} (${iv.duration.totalHours}h)`);
  console.log(`    Local: ${startState.hour}:00 (${startState.isDaylightSaving ? 'EDT (UTC-4)' : 'EST (UTC-5)'}) → ${endState.hour}:00`);
});
console.log();

// 4. Disambiguation: Select ONLY the Daylight Saving occurrence
const edtOnly = ChronoFlux.resolve({
  place: nyc,
  within: window,
  where: Conditions.and(
    Conditions.civil.hour.eq(1),
    Conditions.civil.isDaylightSaving.eq(true)
  ),
});

console.log(`Query "civil.hour == 1 AND isDaylightSaving == true":`);
console.log(`  Matched: ${edtOnly.intervals.intervals.length} interval`);
console.log(`  UTC:     ${edtOnly.intervals.intervals[0]?.start.toISOString()} → ${edtOnly.intervals.intervals[0]?.end.toISOString()}`);
