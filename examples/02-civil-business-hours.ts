/**
 * @file 02-civil-business-hours.ts
 * Example 2: Resolving local business hours (civil hour between 9 and 17 on weekdays).
 *
 * Demonstrates:
 * - Observer place setup with IANA timezone (London, UK)
 * - Resolving civil hour between 9 and 17 (09:00 to 17:00)
 * - Combining with weekdays condition (dayOfWeek between 1 and 5)
 * - Exact half-open [09:00, 17:00) interval boundaries
 */

import { Time, Conditions, Instant, Duration } from '../src/index.js';

// 1. Observer: London, United Kingdom
const london = Time.place({
  latitude: 51.5074,
  longitude: -0.1278,
  timeZoneId: 'Europe/London',
});

// 2. Search window: 1 full calendar week (Monday to Sunday in June 2026)
const start = Instant.fromJSON('2026-06-15T00:00:00.000Z'); // Monday 01:00 BST
const window = Time.interval(start, start.add(Duration.fromDays(7)));

console.log('=== Example 2: Resolving Business Hours (09:00 - 17:00 Weekdays) ===');
console.log(`Observer: London (${london.timeZoneId})`);
console.log(`Window:   ${window.start.toISOString()} → ${window.end.toISOString()}\n`);

// 3. Declare condition: hour between 9 and 17 AND weekday (Monday to Friday)
const businessHours = Conditions.and(
  Conditions.civil.hour.between(9, 17),
  Conditions.civil.dayOfWeek.between(1, 5)
);

// 4. Resolve intervals
const result = Time.resolve({
  place: london,
  within: window,
  where: businessHours,
  policy: 'all',
});

console.log(`Found ${result.intervals.intervals.length} business shifts (Monday - Friday):\n`);

result.intervals.intervals.forEach((iv, idx) => {
  const localStart = Time.civil.evaluate(iv.start, london);
  const localEnd = Time.civil.evaluate(iv.end, london);
  const dateStr = `${localStart.year}-${localStart.month.toString().padStart(2, '0')}-${localStart.day.toString().padStart(2, '0')}`;
  const startStr = `${localStart.hour.toString().padStart(2, '0')}:${localStart.minute.toString().padStart(2, '0')}`;
  const endStr = `${localEnd.hour.toString().padStart(2, '0')}:${localEnd.minute.toString().padStart(2, '0')}`;

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayName = days[new Date(Date.UTC(localStart.year, localStart.month - 1, localStart.day)).getUTCDay()];

  console.log(`[Shift ${idx + 1}] ${dateStr} (${dayName})`);
  console.log(`  Local BST: ${startStr} → ${endStr} (${iv.duration.totalHours} hours)`);
  console.log(`  UTC Range: ${iv.start.toISOString()} → ${iv.end.toISOString()}`);
  console.log();
});
