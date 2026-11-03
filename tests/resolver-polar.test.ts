/**
 * @file resolver-polar.test.ts
 * Test suite for multi-day consistency and polar day / polar night resolution.
 * Verifies Milestone Requirements 6 and 7:
 * 6: Multi-day consistency (7 days in Tokyo with monotonic solar noon progression)
 * 7: Polar day (Svalbard in June) & Polar night (Tromsø in December) behavior
 */

import { describe, expect, it } from 'vitest';
import { ChronoFlux, Conditions, Instant, Interval, Place } from '../src/index.js';

describe('Phase 3B — Multi-Day Consistency and Polar Day/Night', () => {
  describe('Milestone 6: Multi-Day Consistency (Tokyo)', () => {
    it('resolves over 7 days in Tokyo with exactly 7 daily intervals and monotonic solar noon progression', () => {
      const tokyo = new Place({
        latitude: 35.68,
        longitude: 139.76,
        timeZoneId: 'Asia/Tokyo',
      });

      // 7 calendar days in Tokyo (June 21 to June 28, 2026)
      const sevenDaysWindow = new Interval(
        Instant.fromJSON('2026-06-20T15:00:00.000Z'), // June 21 00:00 JST
        Instant.fromJSON('2026-06-27T15:00:00.000Z')  // June 28 00:00 JST
      );

      const condition = Conditions.solar.elevation.gte(15);
      const result = ChronoFlux.resolve({
        place: tokyo,
        within: sevenDaysWindow,
        where: condition,
      });

      // Exactly 7 daily intervals
      expect(result.intervals.intervals.length).toBe(7);

      let prevNoonNs = 0n;
      for (let day = 0; day < 7; day++) {
        const interval = result.intervals.intervals[day]!;

        // Each interval is ~11 to 13 hours
        expect(interval.duration.totalHours).toBeGreaterThan(10.0);
        expect(interval.duration.totalHours).toBeLessThan(14.0);

        // Calculate solar noon during this interval
        const midNs = (interval.start.epochNanoseconds + interval.end.epochNanoseconds) / 2n;
        const noon = ChronoFlux.solar.nextEvent({
          event: 'solarNoon',
          place: tokyo,
          after: interval.start,
        });

        expect(noon).not.toBeNull();
        expect(interval.contains(noon!)).toBe(true);

        // Verify strictly monotonic progression of daily solar noons
        if (day > 0) {
          expect(noon!.epochNanoseconds).toBeGreaterThan(prevNoonNs);
          // Solar noon step is ~24 hours (within 1 minute variation)
          const noonDiffSec = Number(noon!.epochNanoseconds - prevNoonNs) / 1_000_000_000;
          expect(Math.abs(noonDiffSec - 86400)).toBeLessThan(60);
        }
        prevNoonNs = noon!.epochNanoseconds;

        // Verify residual at crossings < 1e-5°
        const startCoords = ChronoFlux.solar.evaluatePosition(interval.start, tokyo);
        expect(Math.abs(startCoords.geometricElevationDeg - 15.0)).toBeLessThan(1e-5);

        const endCoords = ChronoFlux.solar.evaluatePosition(interval.end, tokyo);
        expect(Math.abs(endCoords.geometricElevationDeg - 15.0)).toBeLessThan(1e-5);
      }
    });
  });

  describe('Milestone 7: Polar Day & Polar Night Behavior', () => {
    it('returns an uninterrupted continuous full-window interval for Midnight Sun in Svalbard', () => {
      // Svalbard (Longyearbyen): 78.22°N, 15.65°E
      const svalbard = new Place({
        latitude: 78.22,
        longitude: 15.65,
        elevationMeters: 20,
        timeZoneId: 'Arctic/Longyearbyen',
      });

      // 4 days during Midnight Sun (June 21 to June 25, 2026)
      const polarDayWindow = new Interval(
        Instant.fromJSON('2026-06-21T00:00:00.000Z'),
        Instant.fromJSON('2026-06-25T00:00:00.000Z')
      );

      // In Svalbard in June, the sun never sets: geometric elevation >= -0.833° holds continuously
      const midnightSunResult = ChronoFlux.resolve({
        place: svalbard,
        within: polarDayWindow,
        where: Conditions.solar.isDirectSunlight.eq(true),
      });

      // Must be an uninterrupted continuous single interval covering the entire search window!
      expect(midnightSunResult.intervals.intervals.length).toBe(1);
      const continuousInterval = midnightSunResult.intervals.intervals[0]!;
      expect(continuousInterval.equals(polarDayWindow)).toBe(true);

      // Both boundaries must be window clamps
      expect(midnightSunResult.report.explanations[0]!.startExplanation.model).toBe('window');
      expect(midnightSunResult.report.explanations[0]!.endExplanation.model).toBe('window');
    });

    it('solves midday elevation crossings correctly in Svalbard when threshold is above midnight sun nadir', () => {
      const svalbard = new Place({
        latitude: 78.22,
        longitude: 15.65,
        elevationMeters: 20,
        timeZoneId: 'Arctic/Longyearbyen',
      });

      const polarDayWindow = new Interval(
        Instant.fromJSON('2026-06-21T00:00:00.000Z'),
        Instant.fromJSON('2026-06-24T00:00:00.000Z')
      );

      // In Svalbard on June 21, noon elevation is ~35.2°, midnight nadir is ~11.7°.
      // A threshold of 25° is crossed each midday!
      const middayResult = ChronoFlux.resolve({
        place: svalbard,
        within: polarDayWindow,
        where: Conditions.solar.elevation.gte(25),
      });

      expect(middayResult.intervals.intervals.length).toBe(3);
      for (const interval of middayResult.intervals.intervals) {
        const startCoords = ChronoFlux.solar.evaluatePosition(interval.start, svalbard);
        expect(Math.abs(startCoords.geometricElevationDeg - 25.0)).toBeLessThan(1e-5);

        const endCoords = ChronoFlux.solar.evaluatePosition(interval.end, svalbard);
        expect(Math.abs(endCoords.geometricElevationDeg - 25.0)).toBeLessThan(1e-5);
      }
    });

    it('returns empty IntervalSet for Polar Night in Tromsø in December', () => {
      // Tromsø: 69.65°N, 18.96°E
      const tromso = new Place({
        latitude: 69.65,
        longitude: 18.96,
        elevationMeters: 10,
        timeZoneId: 'Europe/Oslo',
      });

      // 4 days during Polar Night (December 20 to December 24, 2026)
      const polarNightWindow = new Interval(
        Instant.fromJSON('2026-12-20T00:00:00.000Z'),
        Instant.fromJSON('2026-12-24T00:00:00.000Z')
      );

      // In Tromsø in late December, max elevation is ~ -3.1° (below horizon)
      // elevation >= 10° is impossible anywhere in this window
      const result = ChronoFlux.resolve({
        place: tromso,
        within: polarNightWindow,
        where: Conditions.solar.elevation.gte(10),
      });

      expect(result.intervals.isEmpty()).toBe(true);
      expect(result.intervals.intervals.length).toBe(0);
      expect(result.report.totalMatchesFound).toBe(0);

      // Direct sunlight also returns empty
      const directSunResult = ChronoFlux.resolve({
        place: tromso,
        within: polarNightWindow,
        where: Conditions.solar.isDirectSunlight.eq(true),
      });
      expect(directSunResult.intervals.isEmpty()).toBe(true);
    });

    it('resolves polarRegime conditions matching full window', () => {
      const svalbard = new Place({
        latitude: 78.22,
        longitude: 15.65,
        timeZoneId: 'Arctic/Longyearbyen',
      });

      const juneWindow = new Interval(
        Instant.fromJSON('2026-06-21T00:00:00.000Z'),
        Instant.fromJSON('2026-06-23T00:00:00.000Z')
      );

      const regimeResult = ChronoFlux.resolve({
        place: svalbard,
        within: juneWindow,
        where: Conditions.solar.polarRegime.eq('polar_day'),
      });

      expect(regimeResult.intervals.intervals.length).toBe(1);
      expect(regimeResult.intervals.intervals[0]!.equals(juneWindow)).toBe(true);
    });
  });
});
