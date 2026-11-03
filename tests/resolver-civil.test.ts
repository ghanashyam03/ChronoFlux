/**
 * @file resolver-civil.test.ts
 * Test suite for discrete civil calendar condition solver with IANA timezone and DST support.
 * Verifies Milestone Requirement 2: civil.hour between 9 and 17 across 3 calendar days in America/New_York.
 */

import { describe, expect, it } from 'vitest';
import { ChronoFlux, Conditions, Instant, Interval, Place } from '../src/index.js';

describe('Phase 3B — Discrete Civil Condition Solver', () => {
  const newYork = new Place({
    latitude: 40.7128,
    longitude: -74.006,
    timeZoneId: 'America/New_York',
  });

  describe('Milestone 2: civil.hour between 9 and 17', () => {
    it('resolves across 3 calendar days in America/New_York with exact 13:00 UTC start and 21:00 UTC end', () => {
      // 3 calendar days in New York: June 21, June 22, June 23, 2026
      // In EDT (UTC-4), 00:00 EDT = 04:00 UTC
      const threeDaysWindow = new Interval(
        Instant.fromJSON('2026-06-21T04:00:00.000Z'),
        Instant.fromJSON('2026-06-24T04:00:00.000Z')
      );

      const condition = Conditions.civil.hour.between(9, 17);
      const result = ChronoFlux.resolve({
        place: newYork,
        within: threeDaysWindow,
        where: condition,
      });

      expect(result.intervals.intervals.length).toBe(3);

      const expectedDates = [
        { start: '2026-06-21T13:00:00.000Z', end: '2026-06-21T21:00:00.000Z' },
        { start: '2026-06-22T13:00:00.000Z', end: '2026-06-22T21:00:00.000Z' },
        { start: '2026-06-23T13:00:00.000Z', end: '2026-06-23T21:00:00.000Z' },
      ];

      for (let i = 0; i < 3; i++) {
        const interval = result.intervals.intervals[i]!;
        expect(interval.start.toISOString()).toBe(expectedDates[i]!.start);
        expect(interval.end.toISOString()).toBe(expectedDates[i]!.end);
        expect(interval.duration.totalHours).toBe(8); // exactly 8 hours duration (09:00 to 17:00)

        // Verify local civil time at boundaries
        const startState = ChronoFlux.civil.evaluate(interval.start, newYork);
        expect(startState.hour).toBe(9);
        expect(startState.minute).toBe(0);
        expect(startState.second).toBe(0);

        const endState = ChronoFlux.civil.evaluate(interval.end, newYork);
        expect(endState.hour).toBe(17);
        expect(endState.minute).toBe(0);
        expect(endState.second).toBe(0);
      }
    });

    it('resolves civil date conditions (dayOfWeek between 1 and 5 for weekdays)', () => {
      // 7 calendar days starting Sunday June 21, 2026 to Sunday June 28, 2026
      const weekWindow = new Interval(
        Instant.fromJSON('2026-06-21T04:00:00.000Z'),
        Instant.fromJSON('2026-06-28T04:00:00.000Z')
      );

      const weekdaysCondition = Conditions.civil.dayOfWeek.between(1, 5); // Monday to Friday
      const result = ChronoFlux.resolve({
        place: newYork,
        within: weekWindow,
        where: weekdaysCondition,
      });

      // Mon, Tue, Wed, Thu, Fri are consecutive and merge into a single continuous 5-day interval!
      expect(result.intervals.intervals.length).toBe(1);
      const workWeek = result.intervals.intervals[0]!;

      // Starts Monday 00:00 EDT (2026-06-22T04:00:00Z)
      expect(workWeek.start.toISOString()).toBe('2026-06-22T04:00:00.000Z');
      // Ends Saturday 00:00 EDT (2026-06-27T04:00:00Z)
      expect(workWeek.end.toISOString()).toBe('2026-06-27T04:00:00.000Z');
      expect(workWeek.duration.totalDays).toBe(5);
    });

    it('resolves discrete dayOfWeek equality (Saturdays only)', () => {
      const twoWeeksWindow = new Interval(
        Instant.fromJSON('2026-06-21T04:00:00.000Z'),
        Instant.fromJSON('2026-07-05T04:00:00.000Z')
      );

      const saturdaysOnly = Conditions.civil.dayOfWeek.eq(6);
      const result = ChronoFlux.resolve({
        place: newYork,
        within: twoWeeksWindow,
        where: saturdaysOnly,
      });

      // Exactly 2 Saturdays in the 2-week window
      expect(result.intervals.intervals.length).toBe(2);
      for (const interval of result.intervals.intervals) {
        expect(interval.duration.totalHours).toBe(24);
        const state = ChronoFlux.civil.evaluate(interval.start, newYork);
        const dayOfWeek = (new Date(Date.UTC(state.year, state.month - 1, state.day)).getUTCDay() || 7);
        expect(dayOfWeek).toBe(6);
      }
    });

    it('handles Daylight Saving Time spring-forward transition correctly', () => {
      // March 8, 2026 is US spring-forward DST transition
      const dstWindow = new Interval(
        Instant.fromJSON('2026-03-08T00:00:00.000Z'),
        Instant.fromJSON('2026-03-10T00:00:00.000Z')
      );

      const result = ChronoFlux.resolve({
        place: newYork,
        within: dstWindow,
        where: Conditions.civil.hour.between(9, 17),
      });

      expect(result.intervals.intervals.length).toBe(2);
      for (const interval of result.intervals.intervals) {
        const startState = ChronoFlux.civil.evaluate(interval.start, newYork);
        expect(startState.hour).toBe(9);
        const endState = ChronoFlux.civil.evaluate(interval.end, newYork);
        expect(endState.hour).toBe(17);
      }
    });

    it('resolves civil hours across different IANA timezones (Tokyo, London)', () => {
      const tokyo = new Place({
        latitude: 35.68,
        longitude: 139.76,
        timeZoneId: 'Asia/Tokyo',
      });

      const singleDayTokyo = new Interval(
        Instant.fromJSON('2026-06-21T00:00:00.000Z'),
        Instant.fromJSON('2026-06-22T00:00:00.000Z')
      );

      const result = ChronoFlux.resolve({
        place: tokyo,
        within: singleDayTokyo,
        where: Conditions.civil.hour.between(9, 17),
      });

      // Tokyo is UTC+9, so 09:00 JST = 00:00 UTC, 17:00 JST = 08:00 UTC
      expect(result.intervals.intervals.length).toBeGreaterThanOrEqual(1);
      const match = result.intervals.intervals[0]!;
      const state = ChronoFlux.civil.evaluate(match.start, tokyo);
      expect(state.hour).toBe(9);
    });

    it('resolves hour operators (gte, gt, lte, lt, eq, in)', () => {
      const singleDay = new Interval(
        Instant.fromJSON('2026-06-21T04:00:00.000Z'),
        Instant.fromJSON('2026-06-22T04:00:00.000Z')
      );

      const gte18 = ChronoFlux.resolve({
        place: newYork,
        within: singleDay,
        where: Conditions.civil.hour.gte(18),
      });
      expect(gte18.intervals.intervals.length).toBe(1);
      expect(gte18.intervals.intervals[0]!.duration.totalHours).toBe(6); // 18:00 to 24:00

      const gt18 = ChronoFlux.resolve({
        place: newYork,
        within: singleDay,
        where: Conditions.civil.hour.gt(18),
      });
      expect(gt18.intervals.intervals.length).toBe(1);
      expect(gt18.intervals.intervals[0]!.duration.totalHours).toBe(5); // 19:00 to 24:00

      const lt9 = ChronoFlux.resolve({
        place: newYork,
        within: singleDay,
        where: Conditions.civil.hour.lt(9),
      });
      expect(lt9.intervals.intervals.length).toBe(1);
      expect(lt9.intervals.intervals[0]!.duration.totalHours).toBe(9); // 00:00 to 09:00

      const lte9 = ChronoFlux.resolve({
        place: newYork,
        within: singleDay,
        where: Conditions.civil.hour.lte(9),
      });
      expect(lte9.intervals.intervals.length).toBe(1);
      expect(lte9.intervals.intervals[0]!.duration.totalHours).toBe(10); // 00:00 to 10:00

      const eq12 = ChronoFlux.resolve({
        place: newYork,
        within: singleDay,
        where: Conditions.civil.hour.eq(12),
      });
      expect(eq12.intervals.intervals.length).toBe(1);
      expect(eq12.intervals.intervals[0]!.duration.totalHours).toBe(1); // 12:00 to 13:00

      const inHours = ChronoFlux.resolve({
        place: newYork,
        within: singleDay,
        where: Conditions.civil.hour.in([9, 13, 17]),
      });
      expect(inHours.intervals.intervals.length).toBe(3);
    });

    it('resolves month, year, day, and isDaylightSaving conditions', () => {
      const singleDay = new Interval(
        Instant.fromJSON('2026-06-21T04:00:00.000Z'),
        Instant.fromJSON('2026-06-22T04:00:00.000Z')
      );

      const juneMatch = ChronoFlux.resolve({
        place: newYork,
        within: singleDay,
        where: Conditions.civil.month.eq(6),
      });
      expect(juneMatch.intervals.intervals.length).toBe(1);

      const decMatch = ChronoFlux.resolve({
        place: newYork,
        within: singleDay,
        where: Conditions.civil.month.eq(12),
      });
      expect(decMatch.intervals.isEmpty()).toBe(true);

      const year2026 = ChronoFlux.resolve({
        place: newYork,
        within: singleDay,
        where: Conditions.civil.year.eq(2026),
      });
      expect(year2026.intervals.intervals.length).toBe(1);

      const day21 = ChronoFlux.resolve({
        place: newYork,
        within: singleDay,
        where: Conditions.civil.day.eq(21),
      });
      expect(day21.intervals.intervals.length).toBe(1);

      const isDst = ChronoFlux.resolve({
        place: newYork,
        within: singleDay,
        where: Conditions.civil.isDaylightSaving.eq(true),
      });
      expect(isDst.intervals.intervals.length).toBe(1);
    });
  });
});
