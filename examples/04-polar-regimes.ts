/**
 * @file 04-polar-regimes.ts
 * Example 4: Polar regimes — Midnight Sun in Svalbard and Polar Night in Tromsø.
 *
 * Demonstrates:
 * - Querying continuous Midnight Sun / Polar Day (Svalbard in June: 78.22° N)
 * - Handling full-window continuous interval satisfaction without diurnal crossings
 * - Querying Polar Night (Tromsø in December: 69.65° N)
 * - Distinguishing polar regime from instantaneous twilight illumination phase
 */

import { ChronoFlux, Conditions, Instant, Duration } from '../src/index.js';

console.log('=== Example 4: High-Latitude Polar Day & Polar Night ===\n');

// 1. Svalbard (Longyearbyen, 78.22° N): Polar Day / Midnight Sun in June
const svalbard = ChronoFlux.place({
  latitude: 78.2232,
  longitude: 15.6267,
  timeZoneId: 'Arctic/Longyearbyen',
});

const juneSolstice = Instant.fromJSON('2026-06-21T00:00:00.000Z');
const svalbardWindow = ChronoFlux.interval(juneSolstice, juneSolstice.add(Duration.fromDays(3)));

console.log('[Svalbard, Norway - Summer Solstice]');
console.log(`Location: ${svalbard.latitude}° N, ${svalbard.longitude}° E`);
console.log(`Window:   ${svalbardWindow.start.toISOString()} → ${svalbardWindow.end.toISOString()}`);

// Check diurnal polar regime
const svalbardState = ChronoFlux.solar.evaluate(juneSolstice, svalbard);
console.log(`Polar Regime: ${svalbardState.polarRegime} (Midnight Sun active)`);
console.log(`Elevation at local midnight: ${svalbardState.elevationDeg.toFixed(2)}° (Well above horizon)`);

// Querying elevation >= 0° in Svalbard returns a continuous full-window interval!
const svalbardDaylight = ChronoFlux.resolve({
  place: svalbard,
  within: svalbardWindow,
  where: Conditions.solar.elevation.gte(0),
});

console.log(`Matched intervals: ${svalbardDaylight.intervals.intervals.length}`);
console.log(`Continuous daylight duration: ${svalbardDaylight.intervals.intervals[0]?.duration.totalHours} hours (Continuous full window!)\n`);

// 2. Tromsø (69.65° N): Polar Night in December
const tromso = ChronoFlux.place({
  latitude: 69.6492,
  longitude: 18.9553,
  timeZoneId: 'Europe/Oslo',
});

const decSolstice = Instant.fromJSON('2026-12-21T00:00:00.000Z');
const tromsoWindow = ChronoFlux.interval(decSolstice, decSolstice.add(Duration.fromDays(3)));

console.log('[Tromsø, Norway - Winter Solstice]');
console.log(`Location: ${tromso.latitude}° N, ${tromso.longitude}° E`);
console.log(`Window:   ${tromsoWindow.start.toISOString()} → ${tromsoWindow.end.toISOString()}`);

const tromsoState = ChronoFlux.solar.evaluate(decSolstice, tromso);
console.log(`Polar Regime: ${tromsoState.polarRegime} (Sun never rises above horizon)`);

// Query direct sunlight (elevation >= 0°): returns empty set!
const tromsoDirectSun = ChronoFlux.resolve({
  place: tromso,
  within: tromsoWindow,
  where: Conditions.solar.elevation.gte(0),
});
console.log(`Direct sunlight intervals: ${tromsoDirectSun.intervals.intervals.length} (Empty set)`);

// Query civil twilight (elevation between -6° and -0.833°): Tromsø experiences midday twilight!
const tromsoTwilight = ChronoFlux.resolve({
  place: tromso,
  within: tromsoWindow,
  where: Conditions.solar.elevation.between(-6, -0.8333),
});
console.log(`Midday twilight windows: ${tromsoTwilight.intervals.intervals.length}`);
tromsoTwilight.intervals.intervals.forEach((iv, i) => {
  console.log(`  Window ${i + 1}: ${iv.start.toISOString()} → ${iv.end.toISOString()} (${iv.duration.totalMinutes.toFixed(1)} min)`);
});
