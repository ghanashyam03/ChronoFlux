/**
 * @file resolver-algebra.test.ts
 * Test suite for algebraic composition of conditions (AND, OR, NOT) via Allen interval algebra.
 * Verifies Milestone Requirements 3, 4, and 5:
 * 3: AND composition (intersection: max(start), min(end))
 * 4: OR composition (union: earlier start to later end, contiguous merging)
 * 5: NOT / complement (exact partition of search window with zero gaps)
 */

import { describe, expect, it } from 'vitest';
import { ChronoFlux, Conditions, Instant, Interval, Place } from '../src/index.js';

describe('Phase 3B — Interval Set Algebraic Composition', () => {
  const newYork = new Place({
    latitude: 40.7128,
    longitude: -74.006,
    timeZoneId: 'America/New_York',
  });

  const threeDaysWindow = new Interval(
    Instant.fromJSON('2026-06-21T04:00:00.000Z'),
    Instant.fromJSON('2026-06-24T04:00:00.000Z')
  );

  const solarCond = Conditions.solar.elevation.gte(10);
  const civilCond = Conditions.civil.hour.between(9, 17);

  describe('Milestone 3: AND Composition', () => {
    it('opens at max(elev >= 10°, 09:00 EDT) and closes at min(elev < 10°, 17:00 EDT)', () => {
      const andCondition = Conditions.and(solarCond, civilCond);
      const result = ChronoFlux.resolve({
        place: newYork,
        within: threeDaysWindow,
        where: andCondition,
      });

      const solarResult = ChronoFlux.resolve({
        place: newYork,
        within: threeDaysWindow,
        where: solarCond,
      });

      const civilResult = ChronoFlux.resolve({
        place: newYork,
        within: threeDaysWindow,
        where: civilCond,
      });

      expect(result.intervals.intervals.length).toBe(3);

      for (let i = 0; i < 3; i++) {
        const andInterval = result.intervals.intervals[i]!;
        const solarInterval = solarResult.intervals.intervals[i]!;
        const civilInterval = civilResult.intervals.intervals[i]!;

        // start must be max(solar.start, civil.start)
        const expectedStart = solarInterval.start.isAfter(civilInterval.start)
          ? solarInterval.start
          : civilInterval.start;
        expect(andInterval.start.equals(expectedStart)).toBe(true);

        // end must be min(solar.end, civil.end)
        const expectedEnd = solarInterval.end.isBefore(civilInterval.end)
          ? solarInterval.end
          : civilInterval.end;
        expect(andInterval.end.equals(expectedEnd)).toBe(true);

        // In June in NYC, solar day begins earlier (~10:30 UTC) and ends later (~23:30 UTC) than 09:00-17:00 EDT (13:00-21:00 UTC)
        // Therefore, AND interval is bounded by civil business hours: exactly 13:00 to 21:00 UTC!
        expect(andInterval.start.toISOString().endsWith('13:00:00.000Z')).toBe(true);
        expect(andInterval.end.toISOString().endsWith('21:00:00.000Z')).toBe(true);
      }
    });
  });

  describe('Milestone 4: OR Composition', () => {
    it('spans from the earlier start to the later end, forming a single continuous interval per day', () => {
      const orCondition = Conditions.or(solarCond, civilCond);
      const result = ChronoFlux.resolve({
        place: newYork,
        within: threeDaysWindow,
        where: orCondition,
      });

      const solarResult = ChronoFlux.resolve({
        place: newYork,
        within: threeDaysWindow,
        where: solarCond,
      });

      const civilResult = ChronoFlux.resolve({
        place: newYork,
        within: threeDaysWindow,
        where: civilCond,
      });

      expect(result.intervals.intervals.length).toBe(3);

      for (let i = 0; i < 3; i++) {
        const orInterval = result.intervals.intervals[i]!;
        const solarInterval = solarResult.intervals.intervals[i]!;
        const civilInterval = civilResult.intervals.intervals[i]!;

        // start must be min(solar.start, civil.start)
        const expectedStart = solarInterval.start.isBefore(civilInterval.start)
          ? solarInterval.start
          : civilInterval.start;
        expect(orInterval.start.equals(expectedStart)).toBe(true);

        // end must be max(solar.end, civil.end)
        const expectedEnd = solarInterval.end.isAfter(civilInterval.end)
          ? solarInterval.end
          : civilInterval.end;
        expect(orInterval.end.equals(expectedEnd)).toBe(true);

        // Since solar day completely encompasses civil business hours in NYC June, OR interval equals solar interval
        expect(orInterval.start.equals(solarInterval.start)).toBe(true);
        expect(orInterval.end.equals(solarInterval.end)).toBe(true);
      }
    });
  });

  describe('Milestone 5: NOT / Complement', () => {
    it('inverts solar elevation >= 10° within 48h search window with zero gaps and zero overlaps', () => {
      const twoDaysWindow = new Interval(
        Instant.fromJSON('2026-06-21T00:00:00.000Z'),
        Instant.fromJSON('2026-06-23T00:00:00.000Z')
      );

      const positiveResult = ChronoFlux.resolve({
        place: newYork,
        within: twoDaysWindow,
        where: solarCond,
      });

      const complementResult = ChronoFlux.resolve({
        place: newYork,
        within: twoDaysWindow,
        where: Conditions.not(solarCond),
      });

      const positiveSet = positiveResult.intervals;
      const complementSet = complementResult.intervals;

      // 1. Intersection must be empty (zero overlaps)
      const intersection = positiveSet.intersect(complementSet);
      expect(intersection.isEmpty()).toBe(true);

      // 2. Union must exactly cover the search window (zero gaps)
      const union = positiveSet.union(complementSet);
      expect(union.intervals.length).toBe(1);
      expect(union.intervals[0]!.equals(twoDaysWindow)).toBe(true);

      // 3. Complement intervals represent night + low sun hours
      for (const compInterval of complementSet.intervals) {
        const midNs = (compInterval.start.epochNanoseconds + compInterval.end.epochNanoseconds) / 2n;
        const coords = ChronoFlux.solar.evaluatePosition(Instant.fromEpochNanoseconds(midNs), newYork);
        expect(coords.geometricElevationDeg).toBeLessThan(10.0 + 1e-4);
      }
    });
  });

  describe('De Morgan Laws & Boolean Invariants', () => {
    it('satisfies NOT(A AND B) == (NOT A) OR (NOT B)', () => {
      const window48h = new Interval(
        Instant.fromJSON('2026-06-21T00:00:00.000Z'),
        Instant.fromJSON('2026-06-23T00:00:00.000Z')
      );

      // Left-hand side: NOT (A AND B)
      const lhs = ChronoFlux.resolve({
        place: newYork,
        within: window48h,
        where: Conditions.not(Conditions.and(solarCond, civilCond)),
      });

      // Right-hand side: (NOT A) OR (NOT B)
      const rhs = ChronoFlux.resolve({
        place: newYork,
        within: window48h,
        where: Conditions.or(Conditions.not(solarCond), Conditions.not(civilCond)),
      });

      expect(lhs.intervals.equals(rhs.intervals)).toBe(true);
    });

    it('satisfies NOT(A OR B) == (NOT A) AND (NOT B)', () => {
      const window48h = new Interval(
        Instant.fromJSON('2026-06-21T00:00:00.000Z'),
        Instant.fromJSON('2026-06-23T00:00:00.000Z')
      );

      const lhs = ChronoFlux.resolve({
        place: newYork,
        within: window48h,
        where: Conditions.not(Conditions.or(solarCond, civilCond)),
      });

      const rhs = ChronoFlux.resolve({
        place: newYork,
        within: window48h,
        where: Conditions.and(Conditions.not(solarCond), Conditions.not(civilCond)),
      });

      expect(lhs.intervals.equals(rhs.intervals)).toBe(true);
    });
  });
});
