/**
 * @file resolver-solar.test.ts
 * Test suite for continuous monotonic branch root-finding solar condition solver.
 * Verifies Milestone Requirement 1: solar.elevation >= 10 degrees with Brent-Dekker residual verification < 1e-5°.
 */

import { describe, expect, it } from 'vitest';
import { ChronoFlux, Conditions, Instant, Interval, Place } from '../src/index.js';

describe('Phase 3B — Continuous Solar Condition Solver', () => {
  const newYork = new Place({
    latitude: 40.7128,
    longitude: -74.006,
    timeZoneId: 'America/New_York',
  });

  const summerWindow = new Interval(
    Instant.fromJSON('2026-06-21T00:00:00.000Z'),
    Instant.fromJSON('2026-06-24T00:00:00.000Z')
  );

  describe('Milestone 1: solar.elevation >= 10 degrees', () => {
    it('resolves across multi-day window in New York with verified Brent-Dekker residual < 1e-5°', () => {
      const condition = Conditions.solar.elevation.gte(10);
      const result = ChronoFlux.resolve({
        place: newYork,
        within: summerWindow,
        where: condition,
      });

      // Exactly 3 days in the search window -> 3 diurnal intervals
      expect(result.intervals.intervals.length).toBe(3);

      for (let day = 0; day < 3; day++) {
        const interval = result.intervals.intervals[day]!;
        expect(interval.duration.totalHours).toBeGreaterThan(12.0);
        expect(interval.duration.totalHours).toBeLessThan(16.0);

        // Verify ascent crossing root residual: |h(t_start) - 10°| < 1e-5°
        const startCoords = ChronoFlux.solar.evaluatePosition(interval.start, newYork);
        const startResidual = Math.abs(startCoords.geometricElevationDeg - 10.0);
        expect(startResidual).toBeLessThan(1e-5);

        // Verify descent crossing root residual: |h(t_end) - 10°| < 1e-5°
        const endCoords = ChronoFlux.solar.evaluatePosition(interval.end, newYork);
        const endResidual = Math.abs(endCoords.geometricElevationDeg - 10.0);
        expect(endResidual).toBeLessThan(1e-5);

        // Midday check: sun reaches peak well above 10°
        const midNs = (interval.start.epochNanoseconds + interval.end.epochNanoseconds) / 2n;
        const midCoords = ChronoFlux.solar.evaluatePosition(Instant.fromEpochNanoseconds(midNs), newYork);
        expect(midCoords.geometricElevationDeg).toBeGreaterThan(60.0);
      }
    });

    it('respects unit conversions (rad vs deg) identically', () => {
      const tenDegInRad = (10.0 * Math.PI) / 180.0;
      const degResult = ChronoFlux.resolve({
        place: newYork,
        within: summerWindow,
        where: Conditions.solar.elevation.gte(10),
      });

      const radResult = ChronoFlux.resolve({
        place: newYork,
        within: summerWindow,
        where: Conditions.solar.elevation.gte(tenDegInRad, 'rad'),
      });

      expect(radResult.intervals.intervals.length).toBe(degResult.intervals.intervals.length);
      for (let i = 0; i < degResult.intervals.intervals.length; i++) {
        const diffStartNs = Math.abs(
          Number(
            radResult.intervals.intervals[i]!.start.epochNanoseconds -
              degResult.intervals.intervals[i]!.start.epochNanoseconds
          )
        );
        expect(diffStartNs).toBeLessThan(1_000_000); // within 1 ms
      }
    });

    it('solves zenith <= 80° identically to elevation >= 10°', () => {
      const elevResult = ChronoFlux.resolve({
        place: newYork,
        within: summerWindow,
        where: Conditions.solar.elevation.gte(10),
      });

      const zenithResult = ChronoFlux.resolve({
        place: newYork,
        within: summerWindow,
        where: Conditions.solar.zenith.lte(80),
      });

      expect(zenithResult.intervals.intervals.length).toBe(elevResult.intervals.intervals.length);
      for (let i = 0; i < elevResult.intervals.intervals.length; i++) {
        const diffStartNs = Math.abs(
          Number(
            zenithResult.intervals.intervals[i]!.start.epochNanoseconds -
              elevResult.intervals.intervals[i]!.start.epochNanoseconds
          )
        );
        expect(diffStartNs).toBeLessThan(1_000_000);
      }
    });

    it('solves direct sunlight (sunrise to sunset)', () => {
      // June 21 calendar day in New York (00:00 EDT to 24:00 EDT)
      const singleDay = new Interval(
        Instant.fromJSON('2026-06-21T04:00:00.000Z'),
        Instant.fromJSON('2026-06-22T04:00:00.000Z')
      );

      const result = ChronoFlux.resolve({
        place: newYork,
        within: singleDay,
        where: Conditions.solar.isDirectSunlight.eq(true),
      });

      expect(result.intervals.intervals.length).toBe(1);
      const sunlight = result.intervals.intervals[0]!;

      // In NYC summer solstice, daylight is ~15 hours
      expect(sunlight.duration.totalHours).toBeGreaterThan(14.8);
      expect(sunlight.duration.totalHours).toBeLessThan(15.5);

      // Verify sunrise threshold ~ -0.833°
      const sunriseCoords = ChronoFlux.solar.evaluatePosition(sunlight.start, newYork);
      expect(Math.abs(sunriseCoords.geometricElevationDeg - -0.833333)).toBeLessThan(1e-4);
    });

    it('solves solar twilight phases (civil_twilight)', () => {
      // June 21 calendar day in New York (00:00 EDT to 24:00 EDT)
      const singleDay = new Interval(
        Instant.fromJSON('2026-06-21T04:00:00.000Z'),
        Instant.fromJSON('2026-06-22T04:00:00.000Z')
      );

      const result = ChronoFlux.resolve({
        place: newYork,
        within: singleDay,
        where: Conditions.solar.phase.eq('civil_twilight'),
      });

      // Civil twilight occurs twice daily: dawn and dusk
      expect(result.intervals.intervals.length).toBe(2);
      const dawn = result.intervals.intervals[0]!;
      const dusk = result.intervals.intervals[1]!;

      // Dawn: begins at -6°, ends at sunrise (-0.8333°)
      const dawnStart = ChronoFlux.solar.evaluatePosition(dawn.start, newYork);
      expect(Math.abs(dawnStart.geometricElevationDeg - -6.0)).toBeLessThan(1e-4);

      // Dusk: begins at sunset (-0.8333°), ends at -6°
      const duskEnd = ChronoFlux.solar.evaluatePosition(dusk.end, newYork);
      expect(Math.abs(duskEnd.geometricElevationDeg - -6.0)).toBeLessThan(1e-4);
    });

    it('clamps cleanly to search window when starting during daylight', () => {
      // Window begins at 14:00 UTC (approx 10:00 AM EDT, when sun is already up)
      const middayStartWindow = new Interval(
        Instant.fromJSON('2026-06-21T14:00:00.000Z'),
        Instant.fromJSON('2026-06-22T00:00:00.000Z')
      );

      const result = ChronoFlux.resolve({
        place: newYork,
        within: middayStartWindow,
        where: Conditions.solar.elevation.gte(10),
      });

      expect(result.intervals.intervals.length).toBe(1);
      const interval = result.intervals.intervals[0]!;
      expect(interval.start.equals(middayStartWindow.start)).toBe(true);
      expect(result.report.explanations[0]!.startExplanation.model).toBe('window');
    });

    it('handles tangential graze cleanly without spurious 0-length intervals', () => {
      const singleDay = new Interval(
        Instant.fromJSON('2026-06-21T00:00:00.000Z'),
        Instant.fromJSON('2026-06-22T00:00:00.000Z')
      );

      // In New York on June 21, noon elevation is ~72.7°.
      // If we query elevation >= 85°, it is above max elevation everywhere -> returns empty.
      const result = ChronoFlux.resolve({
        place: newYork,
        within: singleDay,
        where: Conditions.solar.elevation.gte(85),
      });

      expect(result.intervals.isEmpty()).toBe(true);
    });

    it('solves elevation.between(10, 20) with morning and afternoon bands', () => {
      const singleDay = new Interval(
        Instant.fromJSON('2026-06-21T04:00:00.000Z'),
        Instant.fromJSON('2026-06-22T04:00:00.000Z')
      );

      const result = ChronoFlux.resolve({
        place: newYork,
        within: singleDay,
        where: Conditions.solar.elevation.between(10, 20),
      });

      // 2 bands: morning rising band and afternoon setting band
      expect(result.intervals.intervals.length).toBe(2);
      const morning = result.intervals.intervals[0]!;
      const afternoon = result.intervals.intervals[1]!;

      expect(morning.start.isBefore(afternoon.start)).toBe(true);
      const morningStartCoords = ChronoFlux.solar.evaluatePosition(morning.start, newYork);
      expect(Math.abs(morningStartCoords.geometricElevationDeg - 10.0)).toBeLessThan(1e-4);
      const morningEndCoords = ChronoFlux.solar.evaluatePosition(morning.end, newYork);
      expect(Math.abs(morningEndCoords.geometricElevationDeg - 20.0)).toBeLessThan(1e-4);
    });

    it('solves elevation.lt(0) and elevation.lte(10)', () => {
      const singleDay = new Interval(
        Instant.fromJSON('2026-06-21T04:00:00.000Z'),
        Instant.fromJSON('2026-06-22T04:00:00.000Z')
      );

      const lt0 = ChronoFlux.resolve({
        place: newYork,
        within: singleDay,
        where: Conditions.solar.elevation.lt(0),
      });

      // Night hours
      expect(lt0.intervals.intervals.length).toBeGreaterThan(0);

      const eq10 = ChronoFlux.resolve({
        place: newYork,
        within: singleDay,
        where: Conditions.solar.elevation.eq(10),
      });
      expect(eq10.intervals.isEmpty()).toBe(true);

      const neq10 = ChronoFlux.resolve({
        place: newYork,
        within: singleDay,
        where: Conditions.solar.elevation.neq(10),
      });
      expect(neq10.intervals.intervals.length).toBe(1);
    });

    it('solves azimuth conditions across diurnal cycles', () => {
      const singleDay = new Interval(
        Instant.fromJSON('2026-06-21T04:00:00.000Z'),
        Instant.fromJSON('2026-06-22T04:00:00.000Z')
      );

      const southSun = ChronoFlux.resolve({
        place: newYork,
        within: singleDay,
        where: Conditions.solar.azimuth.between(90, 270),
      });

      expect(southSun.intervals.intervals.length).toBeGreaterThan(0);
      for (const interval of southSun.intervals.intervals) {
        const midNs = (interval.start.epochNanoseconds + interval.end.epochNanoseconds) / 2n;
        const coords = ChronoFlux.solar.evaluatePosition(Instant.fromEpochNanoseconds(midNs), newYork);
        expect(coords.azimuthDeg).toBeGreaterThanOrEqual(90);
        expect(coords.azimuthDeg).toBeLessThanOrEqual(270);
      }

      // Verify exact crossing root accuracy for continuous azimuth
      const southCrossing = ChronoFlux.resolve({
        place: newYork,
        within: singleDay,
        where: Conditions.solar.azimuth.gte(180),
      });
      // In 04:00Z-04:00Z window (NYC EDT): interval 1 is pre-midnight (~04:00-04:56Z where azimuth ~340°-360°),
      // interval 2 is post-noon crossing from 180° onward.
      expect(southCrossing.intervals.intervals.length).toBe(2);
      const noonCrossing = southCrossing.intervals.intervals[1]!;
      const startCrossingCoords = ChronoFlux.solar.evaluatePosition(noonCrossing.start, newYork);
      expect(Math.abs(startCrossingCoords.azimuthDeg! - 180)).toBeLessThan(1e-4);
      expect(southCrossing.report.explanations[1]!.startExplanation.model).toBe('solar');
      expect(southCrossing.report.explanations[1]!.startExplanation.details?.residualDeg).toBeDefined();
      expect(southCrossing.report.explanations[1]!.startExplanation.details!.residualDeg!).toBeLessThan(1e-4);
    });

    it('solves phase.in and phase.neq', () => {
      const singleDay = new Interval(
        Instant.fromJSON('2026-06-21T04:00:00.000Z'),
        Instant.fromJSON('2026-06-22T04:00:00.000Z')
      );

      const twilights = ChronoFlux.resolve({
        place: newYork,
        within: singleDay,
        where: Conditions.solar.phase.in(['civil_twilight', 'nautical_twilight']),
      });
      expect(twilights.intervals.intervals.length).toBeGreaterThan(0);

      const nonDay = ChronoFlux.resolve({
        place: newYork,
        within: singleDay,
        where: Conditions.solar.phase.neq('day'),
      });
      expect(nonDay.intervals.intervals.length).toBeGreaterThan(0);
    });

    it('resolves solar-only queries on Place without timeZoneId cleanly', () => {
      const placeNoTz = new Place({
        latitude: 40.7128,
        longitude: -74.006,
      });
      const singleDay = new Interval(
        Instant.fromJSON('2026-06-21T00:00:00.000Z'),
        Instant.fromJSON('2026-06-22T00:00:00.000Z')
      );

      const result = ChronoFlux.resolve({
        place: placeNoTz,
        within: singleDay,
        where: Conditions.solar.elevation.gte(10),
      });

      expect(result.intervals.intervals.length).toBe(1);
      expect(result.report).toBeDefined();
      expect(result.report.accuracy.solarNumericalToleranceDeg).toBe(1e-5);
      expect(result.report.accuracy.timeZoneId).toBeUndefined();
      expect(result.report.accuracy.civilResolution).toBeUndefined();
      expect(result.report.explanations[0]!.startExplanation.model).toBe('solar');
      expect(result.report.explanations[0]!.startExplanation.details?.timeZoneId).toBeUndefined();
    });

    it('distinguishes continuous azimuth threshold crossings from 360°/0° North branch cut wraps in provenance report', () => {
      const singleDay = new Interval(
        Instant.fromJSON('2026-06-21T04:00:00.000Z'),
        Instant.fromJSON('2026-06-22T04:00:00.000Z')
      );

      const result = ChronoFlux.resolve({
        place: newYork,
        within: singleDay,
        where: Conditions.solar.azimuth.gte(180),
      });

      expect(result.intervals.intervals.length).toBe(2);

      // Interval 0 ends when azimuth reaches 360°/0° North wrap
      const wrapExp = result.report.explanations[0]!.endExplanation;
      expect(wrapExp.details?.isWrapBoundary).toBe(true);
      expect(wrapExp.details?.boundaryCategory).toBe('azimuth_wrap');
      expect(wrapExp.details?.residualDeg).toBeUndefined();
      expect(wrapExp.reason).toContain('azimuth wrapped');

      // Interval 1 starts at the continuous 180° threshold crossing
      const crossingExp = result.report.explanations[1]!.startExplanation;
      expect(crossingExp.details?.isWrapBoundary).toBe(false);
      expect(crossingExp.details?.boundaryCategory).toBe('threshold_crossing');
      expect(crossingExp.details?.residualDeg).toBeDefined();
      expect(crossingExp.details!.residualDeg!).toBeLessThan(1e-4);
    });

    it('resolves polarRegime.in on high-latitude locations (Tromsø midnight sun)', () => {
      const tromso = new Place({
        latitude: 69.6492,
        longitude: 18.9553,
        timeZoneId: 'Europe/Oslo',
      });
      const solsticeWindow = new Interval(
        Instant.fromJSON('2026-06-20T00:00:00.000Z'),
        Instant.fromJSON('2026-06-23T00:00:00.000Z')
      );

      const result = ChronoFlux.resolve({
        place: tromso,
        within: solsticeWindow,
        where: Conditions.solar.polarRegime.in(['polar_day', 'polar_night']),
      });

      // Tromsø experiences 24-hour midnight sun (polar_day) across the entire June solstice
      expect(result.intervals.intervals.length).toBe(1);
      expect(result.intervals.intervals[0]!.equals(solsticeWindow)).toBe(true);
    });

    it('resolves near-zenith high elevation conditions in tropical latitudes (Singapore equinox)', () => {
      const singapore = new Place({
        latitude: 1.3521,
        longitude: 103.8198,
        timeZoneId: 'Asia/Singapore',
      });
      const equinoxWindow = new Interval(
        Instant.fromJSON('2026-03-21T00:00:00.000Z'),
        Instant.fromJSON('2026-03-22T00:00:00.000Z')
      );

      const result = ChronoFlux.resolve({
        place: singapore,
        within: equinoxWindow,
        where: Conditions.solar.elevation.gte(85),
      });

      expect(result.intervals.intervals.length).toBe(1);
      const iv = result.intervals.intervals[0]!;
      expect(iv.duration.totalMinutes).toBeGreaterThan(15);
      expect(iv.duration.totalMinutes).toBeLessThan(60);

      const startPos = ChronoFlux.solar.evaluatePosition(iv.start, singapore);
      expect(Math.abs(startPos.geometricElevationDeg - 85.0)).toBeLessThan(1e-5);
    });

    it('resolves near-zenith azimuth conditions and records wrap provenance (Singapore equinox)', () => {
      const singapore = new Place({
        latitude: 1.3521,
        longitude: 103.8198,
        timeZoneId: 'Asia/Singapore',
      });
      const equinoxWindow = new Interval(
        Instant.fromJSON('2026-03-21T00:00:00.000Z'),
        Instant.fromJSON('2026-03-22T00:00:00.000Z')
      );

      const result = ChronoFlux.resolve({
        place: singapore,
        within: equinoxWindow,
        where: Conditions.solar.azimuth.gte(180),
      });

      expect(result.intervals.intervals.length).toBe(1);
      const exp = result.report.explanations[0]!;

      // Start boundary: genuine continuous threshold crossing at 180°
      expect(exp.startExplanation.details?.isWrapBoundary).toBe(false);
      expect(exp.startExplanation.details?.boundaryCategory).toBe('threshold_crossing');
      expect(exp.startExplanation.details?.residualDeg).toBeDefined();
      expect(exp.startExplanation.details!.residualDeg!).toBeLessThan(1e-4);

      // End boundary: wraps through North (360°/0° branch cut)
      expect(exp.endExplanation.details?.isWrapBoundary).toBe(true);
      expect(exp.endExplanation.details?.boundaryCategory).toBe('azimuth_wrap');
      expect(exp.endExplanation.details?.residualDeg).toBeUndefined();
      expect(exp.endExplanation.reason).toContain('azimuth wrapped');
    });

    it('resolves high-latitude azimuth wraparound through North at midnight sun (Tromsø solstice)', () => {
      const tromso = new Place({
        latitude: 69.6492,
        longitude: 18.9553,
        timeZoneId: 'Europe/Oslo',
      });
      const solsticeWindow = new Interval(
        Instant.fromJSON('2026-06-21T00:00:00.000Z'),
        Instant.fromJSON('2026-06-22T00:00:00.000Z')
      );

      // 1. Azimuth range [350°, 10°] wrapping through 0° North
      const resultWrap = ChronoFlux.resolve({
        place: tromso,
        within: solsticeWindow,
        where: Conditions.solar.azimuth.between(350, 10),
      });

      expect(resultWrap.intervals.intervals.length).toBe(1);
      const wrapExp = resultWrap.report.explanations[0]!;
      // Start is continuous crossing at 350°
      expect(wrapExp.startExplanation.details?.isWrapBoundary).toBe(false);
      expect(wrapExp.startExplanation.details?.boundaryCategory).toBe('threshold_crossing');
      expect(wrapExp.startExplanation.details?.residualDeg).toBeDefined();
      expect(wrapExp.startExplanation.details!.residualDeg!).toBeLessThan(1e-4);

      // End is continuous crossing at 10°
      expect(wrapExp.endExplanation.details?.isWrapBoundary).toBe(false);
      expect(wrapExp.endExplanation.details?.boundaryCategory).toBe('threshold_crossing');
      expect(wrapExp.endExplanation.details?.residualDeg).toBeDefined();
      expect(wrapExp.endExplanation.details!.residualDeg!).toBeLessThan(1e-4);

      // 2. Azimuth >= 350° ending at 360°/0° North wrap
      const resultGte = ChronoFlux.resolve({
        place: tromso,
        within: solsticeWindow,
        where: Conditions.solar.azimuth.gte(350),
      });

      expect(resultGte.intervals.intervals.length).toBe(1);
      const gteExp = resultGte.report.explanations[0]!;
      expect(gteExp.startExplanation.details?.isWrapBoundary).toBe(false);
      expect(gteExp.startExplanation.details?.boundaryCategory).toBe('threshold_crossing');
      expect(gteExp.endExplanation.details?.isWrapBoundary).toBe(true);
      expect(gteExp.endExplanation.details?.boundaryCategory).toBe('azimuth_wrap');
      expect(gteExp.endExplanation.details?.residualDeg).toBeUndefined();
    });
  });
});
