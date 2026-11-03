/**
 * @file resolver-intent.test.ts
 * Test suite for temporal intent policy selection ('all', 'earliest', 'latest', 'longest'),
 * minDuration constraint filtering, and detailed ResolutionReport boundary explanations.
 * Verifies Milestone Requirement 8: Useful explanation of every resolved boundary in ResolutionReport.
 */

import { describe, expect, it } from 'vitest';
import { ChronoFlux, Conditions, Duration, Instant, Interval, Place } from '../src/index.js';

describe('Phase 3C — Temporal Intent Policies & Resolution Reports', () => {
  const newYork = new Place({
    latitude: 40.7128,
    longitude: -74.006,
    timeZoneId: 'America/New_York',
  });

  const fourDaysWindow = new Interval(
    Instant.fromJSON('2026-06-21T04:00:00.000Z'),
    Instant.fromJSON('2026-06-25T04:00:00.000Z')
  );

  const businessHours = Conditions.civil.hour.between(9, 17);

  describe('1. Selection Policies (earliest, latest, longest, all)', () => {
    it('returns all matching intervals by default ("all")', () => {
      const result = ChronoFlux.resolve({
        place: newYork,
        within: fourDaysWindow,
        where: businessHours,
      });

      expect(result.intervals.intervals.length).toBe(4);
      expect(result.allMatchingIntervals.intervals.length).toBe(4);
    });

    it('returns the earliest matching interval with policy="earliest"', () => {
      const result = ChronoFlux.resolve({
        place: newYork,
        within: fourDaysWindow,
        where: businessHours,
        policy: 'earliest',
      });

      expect(result.intervals.intervals.length).toBe(1);
      expect(result.allMatchingIntervals.intervals.length).toBe(4);
      expect(result.intervals.intervals[0]!.equals(result.allMatchingIntervals.intervals[0]!)).toBe(true);
    });

    it('returns the latest matching interval with policy="latest"', () => {
      const result = ChronoFlux.resolve({
        place: newYork,
        within: fourDaysWindow,
        where: businessHours,
        policy: 'latest',
      });

      expect(result.intervals.intervals.length).toBe(1);
      expect(result.allMatchingIntervals.intervals.length).toBe(4);
      expect(result.intervals.intervals[0]!.equals(result.allMatchingIntervals.intervals[3]!)).toBe(true);
    });

    it('returns the longest matching interval with policy="longest"', () => {
      // Window covering a partial day, a full day, and another partial day
      const unevenWindow = new Interval(
        Instant.fromJSON('2026-06-21T18:00:00.000Z'), // partial (21:00 ends it, so 3h)
        Instant.fromJSON('2026-06-23T15:00:00.000Z')  // day 2 is full 8h (13:00 to 21:00), day 3 is 2h (13:00 to 15:00)
      );

      const result = ChronoFlux.resolve({
        place: newYork,
        within: unevenWindow,
        where: businessHours,
        policy: 'longest',
      });

      expect(result.intervals.intervals.length).toBe(1);
      expect(result.intervals.intervals[0]!.duration.totalHours).toBe(8);
      expect(result.intervals.intervals[0]!.start.toISOString()).toBe('2026-06-22T13:00:00.000Z');
    });

    it('filters intervals shorter than minDuration', () => {
      // Create a search window with short partial intervals at endpoints
      const window = new Interval(
        Instant.fromJSON('2026-06-21T19:00:00.000Z'), // 2 hours remaining today (until 21:00)
        Instant.fromJSON('2026-06-23T04:00:00.000Z')  // day 2 has full 8 hours
      );

      // Filter with minDuration = 4 hours: only the 8-hour interval survives
      const result = ChronoFlux.resolve({
        place: newYork,
        within: window,
        where: businessHours,
        minDuration: ChronoFlux.duration.hours(4),
      });

      expect(result.allMatchingIntervals.intervals.length).toBe(2);
      expect(result.intervals.intervals.length).toBe(1);
      expect(result.intervals.intervals[0]!.duration.totalHours).toBe(8);
    });
  });

  describe('Milestone 8: ResolutionReport Boundary Provenance', () => {
    it('documents query, modelsConsulted, boundary explanations, residuals, and execution metadata', () => {
      const officeSolar = Conditions.and(
        Conditions.solar.elevation.gte(10),
        Conditions.civil.hour.between(9, 17)
      );

      const result = ChronoFlux.resolve({
        place: newYork,
        within: fourDaysWindow,
        where: officeSolar,
      });

      const { report } = result;

      // 1. Query string
      expect(report.query).toContain('solar.elevation >= 10°');
      expect(report.query).toContain('civil.hour between 9 and 17');
      expect(report.query).toContain('AND');

      // 2. Search window and place
      expect(report.searchWindow.equals(fourDaysWindow)).toBe(true);
      expect(report.place).toBe(newYork);

      // 3. Models consulted
      expect(report.modelsConsulted).toContain('solar');
      expect(report.modelsConsulted).toContain('civil');

      // 4. Accuracy and execution metadata
      expect(report.accuracy.solarNumericalToleranceDeg).toBe(1e-5);
      expect(report.accuracy.isWithinValidityRange).toBe(true);
      expect(report.accuracy.isAccuracyDegraded).toBe(false);
      expect(report.executionTimeMs).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(report.executionTimeMs)).toBe(true);

      // 5. Total matches found
      expect(report.totalMatchesFound).toBe(4);
      expect(report.explanations.length).toBe(4);

      // 6. Detailed boundary explanations
      for (let i = 0; i < 4; i++) {
        const exp = report.explanations[i]!;
        expect(exp.duration.totalHours).toBe(8);

        // Start boundary: Civil time entered 09:00 EDT in America/New_York
        expect(exp.startExplanation.boundaryType).toBe('start');
        expect(exp.startExplanation.model).toBe('civil');
        expect(exp.startExplanation.conditionDescription).toContain('civil.hour');
        expect(exp.startExplanation.reason).toContain('Civil time entered business hours (09:00');
        expect(exp.startExplanation.details?.property).toBe('hour');
        expect(exp.startExplanation.details?.timeZoneId).toBe('America/New_York');

        // End boundary: Civil time exited 17:00 EDT in America/New_York
        expect(exp.endExplanation.boundaryType).toBe('end');
        expect(exp.endExplanation.model).toBe('civil');
        expect(exp.endExplanation.conditionDescription).toContain('civil.hour');
        expect(exp.endExplanation.reason).toContain('Civil time exited business hours (17:00');
        expect(exp.endExplanation.details?.property).toBe('hour');
        expect(exp.endExplanation.details?.timeZoneId).toBe('America/New_York');
      }
    });

    it('documents solar crossing residuals and details in boundary explanations', () => {
      const solarOnly = Conditions.solar.elevation.gte(10);
      const result = ChronoFlux.resolve({
        place: newYork,
        within: new Interval(
          Instant.fromJSON('2026-06-21T00:00:00.000Z'),
          Instant.fromJSON('2026-06-22T00:00:00.000Z')
        ),
        where: solarOnly,
      });

      expect(result.report.explanations.length).toBe(1);
      const exp = result.report.explanations[0]!;

      // Start: solar elevation crossing
      expect(exp.startExplanation.model).toBe('solar');
      expect(exp.startExplanation.details?.residualDeg).toBeDefined();
      expect(exp.startExplanation.details!.residualDeg!).toBeLessThan(1e-5);
      expect(exp.startExplanation.details?.toleranceDeg).toBe(1e-5);
      expect(exp.startExplanation.reason).toContain('rising');

      // End: solar elevation dropping
      expect(exp.endExplanation.model).toBe('solar');
      expect(exp.endExplanation.details?.residualDeg).toBeDefined();
      expect(exp.endExplanation.details!.residualDeg!).toBeLessThan(1e-5);
      expect(exp.endExplanation.details?.toleranceDeg).toBe(1e-5);
      expect(exp.endExplanation.reason).toContain('setting');
    });

    it('validates input options strictly and throws TypeError on invalid arguments', () => {
      expect(() => ChronoFlux.resolve(null as any)).toThrow(TypeError);
      expect(() => ChronoFlux.resolve({} as any)).toThrow(TypeError);
      expect(() =>
        ChronoFlux.resolve({
          place: null as any,
          within: fourDaysWindow,
          where: businessHours,
        })
      ).toThrow(TypeError);
      expect(() =>
        ChronoFlux.resolve({
          place: newYork,
          within: null as any,
          where: businessHours,
        })
      ).toThrow(TypeError);
      expect(() =>
        ChronoFlux.resolve({
          place: newYork,
          within: fourDaysWindow,
          where: { kind: 'bad' } as any,
        })
      ).toThrow(TypeError);
      expect(() =>
        ChronoFlux.resolve({
          place: newYork,
          within: fourDaysWindow,
          where: businessHours,
          policy: 'invalid' as any,
        })
      ).toThrow(TypeError);
      expect(() =>
        ChronoFlux.resolve({
          place: newYork,
          within: fourDaysWindow,
          where: businessHours,
          minDuration: 1234 as any,
        })
      ).toThrow(TypeError);
      expect(() =>
        ChronoFlux.resolve({
          place: newYork,
          within: fourDaysWindow,
          where: businessHours,
          minDuration: ChronoFlux.duration.seconds(-10),
        })
      ).toThrow(RangeError);
    });

    it('documents provenance with verified residuals on inverted / complement conditions (solar.elevation < 10°)', () => {
      const invertedCond = Conditions.solar.elevation.lt(10);
      const result = ChronoFlux.resolve({
        place: newYork,
        within: new Interval(
          Instant.fromJSON('2026-06-21T00:00:00.000Z'),
          Instant.fromJSON('2026-06-22T00:00:00.000Z')
        ),
        where: invertedCond,
      });

      // There are 2 intervals for elevation < 10°: [00:00, sunrise) and [sunset, 24:00)
      expect(result.intervals.intervals.length).toBe(2);

      // Interval 1 ends at sunrise: the sun rising closes the < 10° interval
      const iv1 = result.report.explanations[0]!;
      expect(iv1.endExplanation.model).toBe('solar');
      expect(iv1.endExplanation.details?.residualDeg).toBeDefined();
      expect(iv1.endExplanation.details!.residualDeg!).toBeLessThan(1e-5);
      expect(iv1.endExplanation.reason).toContain('rising');

      // Interval 2 starts at sunset: the sun setting opens the < 10° interval
      const iv2 = result.report.explanations[1]!;
      expect(iv2.startExplanation.model).toBe('solar');
      expect(iv2.startExplanation.details?.residualDeg).toBeDefined();
      expect(iv2.startExplanation.details!.residualDeg!).toBeLessThan(1e-5);
      expect(iv2.startExplanation.reason).toContain('setting');
    });

    it('documents provenance on solar.elevation.between(10, 45) upper crossings', () => {
      const betweenCond = Conditions.solar.elevation.between(10, 45);
      const result = ChronoFlux.resolve({
        place: newYork,
        within: new Interval(
          Instant.fromJSON('2026-06-21T00:00:00.000Z'),
          Instant.fromJSON('2026-06-22T00:00:00.000Z')
        ),
        where: betweenCond,
      });

      // In NYC summer, peak is ~73°, so elevation passes 10° to 45° in morning, and 45° to 10° in evening (2 intervals)
      expect(result.intervals.intervals.length).toBe(2);

      // Morning interval ends when elevation crosses 45°
      const morningIv = result.report.explanations[0]!;
      expect(morningIv.endExplanation.model).toBe('solar');
      expect(morningIv.endExplanation.details?.residualDeg).toBeDefined();
      expect(morningIv.endExplanation.details!.residualDeg!).toBeLessThan(1e-5);
      expect(morningIv.endExplanation.details?.threshold).toBe(45);

      // Afternoon interval starts when elevation drops below 45°
      const afternoonIv = result.report.explanations[1]!;
      expect(afternoonIv.startExplanation.model).toBe('solar');
      expect(afternoonIv.startExplanation.details?.residualDeg).toBeDefined();
      expect(afternoonIv.startExplanation.details!.residualDeg!).toBeLessThan(1e-5);
      expect(afternoonIv.startExplanation.details?.threshold).toBe(45);
    });

    it('preserves totalMatchesFound under earliest selection policy', () => {
      const result = ChronoFlux.resolve({
        place: newYork,
        within: fourDaysWindow,
        where: businessHours,
        policy: 'earliest',
      });

      expect(result.intervals.intervals.length).toBe(1);
      expect(result.allMatchingIntervals.intervals.length).toBe(4);
      expect(result.report.totalMatchesFound).toBe(4);
    });
  });
});
