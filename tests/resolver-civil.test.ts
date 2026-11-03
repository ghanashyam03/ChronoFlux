/**
 * @file resolver-civil.test.ts
 * Test suite for discrete civil calendar condition solver with IANA timezone and DST support.
 * Verifies Milestone Requirement 2: civil.hour between 9 and 17 across 3 calendar days in America/New_York.
 */

import { describe, expect, it } from 'vitest';
import { ChronoFlux, Conditions, Instant, Interval, Place, TimeZoneLookupProvider } from '../src/index.js';

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

    it('resolves civil minute queries correctly (between, eq, gte, lt) and composes with hour', () => {
      const twoHourWindow = new Interval(
        Instant.fromJSON('2026-06-21T13:00:00.000Z'), // 09:00 EDT
        Instant.fromJSON('2026-06-21T15:00:00.000Z')  // 11:00 EDT
      );

      // 1. minute between 0 and 30: exactly 2 half-hour intervals (09:00-09:30 and 10:00-10:30)
      const minBetween = ChronoFlux.resolve({
        place: newYork,
        within: twoHourWindow,
        where: Conditions.civil.minute.between(0, 30),
      });
      expect(minBetween.intervals.intervals.length).toBe(2);
      expect(minBetween.intervals.intervals[0]!.duration.totalMinutes).toBe(30);
      expect(minBetween.intervals.intervals[1]!.duration.totalMinutes).toBe(30);

      // 2. minute.eq(15): exactly 2 1-minute intervals (09:15-09:16 and 10:15-10:16)
      const minEq = ChronoFlux.resolve({
        place: newYork,
        within: twoHourWindow,
        where: Conditions.civil.minute.eq(15),
      });
      expect(minEq.intervals.intervals.length).toBe(2);
      expect(minEq.intervals.intervals[0]!.duration.totalMinutes).toBe(1);

      // 3. Composition: civil.hour == 9 AND civil.minute between 15 and 45 -> [09:15, 09:45)
      const compound = ChronoFlux.resolve({
        place: newYork,
        within: twoHourWindow,
        where: Conditions.and(
          Conditions.civil.hour.eq(9),
          Conditions.civil.minute.between(15, 45)
        ),
      });
      expect(compound.intervals.intervals.length).toBe(1);
      const resInterval = compound.intervals.intervals[0]!;
      expect(resInterval.duration.totalMinutes).toBe(30);
      expect(resInterval.start.toISOString()).toBe('2026-06-21T13:15:00.000Z');
      expect(resInterval.end.toISOString()).toBe('2026-06-21T13:45:00.000Z');
    });

    it('resolves civil second queries and rejects windows exceeding 2 days', () => {
      const tenMinWindow = new Interval(
        Instant.fromJSON('2026-06-21T13:00:00.000Z'),
        Instant.fromJSON('2026-06-21T13:10:00.000Z')
      );

      const secBetween = ChronoFlux.resolve({
        place: newYork,
        within: tenMinWindow,
        where: Conditions.civil.second.between(0, 30),
      });
      expect(secBetween.intervals.intervals.length).toBe(10);
      for (const iv of secBetween.intervals.intervals) {
        expect(iv.duration.totalSeconds).toBe(30);
      }

      // Rejects window > 2 days for second property
      const largeWindow = new Interval(
        Instant.fromJSON('2026-06-21T00:00:00.000Z'),
        Instant.fromJSON('2026-06-25T00:00:00.000Z')
      );
      expect(() =>
        ChronoFlux.resolve({
          place: newYork,
          within: largeWindow,
          where: Conditions.civil.second.eq(0),
        })
      ).toThrow(RangeError);
    });

    it('resolves hour.neq and hour.between up to 24 without RangeError', () => {
      const singleDay = new Interval(
        Instant.fromJSON('2026-06-21T04:00:00.000Z'), // 00:00 EDT
        Instant.fromJSON('2026-06-22T04:00:00.000Z')  // 24:00 EDT
      );

      // 1. hour.neq(12): excludes 12:00-13:00, producing two intervals: [00:00, 12:00) and [13:00, 24:00)
      const neq12 = ChronoFlux.resolve({
        place: newYork,
        within: singleDay,
        where: Conditions.civil.hour.neq(12),
      });
      expect(neq12.intervals.intervals.length).toBe(2);
      expect(neq12.intervals.intervals[0]!.duration.totalHours).toBe(12);
      expect(neq12.intervals.intervals[1]!.duration.totalHours).toBe(11);

      // 2. hour.between(9, 24): from 09:00 to 24:00 (15 hours)
      const upTo24 = ChronoFlux.resolve({
        place: newYork,
        within: singleDay,
        where: Conditions.civil.hour.between(9, 24),
      });
      expect(upTo24.intervals.intervals.length).toBe(1);
      expect(upTo24.intervals.intervals[0]!.duration.totalHours).toBe(15);
      expect(upTo24.intervals.intervals[0]!.end.toISOString()).toBe('2026-06-22T04:00:00.000Z');
    });

    it('resolves DST transition accurately across transition boundaries', () => {
      // Spring forward in New York: March 8, 2026 (02:00 EDT skipped, clocks jump to 03:00 EDT)
      const transitionWindow = new Interval(
        Instant.fromJSON('2026-03-08T00:00:00.000Z'),
        Instant.fromJSON('2026-03-09T00:00:00.000Z')
      );

      const dstOn = ChronoFlux.resolve({
        place: newYork,
        within: transitionWindow,
        where: Conditions.civil.isDaylightSaving.eq(true),
      });

      // DST begins during March 8 (at 07:00 UTC = 03:00 EDT)
      expect(dstOn.intervals.intervals.length).toBe(1);
      const dstInterval = dstOn.intervals.intervals[0]!;
      expect(dstInterval.start.toISOString()).toBe('2026-03-08T07:00:00.000Z');
      expect(dstInterval.end.toISOString()).toBe('2026-03-09T00:00:00.000Z');
    });

    it('enforces timezone contract: rejects Place without timeZoneId when civil condition is evaluated without provider', () => {
      const placeNoTz = new Place({
        latitude: 40.7128,
        longitude: -74.006,
      });
      const window = new Interval(
        Instant.fromJSON('2026-06-21T00:00:00.000Z'),
        Instant.fromJSON('2026-06-22T00:00:00.000Z')
      );
      expect(() =>
        ChronoFlux.resolve({
          place: placeNoTz,
          within: window,
          where: Conditions.civil.hour.between(9, 17),
        })
      ).toThrow(
        new TypeError(
          'Civil condition resolution requires an explicit timeZoneId on Place or a registered geographic timezone lookup provider'
        )
      );
    });

    it('resolves civil condition on Place without timeZoneId when registered geographic provider supplies it', () => {
      const placeNoTz = new Place({
        latitude: 40.7128,
        longitude: -74.006,
      });
      const window = new Interval(
        Instant.fromJSON('2026-06-21T04:00:00.000Z'),
        Instant.fromJSON('2026-06-22T04:00:00.000Z')
      );

      const mockProvider: TimeZoneLookupProvider = {
        lookup(lat: number, lon: number): string {
          if (Math.abs(lat - 40.7128) < 1 && Math.abs(lon - (-74.006)) < 1) {
            return 'America/New_York';
          }
          return 'UTC';
        },
      };

      try {
        ChronoFlux.civil.registerTimeZoneLookupProvider(mockProvider);
        const result = ChronoFlux.resolve({
          place: placeNoTz,
          within: window,
          where: Conditions.civil.hour.between(9, 17),
        });
        expect(result.intervals.intervals.length).toBe(1);
        expect(result.intervals.intervals[0]!.start.toISOString()).toBe('2026-06-21T13:00:00.000Z');
        expect(result.intervals.intervals[0]!.end.toISOString()).toBe('2026-06-21T21:00:00.000Z');
      } finally {
        ChronoFlux.civil.registerTimeZoneLookupProvider(null);
      }
    });

    describe('DST Fall-Back Repeated-Hour Correctness (Nov 1, 2026 in America/New_York)', () => {
      // On Nov 1, 2026 in America/New_York:
      // Clocks fall back at 02:00 EDT (06:00 UTC) to 01:00 EST (UTC-5).
      // Hour 01:00 occurs twice:
      // - 1st occurrence (EDT, UTC-4): 05:00 UTC to 06:00 UTC (isDaylightSaving = true)
      // - 2nd occurrence (EST, UTC-5): 06:00 UTC to 07:00 UTC (isDaylightSaving = false)
      const repeatedHourWindow = new Interval(
        Instant.fromJSON('2026-11-01T04:00:00.000Z'), // 00:00 EDT
        Instant.fromJSON('2026-11-01T08:00:00.000Z')  // 03:00 EST
      );

      it('synthesizes both occurrences of hour == 1 into a canonical 2-hour interval', () => {
        const result = ChronoFlux.resolve({
          place: newYork,
          within: repeatedHourWindow,
          where: Conditions.civil.hour.eq(1),
        });

        // The two consecutive 1-hour occurrences [05:00Z, 06:00Z) and [06:00Z, 07:00Z)
        // merge into a single canonical 2-hour interval [05:00Z, 07:00Z)
        expect(result.intervals.intervals.length).toBe(1);
        const interval = result.intervals.intervals[0]!;
        expect(interval.start.toISOString()).toBe('2026-11-01T05:00:00.000Z');
        expect(interval.end.toISOString()).toBe('2026-11-01T07:00:00.000Z');
        expect(interval.duration.totalHours).toBe(2);
      });

      it('synthesizes both occurrences of minute == 15 as distinct disjoint intervals', () => {
        // Narrow window covering just the repeated hour (05:00Z to 07:00Z)
        const twoHourWindow = new Interval(
          Instant.fromJSON('2026-11-01T05:00:00.000Z'),
          Instant.fromJSON('2026-11-01T07:00:00.000Z')
        );

        const result = ChronoFlux.resolve({
          place: newYork,
          within: twoHourWindow,
          where: Conditions.civil.minute.eq(15),
        });

        // 01:15 occurs twice:
        // 1st: 01:15 EDT = 05:15 UTC to 05:16 UTC
        // 2nd: 01:15 EST = 06:15 UTC to 06:16 UTC
        expect(result.intervals.intervals.length).toBe(2);
        expect(result.intervals.intervals[0]!.start.toISOString()).toBe('2026-11-01T05:15:00.000Z');
        expect(result.intervals.intervals[0]!.end.toISOString()).toBe('2026-11-01T05:16:00.000Z');
        expect(result.intervals.intervals[1]!.start.toISOString()).toBe('2026-11-01T06:15:00.000Z');
        expect(result.intervals.intervals[1]!.end.toISOString()).toBe('2026-11-01T06:16:00.000Z');
      });

      it('synthesizes both occurrences of second == 30 across the repeated hour', () => {
        // Window from 05:15Z to 06:16Z (duration ~1 hour, well within 2-day limit for second queries)
        const subWindow = new Interval(
          Instant.fromJSON('2026-11-01T05:15:00.000Z'),
          Instant.fromJSON('2026-11-01T06:16:00.000Z')
        );

        const result = ChronoFlux.resolve({
          place: newYork,
          within: subWindow,
          where: Conditions.civil.second.eq(30),
        });

        // Synthesizes 01:15:30 EDT and 01:15:30 EST
        const matches = result.intervals.intervals.filter(
          (iv) =>
            iv.start.toISOString() === '2026-11-01T05:15:30.000Z' ||
            iv.start.toISOString() === '2026-11-01T06:15:30.000Z'
        );
        expect(matches.length).toBe(2);
        expect(matches[0]!.duration.totalSeconds).toBe(1);
        expect(matches[1]!.duration.totalSeconds).toBe(1);
      });

      it('disambiguates repeated-hour queries via AND/OR boolean composition', () => {
        const twoHourWindow = new Interval(
          Instant.fromJSON('2026-11-01T05:00:00.000Z'),
          Instant.fromJSON('2026-11-01T07:00:00.000Z')
        );

        // 1. minute == 15 AND isDaylightSaving == true -> ONLY EDT occurrence
        const edtOnly = ChronoFlux.resolve({
          place: newYork,
          within: twoHourWindow,
          where: Conditions.and(
            Conditions.civil.minute.eq(15),
            Conditions.civil.isDaylightSaving.eq(true)
          ),
        });
        expect(edtOnly.intervals.intervals.length).toBe(1);
        expect(edtOnly.intervals.intervals[0]!.start.toISOString()).toBe('2026-11-01T05:15:00.000Z');

        // 2. minute == 15 AND isDaylightSaving == false -> ONLY EST occurrence
        const estOnly = ChronoFlux.resolve({
          place: newYork,
          within: twoHourWindow,
          where: Conditions.and(
            Conditions.civil.minute.eq(15),
            Conditions.civil.isDaylightSaving.eq(false)
          ),
        });
        expect(estOnly.intervals.intervals.length).toBe(1);
        expect(estOnly.intervals.intervals[0]!.start.toISOString()).toBe('2026-11-01T06:15:00.000Z');

        // 3. minute == 15 OR minute == 30 -> 4 occurrences (2 for EDT, 2 for EST)
        const orQuery = ChronoFlux.resolve({
          place: newYork,
          within: twoHourWindow,
          where: Conditions.or(
            Conditions.civil.minute.eq(15),
            Conditions.civil.minute.eq(30)
          ),
        });
        expect(orQuery.intervals.intervals.length).toBe(4);
        expect(orQuery.intervals.intervals[0]!.start.toISOString()).toBe('2026-11-01T05:15:00.000Z');
        expect(orQuery.intervals.intervals[1]!.start.toISOString()).toBe('2026-11-01T05:30:00.000Z');
        expect(orQuery.intervals.intervals[2]!.start.toISOString()).toBe('2026-11-01T06:15:00.000Z');
        expect(orQuery.intervals.intervals[3]!.start.toISOString()).toBe('2026-11-01T06:30:00.000Z');
      });
    });
  });
});
