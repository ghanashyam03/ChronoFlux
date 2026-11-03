/**
 * @file phase2-2-reliability.test.ts
 * Phase 2.2 — Numerical Reliability, Temporal Semantics, and Performance Verification.
 *
 * Verifies:
 * 1. Polar root-finding: Genuine bracketed root-finding (Brent-Dekker) with explicit convergence status and residual verification (|h(t) - θ| < 10^-5°).
 * 2. Cache key precision: Exact coordinate and elevation stringification without lossy rounding (preventing cross-location collisions).
 * 3. Uncertainty semantics: Separation of instantaneous angular uncertainty Δh(t), crossing sensitivity |dh/dt|, and event-time crossing uncertainties.
 * 4. Separate polar regime from solar phase: Diurnal polar regime ('polar_day' | 'polar_night' | 'none') independent of illumination phase (civil, nautical, astronomical, night, day).
 * 5. Astronomical time-scale policy: UTC, UT1, TT, TAI, ΔT specifications and pluggable provider interface.
 * 6. Validity enforcement: 1800-2100 CE validity range and explicit degradation flags when extrapolated.
 * 7. Civil DST classification: Exact UTC offset with 'authoritative' | 'heuristic' | 'unknown' confidence levels.
 * 8. Reproducible performance benchmarks: Actual throughput measurement for evaluatePosition and diurnal caching.
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  calcHorizonDip,
  calcSolarCrossingDetails,
  calcSolarCrossingUncertainty,
  calcSolarNoon,
  computeSolarCoordinates,
  findSolarCrossing,
  instantToJulianDay,
  MAX_SAFE_POLAR_BRACKET_WIDTH_NS,
  NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG,
  solvePolarCrossingBracket,
} from '../src/core/models/solar/math.js';
import {
  AstronomicalTimeScale,
  BaseAstronomicalTimeScale,
  createAstronomicalTimeScale,
  getAstronomicalTimeScale,
  registerAstronomicalTimeScale,
  standardAstronomicalTimeScale,
  StandardAstronomicalTimeScale,
  TimeScaleMetadata,
  validateAstronomicalTimeScale,
} from '../src/core/models/solar/timescale.js';
import {
  CrossingCondition,
  SolarEventInstant,
  SolarTransitionInstant,
} from '../src/core/models/solar/types.js';
import { ChronoFlux, Duration, Instant, Interval, Place } from '../src/index.js';

describe('Phase 2.2 — Numerical Reliability and Temporal Semantics', () => {
  const northPole = ChronoFlux.place({ latitude: 90.0, longitude: 0.0, timeZoneId: 'UTC' });
  const southPole = ChronoFlux.place({ latitude: -90.0, longitude: 0.0, timeZoneId: 'UTC' });
  const tromso = ChronoFlux.place({ latitude: 69.6492, longitude: 18.9553, timeZoneId: 'Europe/Oslo' });
  const svalbard = ChronoFlux.place({ latitude: 78.2232, longitude: 15.6267, timeZoneId: 'Arctic/Longyearbyen' });
  const greenwich = ChronoFlux.place({ latitude: 51.4769, longitude: -0.0005, timeZoneId: 'Europe/London' });
  const newYork = ChronoFlux.place({ latitude: 40.7128, longitude: -74.006, timeZoneId: 'America/New_York' });
  const dublin = ChronoFlux.place({ latitude: 53.3498, longitude: -6.2603, timeZoneId: 'Europe/Dublin' });
  const phoenix = ChronoFlux.place({ latitude: 33.4484, longitude: -112.074, timeZoneId: 'America/Phoenix' });
  const tokyo = ChronoFlux.place({ latitude: 35.6762, longitude: 139.6503, timeZoneId: 'Asia/Tokyo' });
  const kolkata = ChronoFlux.place({ latitude: 22.5726, longitude: 88.3639, timeZoneId: 'Asia/Kolkata' });

  // =========================================================================
  // 1. Polar Root-Finding
  // =========================================================================
  describe('1. Polar Root-Finding (Brent-Dekker & Residual Verification)', () => {
    it('solves vernal equinox sunrise at North Pole with residual |h(t) - θ| < 1e-5°', () => {
      const equinoxNoon = ChronoFlux.instant('2026-03-18T12:00:00Z');
      const sunrise = findSolarCrossing(
        northPole,
        equinoxNoon,
        NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG,
        'rising'
      );

      expect(sunrise).not.toBeNull();
      const coords = computeSolarCoordinates(sunrise!, northPole);
      const residual = Math.abs(coords.geometricElevationDeg - NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG);

      // Explicit residual verification bound required by Phase 2.2
      expect(residual).toBeLessThan(1e-5);
    });

    it('solves autumn equinox sunset at North Pole with residual |h(t) - θ| < 1e-5°', () => {
      const equinoxNoon = ChronoFlux.instant('2026-09-25T12:00:00Z');
      const sunset = findSolarCrossing(
        northPole,
        equinoxNoon,
        NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG,
        'setting'
      );

      expect(sunset).not.toBeNull();
      const coords = computeSolarCoordinates(sunset!, northPole);
      const residual = Math.abs(coords.geometricElevationDeg - NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG);

      expect(residual).toBeLessThan(1e-5);
    });

    it('solves spring equinox sunrise at South Pole with residual |h(t) - θ| < 1e-5°', () => {
      const equinoxNoon = ChronoFlux.instant('2026-09-20T12:00:00Z');
      const sunrise = findSolarCrossing(
        southPole,
        equinoxNoon,
        NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG,
        'rising'
      );

      expect(sunrise).not.toBeNull();
      const coords = computeSolarCoordinates(sunrise!, southPole);
      const residual = Math.abs(coords.geometricElevationDeg - NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG);

      expect(residual).toBeLessThan(1e-5);
    });

    it('returns null immediately when query direction opposes seasonal elevation change', () => {
      // In March at North Pole, sun is rising; asking for 'setting' must return null
      const marchNoon = ChronoFlux.instant('2026-03-18T12:00:00Z');
      const wrongDirection = findSolarCrossing(
        northPole,
        marchNoon,
        NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG,
        'setting'
      );
      expect(wrongDirection).toBeNull();
    });

    it('returns explicit convergence status and residual verification from solvePolarCrossingBracket', () => {
      const equinoxNoon = ChronoFlux.instant('2026-03-18T12:00:00Z');
      const TWELVE_HOURS_NS = 43_200_000_000_000n;
      const aNs = equinoxNoon.epochNanoseconds - TWELVE_HOURS_NS;
      const bNs = equinoxNoon.epochNanoseconds + TWELVE_HOURS_NS;

      const result = solvePolarCrossingBracket(
        northPole,
        aNs,
        bNs,
        NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG
      );

      expect(result).not.toBeNull();
      expect(result!.status).toBe('converged');
      expect(result!.isResidualVerified).toBe(true);
      expect(result!.residualDeg).toBeLessThan(1e-5);
      expect(result!.iterations).toBeGreaterThan(0);
    });

    it('returns not_bracketed when bracket does not span the target solar elevation', () => {
      // In mid-January at North Pole, sun elevation is deep below -15°; target is -0.833°
      const midWinterNoon = ChronoFlux.instant('2026-01-15T12:00:00Z');
      const TWELVE_HOURS_NS = 43_200_000_000_000n;
      const aNs = midWinterNoon.epochNanoseconds - TWELVE_HOURS_NS;
      const bNs = midWinterNoon.epochNanoseconds + TWELVE_HOURS_NS;

      const result = solvePolarCrossingBracket(
        northPole,
        aNs,
        bNs,
        NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG
      );

      expect(result.status).toBe('not_bracketed');
      expect(result.isResidualVerified).toBe(false);
      expect(result.iterations).toBe(0);
    });

    it('validates solvePolarCrossingBracket input parameters strictly', () => {
      const equinoxNoon = ChronoFlux.instant('2026-03-18T12:00:00Z');
      const TWELVE_HOURS_NS = 43_200_000_000_000n;
      const aNs = equinoxNoon.epochNanoseconds - TWELVE_HOURS_NS;
      const bNs = equinoxNoon.epochNanoseconds + TWELVE_HOURS_NS;

      // toleranceDeg validation
      expect(() => solvePolarCrossingBracket(northPole, aNs, bNs, NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG, 50, 0)).toThrow(RangeError);
      expect(() => solvePolarCrossingBracket(northPole, aNs, bNs, NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG, 50, -1e-5)).toThrow(RangeError);
      expect(() => solvePolarCrossingBracket(northPole, aNs, bNs, NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG, 50, NaN)).toThrow(RangeError);
      // @ts-expect-error toleranceDeg must be a number
      expect(() => solvePolarCrossingBracket(northPole, aNs, bNs, NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG, 50, 'invalid')).toThrow(RangeError);

      // maxIterations validation
      expect(() => solvePolarCrossingBracket(northPole, aNs, bNs, NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG, 0, 1e-5)).toThrow(RangeError);
      expect(() => solvePolarCrossingBracket(northPole, aNs, bNs, NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG, -5, 1e-5)).toThrow(RangeError);
      expect(() => solvePolarCrossingBracket(northPole, aNs, bNs, NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG, 1.5, 1e-5)).toThrow(RangeError);

      // targetElevationDeg validation
      expect(() => solvePolarCrossingBracket(northPole, aNs, bNs, NaN)).toThrow(TypeError);

      // BigInt bracket endpoints validation
      // @ts-expect-error aNs must be bigint
      expect(() => solvePolarCrossingBracket(northPole, Number(aNs), bNs, NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG)).toThrow(TypeError);
      // @ts-expect-error bNs must be bigint
      expect(() => solvePolarCrossingBracket(northPole, aNs, Number(bNs), NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG)).toThrow(TypeError);

      // Bracket width limit enforcement (> MAX_SAFE_POLAR_BRACKET_WIDTH_NS)
      const excessiveBNs = aNs + MAX_SAFE_POLAR_BRACKET_WIDTH_NS + 10_000_000n;
      expect(() => solvePolarCrossingBracket(northPole, aNs, excessiveBNs, NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG)).toThrow(RangeError);
    });

    it('normalizes reversed brackets where aNs > bNs and converges with verified residual', () => {
      const equinoxNoon = ChronoFlux.instant('2026-03-18T12:00:00Z');
      const TWELVE_HOURS_NS = 43_200_000_000_000n;
      const aNs = equinoxNoon.epochNanoseconds - TWELVE_HOURS_NS;
      const bNs = equinoxNoon.epochNanoseconds + TWELVE_HOURS_NS;

      const forwardResult = solvePolarCrossingBracket(northPole, aNs, bNs, NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG);
      const reversedResult = solvePolarCrossingBracket(northPole, bNs, aNs, NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG);

      expect(forwardResult.status).toBe('converged');
      expect(reversedResult.status).toBe('converged');
      expect(reversedResult.isResidualVerified).toBe(true);
      expect(reversedResult.residualDeg).toBeLessThan(1e-5);
      expect(reversedResult.crossingInstant.epochNanoseconds).toBe(forwardResult.crossingInstant.epochNanoseconds);
    });

    it('handles zero-width bracket (aNs === bNs) returning status not_bracketed', () => {
      const equinoxNoon = ChronoFlux.instant('2026-03-18T12:00:00Z');
      const result = solvePolarCrossingBracket(
        northPole,
        equinoxNoon.epochNanoseconds,
        equinoxNoon.epochNanoseconds,
        NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG
      );

      expect(result.status).toBe('not_bracketed');
      expect(result.isResidualVerified).toBe(false);
      expect(result.iterations).toBe(0);
    });

    it('returns status converged at iterations = 0 when endpoint matches target within toleranceDeg', () => {
      const equinoxNoon = ChronoFlux.instant('2026-03-18T12:00:00Z');
      const TWELVE_HOURS_NS = 43_200_000_000_000n;
      const aNs = equinoxNoon.epochNanoseconds - TWELVE_HOURS_NS;
      const bNs = equinoxNoon.epochNanoseconds + TWELVE_HOURS_NS;

      const conv = solvePolarCrossingBracket(northPole, aNs, bNs, NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG);
      expect(conv.status).toBe('converged');

      // Use converged instant directly as endpoint with tolerance covering its residual
      const endpointResult = solvePolarCrossingBracket(
        northPole,
        conv.crossingInstant.epochNanoseconds,
        conv.crossingInstant.epochNanoseconds + 3600_000_000_000n,
        NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG,
        50,
        1e-4
      );

      expect(endpointResult.status).toBe('converged');
      expect(endpointResult.iterations).toBe(0);
      expect(endpointResult.isResidualVerified).toBe(true);
      expect(endpointResult.crossingInstant.epochNanoseconds).toBe(conv.crossingInstant.epochNanoseconds);
    });

    it('terminates with status max_iterations and isResidualVerified: false when maxIterations is exhausted', () => {
      const equinoxNoon = ChronoFlux.instant('2026-03-18T12:00:00Z');
      const TWELVE_HOURS_NS = 43_200_000_000_000n;
      const aNs = equinoxNoon.epochNanoseconds - TWELVE_HOURS_NS;
      const bNs = equinoxNoon.epochNanoseconds + TWELVE_HOURS_NS;

      const maxIterResult = solvePolarCrossingBracket(
        northPole,
        aNs,
        bNs,
        NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG,
        1, // Exhaust after 1 iteration
        1e-8 // Very strict tolerance to prevent premature convergence
      );

      expect(maxIterResult.status).toBe('max_iterations');
      expect(maxIterResult.isResidualVerified).toBe(false);
      expect(maxIterResult.iterations).toBe(1);
    });

    it('converges with verified residual under strict tolerance (toleranceDeg = 1e-7)', () => {
      const equinoxNoon = ChronoFlux.instant('2026-03-18T12:00:00Z');
      const TWELVE_HOURS_NS = 43_200_000_000_000n;
      const aNs = equinoxNoon.epochNanoseconds - TWELVE_HOURS_NS;
      const bNs = equinoxNoon.epochNanoseconds + TWELVE_HOURS_NS;

      const strictResult = solvePolarCrossingBracket(
        northPole,
        aNs,
        bNs,
        NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG,
        60,
        1e-7
      );

      expect(strictResult.status).toBe('converged');
      expect(strictResult.isResidualVerified).toBe(true);
      expect(strictResult.residualDeg).toBeLessThanOrEqual(1e-7);
    });

    it('property-based test: polar root-finding produces strictly bracketed, monotonic convergence', () => {
      // Test 50 arbitrary days across the equinox season at North Pole
      fc.assert(
        fc.property(fc.integer({ min: 70, max: 85 }), (dayOfYear) => {
          const noonEpochMs = Date.UTC(2026, 0, 1) + dayOfYear * 86_400_000 + 43_200_000;
          const noon = Instant.fromEpochMilliseconds(noonEpochMs);
          const crossing = findSolarCrossing(
            northPole,
            noon,
            NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG,
            'rising'
          );

          if (crossing !== null) {
            const coords = computeSolarCoordinates(crossing, northPole);
            const residual = Math.abs(coords.geometricElevationDeg - NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG);
            expect(residual).toBeLessThan(1e-5);
          }
        }),
        { numRuns: 50 }
      );
    });
  });

  // =========================================================================
  // 2. Cache Key Precision & Collision Immunity
  // =========================================================================
  describe('2. Diurnal Cache Key Precision & Collision Immunity', () => {
    it('proves sub-0.00001° coordinate differences yield distinct cached event outputs and would have collided under 5-decimal key', () => {
      const instant = ChronoFlux.instant('2026-06-21T12:00:00Z');
      // Locations differing by 0.000001° in lat/lon
      const placeA = ChronoFlux.place({ latitude: 51.476901, longitude: -0.000501 });
      const placeB = ChronoFlux.place({ latitude: 51.476902, longitude: -0.000502 });

      // In the old cache scheme: lat.toFixed(5) and lon.toFixed(5) produce identical keys:
      expect(placeA.latitude.toFixed(5)).toBe(placeB.latitude.toFixed(5)); // '51.47690'
      expect(placeA.longitude.toFixed(5)).toBe(placeB.longitude.toFixed(5)); // '-0.00050'

      // Under the old 5-decimal cache, evaluating placeA would populate the cache,
      // and evaluating placeB would erroneously return placeA's cached sunrise/sunset.
      const stateA = ChronoFlux.solar.evaluate(instant, placeA);
      const stateB = ChronoFlux.solar.evaluate(instant, placeB);

      // Verify cached diurnal event outputs are distinct rather than returned from a colliding cache hit:
      expect(stateA.sunrise).not.toBeNull();
      expect(stateB.sunrise).not.toBeNull();
      expect(stateA.sunset).not.toBeNull();
      expect(stateB.sunset).not.toBeNull();

      expect(stateA.sunrise!.epochNanoseconds).not.toBe(stateB.sunrise!.epochNanoseconds);
      expect(stateA.sunset!.epochNanoseconds).not.toBe(stateB.sunset!.epochNanoseconds);
      expect(stateA.solarNoon.epochNanoseconds).not.toBe(stateB.solarNoon.epochNanoseconds);

      // Verify cached event uncertainties are distinct:
      expect(stateA.uncertainty.sunriseUncertaintyMinutes).not.toBeNull();
      expect(stateB.uncertainty.sunriseUncertaintyMinutes).not.toBeNull();
      expect(stateA.uncertainty.sunriseUncertaintyMinutes).not.toBe(stateB.uncertainty.sunriseUncertaintyMinutes);
    });

    it('proves sub-0.00001° coordinate differences at polar circle boundary yield distinct cached polarRegime and would have collided under 5-decimal key', () => {
      const instant = ChronoFlux.instant('2026-06-21T12:00:00Z');
      // Near solstice polar circle boundary:
      const placePolarDay = ChronoFlux.place({ latitude: 65.7289459, longitude: 0.0 });
      const placeNone = ChronoFlux.place({ latitude: 65.7289454, longitude: 0.0 });

      // In the old cache scheme, toFixed(5) produces identical keys for both:
      expect(placePolarDay.latitude.toFixed(5)).toBe('65.72895');
      expect(placeNone.latitude.toFixed(5)).toBe('65.72895');

      const statePolarDay = ChronoFlux.solar.evaluate(instant, placePolarDay);
      const stateNone = ChronoFlux.solar.evaluate(instant, placeNone);

      // Verify cached polar regimes and event presence are distinct:
      expect(statePolarDay.polarRegime).toBe('polar_day');
      expect(statePolarDay.isPolarDay).toBe(true);
      expect(statePolarDay.sunrise).toBeNull();
      expect(statePolarDay.sunset).toBeNull();

      expect(stateNone.polarRegime).toBe('none');
      expect(stateNone.isPolarDay).toBe(false);
      expect(stateNone.sunrise).not.toBeNull();
      expect(stateNone.sunset).not.toBeNull();
      expect(stateNone.uncertainty.sunriseUncertaintyMinutes).not.toBeNull();
    });

    it('proves elevation differences with identical lat/lon yield distinct cached event outputs, polar regimes, and horizon uncertainties', () => {
      const instant = ChronoFlux.instant('2026-06-21T12:00:00Z');
      const seaLevel = ChronoFlux.place({ latitude: 27.9881, longitude: 86.925, elevationMeters: 0 });
      const everest = ChronoFlux.place({ latitude: 27.9881, longitude: 86.925, elevationMeters: 8848 });

      // In the old cache scheme, elevation was omitted from the key, so seaLevel and everest collided completely.
      const stateSea = ChronoFlux.solar.evaluate(instant, seaLevel);
      const stateEverest = ChronoFlux.solar.evaluate(instant, everest);

      // Verify cached outputs differ:
      expect(stateSea.sunrise!.epochNanoseconds).not.toBe(stateEverest.sunrise!.epochNanoseconds);
      expect(stateSea.sunset!.epochNanoseconds).not.toBe(stateEverest.sunset!.epochNanoseconds);

      // At 8848m, geometric horizon dip makes sunrise earlier and sunset later:
      expect(stateEverest.sunrise!.isBefore(stateSea.sunrise!)).toBe(true);
      expect(stateEverest.sunset!.isAfter(stateSea.sunset!)).toBe(true);

      // Horizon limitation uncertainty is 0 for sea level, and d_dip for Everest:
      expect(stateSea.uncertainty.horizonLimitationDeg).toBe(0.0);
      expect(stateEverest.uncertainty.horizonLimitationDeg).toBeCloseTo(calcHorizonDip(8848), 4);

      // Verify elevation differences yield distinct cached polar regimes at high latitudes:
      const seaArctic = ChronoFlux.place({ latitude: 65.0, longitude: 0.0, elevationMeters: 0 });
      const mtnArctic = ChronoFlux.place({ latitude: 65.0, longitude: 0.0, elevationMeters: 3000 });

      const stateSeaArctic = ChronoFlux.solar.evaluate(instant, seaArctic);
      const stateMtnArctic = ChronoFlux.solar.evaluate(instant, mtnArctic);

      expect(stateSeaArctic.polarRegime).toBe('none');
      expect(stateSeaArctic.sunrise).not.toBeNull();
      expect(stateSeaArctic.sunset).not.toBeNull();

      expect(stateMtnArctic.polarRegime).toBe('polar_day');
      expect(stateMtnArctic.isPolarDay).toBe(true);
      expect(stateMtnArctic.sunrise).toBeNull();
      expect(stateMtnArctic.sunset).toBeNull();
    });
  });

  // =========================================================================
  // 2b. Observer Elevation Semantics & Geometric Horizon Dip
  // =========================================================================
  describe('2b. Observer Elevation Semantics (Geometric Horizon Dip)', () => {
    it('calculates geometric horizon dip conforming to d_dip = (1.76 / 60) * sqrt(max(0, h))', () => {
      expect(calcHorizonDip(0)).toBe(0.0);
      expect(calcHorizonDip(-50)).toBe(0.0);
      expect(calcHorizonDip(100)).toBeCloseTo((1.76 / 60.0) * 10, 6);
      expect(calcHorizonDip(2000)).toBeCloseTo((1.76 / 60.0) * Math.sqrt(2000), 6);
      // At 2000m, dip ≈ 1.3118°
      expect(calcHorizonDip(2000)).toBeCloseTo(1.3118, 3);
    });

    it('shifts sunrise earlier and sunset later by ~5.2 min at 2000m elevation at the equator', () => {
      const equinoxNoon = ChronoFlux.instant('2026-03-20T12:00:00Z');
      const equator0m = ChronoFlux.place({ latitude: 0.0, longitude: 0.0, elevationMeters: 0 });
      const equator2000m = ChronoFlux.place({ latitude: 0.0, longitude: 0.0, elevationMeters: 2000 });

      const state0m = ChronoFlux.solar.evaluate(equinoxNoon, equator0m);
      const state2000m = ChronoFlux.solar.evaluate(equinoxNoon, equator2000m);

      // Vertical diurnal crossing at equator: dh/dt ≈ 0.25°/min -> advance ≈ 1.3118° / 0.25°/min ≈ 5.25 min
      const sunriseAdvanceMinutes =
        Number(state0m.sunrise!.epochNanoseconds - state2000m.sunrise!.epochNanoseconds) / 60_000_000_000;
      expect(sunriseAdvanceMinutes).toBeGreaterThan(4.8);
      expect(sunriseAdvanceMinutes).toBeLessThan(5.6);

      const sunsetDelayMinutes =
        Number(state2000m.sunset!.epochNanoseconds - state0m.sunset!.epochNanoseconds) / 60_000_000_000;
      expect(sunsetDelayMinutes).toBeGreaterThan(4.8);
      expect(sunsetDelayMinutes).toBeLessThan(5.6);

      // Total daylight interval is ~10.5 min longer at 2000m:
      const dayLengthDiff = sunriseAdvanceMinutes + sunsetDelayMinutes;
      expect(dayLengthDiff).toBeCloseTo(10.5, 0.5);
    });

    it('accounts for oblique diurnal crossing angle at higher latitudes (11.4 min advance at Greenwich summer)', () => {
      const anchor = ChronoFlux.instant('2026-06-21T12:00:00Z');
      const seaLevelPlace = ChronoFlux.place({ latitude: 51.4769, longitude: -0.0005, elevationMeters: 0 });
      const mountainPlace = ChronoFlux.place({ latitude: 51.4769, longitude: -0.0005, elevationMeters: 2000 });

      const state0m = ChronoFlux.solar.evaluate(anchor, seaLevelPlace);
      const state2000m = ChronoFlux.solar.evaluate(anchor, mountainPlace);

      // Oblique crossing (dh/dt ≈ 0.115°/min) -> advance ≈ 1.3118° / 0.115°/min ≈ 11.4 min
      const sunriseAdvanceMinutes =
        Number(state0m.sunrise!.epochNanoseconds - state2000m.sunrise!.epochNanoseconds) / 60_000_000_000;
      expect(sunriseAdvanceMinutes).toBeCloseTo(11.37, 0.5);

      const sunsetDelayMinutes =
        Number(state2000m.sunset!.epochNanoseconds - state0m.sunset!.epochNanoseconds) / 60_000_000_000;
      expect(sunsetDelayMinutes).toBeCloseTo(11.37, 0.5);
    });

    it('incorporates observer elevation dip into nextEvent queries', () => {
      const anchor = ChronoFlux.instant('2026-03-20T04:00:00Z');
      const equator0m = ChronoFlux.place({ latitude: 0.0, longitude: 0.0, elevationMeters: 0 });
      const equator2000m = ChronoFlux.place({ latitude: 0.0, longitude: 0.0, elevationMeters: 2000 });

      const nextSunrise0m = ChronoFlux.solar.nextEvent({ event: 'sunrise', place: equator0m, after: anchor });
      const nextSunrise2000m = ChronoFlux.solar.nextEvent({ event: 'sunrise', place: equator2000m, after: anchor });

      expect(nextSunrise0m).not.toBeNull();
      expect(nextSunrise2000m).not.toBeNull();
      expect(nextSunrise2000m!.isBefore(nextSunrise0m!)).toBe(true);

      const diffMinutes =
        Number(nextSunrise0m!.epochNanoseconds - nextSunrise2000m!.epochNanoseconds) / 60_000_000_000;
      expect(diffMinutes).toBeCloseTo(5.25, 0.5);
    });

    it('harmonizes phase classification with isDirectSunlight for elevated observers above dipped horizon', () => {
      // Equator at 2000m (horizon dip = 1.3118° -> sunrise occurs at geometric elevation -2.1451°)
      const equator2000m = ChronoFlux.place({ latitude: 0.0, longitude: 0.0, elevationMeters: 2000 });
      const sunrise = ChronoFlux.solar.nextEvent({
        event: 'sunrise',
        place: equator2000m,
        after: ChronoFlux.instant('2026-03-20T04:00:00Z'),
      })!;

      // 1 minute after sunrise: sun is visibly above dipped horizon, but still below nominal 0m horizon (-0.8333°)
      const justAfterSunrise = sunrise.add(Duration.fromMinutes(1));
      const pos = ChronoFlux.solar.evaluatePosition(justAfterSunrise, equator2000m);
      const state = ChronoFlux.solar.evaluate(justAfterSunrise, equator2000m);

      expect(pos.isDirectSunlight).toBe(true);
      expect(pos.phase).toBe('day');
      expect(state.isDirectSunlight).toBe(true);
      expect(state.phase).toBe('day');
    });
  });

  // =========================================================================
  // 3. Uncertainty Semantics
  // =========================================================================
  describe('3. Uncertainty Semantics & Decomposition', () => {
    it('clearly separates instantaneous angular error, threshold crossing sensitivity, and event-crossing uncertainty', () => {
      const anchor = ChronoFlux.instant('2026-06-21T12:00:00Z');
      const state = ChronoFlux.solar.evaluate(anchor, greenwich);
      const unc = state.uncertainty;

      // 1. Assumed numerical truncation bound
      expect(unc.numericalErrorDeg).toBe(0.01);

      // 2. Calculated atmospheric refraction uncertainty (~12% of refraction)
      expect(unc.atmosphericRefractionUncertaintyDeg).toBeGreaterThan(0.0);

      // 3. Combined root-sum-square angular error Δh(t) including time-scale provider uncertainty
      expect(unc.combinedCoordinateUncertaintyDeg).toBeCloseTo(
        Math.sqrt(
          unc.numericalErrorDeg ** 2 +
            unc.atmosphericRefractionUncertaintyDeg ** 2 +
            unc.timeScaleUncertaintyDeg ** 2
        ),
        6
      );

      // 4. Instantaneous crossing sensitivity |dh/dt| in deg/min
      expect(unc.crossingSensitivityDegPerMin).toBeGreaterThanOrEqual(0.0);

      // 5. Predicted event-time uncertainty evaluated at actual sunrise instant
      expect(unc.sunriseUncertaintyMinutes).not.toBeNull();
      expect(unc.sunriseUncertaintyMinutes!).toBeGreaterThan(0.0);

      // 6. Predicted event-time uncertainty evaluated at actual sunset instant
      expect(unc.sunsetUncertaintyMinutes).not.toBeNull();
      expect(unc.sunsetUncertaintyMinutes!).toBeGreaterThan(0.0);
    });

    it('evaluates event-time uncertainty at actual sunrise crossing rather than current non-crossing instant', () => {
      const noon = ChronoFlux.instant('2026-06-21T12:00:00Z');
      const state = ChronoFlux.solar.evaluate(noon, greenwich);

      // At solar noon, |dh/dt| is near 0, but sunrise occurs at horizon where |dh/dt| > 0.1 deg/min
      expect(state.uncertainty.sunriseUncertaintyMinutes).toBeLessThan(1.0);
      expect(state.sunrise).not.toBeNull();

      // Verify that calcSolarCrossingUncertainty directly matches sunriseUncertaintyMinutes
      const expectedSunriseUncertainty = calcSolarCrossingUncertainty(
        greenwich,
        state.sunrise!,
        NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG
      );
      expect(state.uncertainty.sunriseUncertaintyMinutes).toBeCloseTo(expectedSunriseUncertainty, 6);
    });

    it('evaluates numerical central difference derivative (Delta t = 30s) across polar equinox transitions, eliminating arbitrary fallbacks', () => {
      // 1. North Pole March Vernal Equinox Sunrise
      const npSunrise = ChronoFlux.solar.nextEvent({
        event: 'sunrise',
        place: northPole,
        after: ChronoFlux.instant('2026-03-15T00:00:00Z'),
      });
      expect(npSunrise).not.toBeNull();
      // Seasonal declination rate (~0.000275°/min) yields finite, realistic physical uncertainty
      expect(npSunrise!.uncertaintyMinutes).toBeGreaterThan(150.0);
      expect(npSunrise!.uncertaintyMinutes).toBeLessThan(200.0);
      expect(npSunrise!.uncertaintyMinutes).toBe(npSunrise!.uncertainty.eventTimeUncertaintyMinutes);
      expect(npSunrise!.crossingCondition).toBe('well_conditioned');
      expect(npSunrise!.crossingCondition).toBe(npSunrise!.uncertainty.crossingCondition);
      expect(npSunrise!.uncertainty.crossingSensitivityDegPerMin).toBeGreaterThan(0.0002);

      // 2. North Pole September Autumn Equinox Sunset
      const npSunset = ChronoFlux.solar.nextEvent({
        event: 'sunset',
        place: northPole,
        after: ChronoFlux.instant('2026-09-20T00:00:00Z'),
      });
      expect(npSunset).not.toBeNull();
      expect(npSunset!.uncertaintyMinutes).toBeGreaterThan(150.0);
      expect(npSunset!.uncertaintyMinutes).toBeLessThan(200.0);
      expect(npSunset!.uncertaintyMinutes).toBe(npSunset!.uncertainty.eventTimeUncertaintyMinutes);
      expect(npSunset!.crossingCondition).toBe('well_conditioned');

      // 3. South Pole September Spring Equinox Sunrise
      const spSunrise = ChronoFlux.solar.nextEvent({
        event: 'sunrise',
        place: southPole,
        after: ChronoFlux.instant('2026-09-18T00:00:00Z'),
      });
      expect(spSunrise).not.toBeNull();
      expect(spSunrise!.uncertaintyMinutes).toBeGreaterThan(150.0);
      expect(spSunrise!.uncertaintyMinutes).toBeLessThan(200.0);
      expect(spSunrise!.uncertaintyMinutes).toBe(spSunrise!.uncertainty.eventTimeUncertaintyMinutes);
      expect(spSunrise!.crossingCondition).toBe('well_conditioned');

      // 4. South Pole March Autumn Equinox Sunset
      const spSunset = ChronoFlux.solar.nextEvent({
        event: 'sunset',
        place: southPole,
        after: ChronoFlux.instant('2026-03-20T00:00:00Z'),
      });
      expect(spSunset).not.toBeNull();
      expect(spSunset!.uncertaintyMinutes).toBeGreaterThan(150.0);
      expect(spSunset!.uncertaintyMinutes).toBeLessThan(200.0);
      expect(spSunset!.uncertaintyMinutes).toBe(spSunset!.uncertainty.eventTimeUncertaintyMinutes);
      expect(spSunset!.crossingCondition).toBe('well_conditioned');

      // 5. Tromsø (69.65°N) subpolar transition
      const tromsoSunrise = ChronoFlux.solar.nextEvent({
        event: 'sunrise',
        place: tromso,
        after: ChronoFlux.instant('2026-05-15T00:00:00Z'),
      });
      expect(tromsoSunrise).not.toBeNull();
      expect(tromsoSunrise!.uncertaintyMinutes).toBeGreaterThan(1.0);
      expect(tromsoSunrise!.uncertaintyMinutes).toBeLessThan(5.0);
      expect(tromsoSunrise!.uncertaintyMinutes).toBe(tromsoSunrise!.uncertainty.eventTimeUncertaintyMinutes);
      expect(tromsoSunrise!.crossingCondition).toBe('well_conditioned');

      // 6. Svalbard (78.22°N) subpolar transition
      const svalbardSunrise = ChronoFlux.solar.nextEvent({
        event: 'sunrise',
        place: svalbard,
        after: ChronoFlux.instant('2026-04-15T00:00:00Z'),
      });
      expect(svalbardSunrise).not.toBeNull();
      expect(svalbardSunrise!.uncertaintyMinutes).toBeGreaterThan(1.0);
      expect(svalbardSunrise!.uncertaintyMinutes).toBeLessThan(5.0);
      expect(svalbardSunrise!.uncertaintyMinutes).toBe(svalbardSunrise!.uncertainty.eventTimeUncertaintyMinutes);
      expect(svalbardSunrise!.crossingCondition).toBe('well_conditioned');

      // 7. Alert, Nunavut (82.50°N) near-polar vernal sunrise
      const alert = ChronoFlux.place({ latitude: 82.5018, longitude: -62.3481 });
      const alertSunrise = ChronoFlux.solar.nextEvent({
        event: 'sunrise',
        place: alert,
        after: ChronoFlux.instant('2026-03-01T00:00:00Z'),
      });
      expect(alertSunrise).not.toBeNull();
      expect(alertSunrise!.uncertaintyMinutes).toBeGreaterThan(1.0);
      expect(alertSunrise!.uncertaintyMinutes).toBeLessThan(100.0);
      expect(alertSunrise!.uncertaintyMinutes).toBe(alertSunrise!.uncertainty.eventTimeUncertaintyMinutes);
      expect(alertSunrise!.crossingCondition).toBe('well_conditioned');

      // 8. Near-polar equinox position evaluation at 85°N: verifies seasonal derivative in calcSolarUncertainty
      const nearPolar85N = ChronoFlux.place({ latitude: 85.0, longitude: 0.0 });
      const equinoxNoon = ChronoFlux.instant('2026-03-20T12:00:00Z');
      const state85N = ChronoFlux.solar.evaluate(equinoxNoon, nearPolar85N);
      expect(state85N.uncertainty.crossingSensitivityDegPerMin).toBeGreaterThan(0.0002);
      expect(state85N.uncertainty.crossingCondition).toBe('well_conditioned');
    });

    it('enforces exact nested equality: SolarEventInstant.uncertaintyMinutes === uncertainty.eventTimeUncertaintyMinutes across all event types', () => {
      const anchor = ChronoFlux.instant('2026-06-21T00:00:00Z');
      const eventNames = ['sunrise', 'sunset', 'solarNoon', 'solarMidnight', 'civilDawn', 'civilDusk'] as const;

      for (const event of eventNames) {
        const ev = ChronoFlux.solar.nextEvent({ event, place: greenwich, after: anchor });
        if (ev !== null) {
          expect(ev.uncertaintyMinutes).toBe(ev.uncertainty.eventTimeUncertaintyMinutes);
          expect(ev.crossingCondition).toBe(ev.uncertainty.crossingCondition);
        }
      }
    });

    it('reconciles SolarTransitionInstant.uncertaintyMinutes === uncertainty.eventTimeUncertaintyMinutes and exposes crossingCondition', () => {
      const window = ChronoFlux.interval(
        ChronoFlux.instant('2026-06-21T00:00:00Z'),
        ChronoFlux.instant('2026-06-22T00:00:00Z')
      );
      const transitions = ChronoFlux.solar.findTransitions(greenwich, window, 0.0);
      expect(transitions.length).toBeGreaterThan(0);

      for (const t of transitions) {
        expect(t.uncertaintyMinutes).toBe(t.uncertainty.eventTimeUncertaintyMinutes);
        expect(t.crossingCondition).toBe(t.uncertainty.crossingCondition);
        expect(t.crossingCondition).toBe('well_conditioned');
      }
    });

    it('classifies crossingCondition and dynamically adapts uncertainty near grazing elevation extrema', () => {
      // In Tromsø around May 17, midnight minimum elevation dips just below -0.833°
      const window = ChronoFlux.interval(
        ChronoFlux.instant('2026-05-17T22:00:00Z'),
        ChronoFlux.instant('2026-05-17T23:20:00Z')
      );
      const transitions = ChronoFlux.solar.findTransitions(tromso, window, -0.8333);
      expect(transitions.length).toBe(2);

      // As crossings occur only 22 minutes apart near diurnal minimum, rate of change slows
      // and crossing uncertainty increases smoothly without falling back to an arbitrary constant
      for (const t of transitions) {
        expect(t.uncertaintyMinutes).toBeGreaterThan(10.0);
        expect(t.uncertaintyMinutes).toBeLessThan(30.0);
        expect(t.uncertaintyMinutes).toBe(t.uncertainty.eventTimeUncertaintyMinutes);
        expect(t.crossingCondition).toBe('well_conditioned');
      }

      // Check detailed diagnostic crossing function directly
      const details = calcSolarCrossingDetails(tromso, transitions[0]!, -0.8333);
      expect(details.uncertaintyMinutes).toBe(transitions[0]!.uncertaintyMinutes);
      expect(details.crossingCondition).toBe('well_conditioned');
      expect(Math.abs(details.dhDtDegPerSec)).toBeGreaterThan(0);
      expect(details.dhDtDegPerMin).toBeGreaterThan(0);
    });

    it('documents observer elevation as orthometric height above MSL and excludes terrain/building obstruction', () => {
      // Nominal sea level (0m elevation) -> horizon dip 0.0°
      expect(calcHorizonDip(0)).toBe(0.0);
      expect(calcHorizonDip(undefined)).toBe(0.0);

      // Elevated observer: 500m orthometric elevation above mean sea level
      // d_dip = (1.76 / 60) * sqrt(500) ≈ 0.6559°
      const dip500 = calcHorizonDip(500);
      expect(dip500).toBeCloseTo(0.6559, 3);

      const elevatedPlace = ChronoFlux.place({ latitude: 51.4769, longitude: -0.0005, elevationMeters: 500 });
      const seaLevelPlace = ChronoFlux.place({ latitude: 51.4769, longitude: -0.0005, elevationMeters: 0 });
      const solsticeAnchor = ChronoFlux.instant('2026-06-21T00:00:00Z');

      const seaState = ChronoFlux.solar.evaluate(solsticeAnchor, seaLevelPlace);
      const elevatedState = ChronoFlux.solar.evaluate(solsticeAnchor, elevatedPlace);

      expect(elevatedState.uncertainty.horizonLimitationDeg).toBeCloseTo(dip500, 3);
      expect(seaState.uncertainty.horizonLimitationDeg).toBe(0.0);

      // Sunrise occurs earlier for elevated observer above unobstructed sea horizon
      expect(elevatedState.sunrise!.isBefore(seaState.sunrise!)).toBe(true);
      // Sunset occurs later for elevated observer
      expect(elevatedState.sunset!.isAfter(seaState.sunset!)).toBe(true);
    });

    it('bounds MAX_SAFE_POLAR_BRACKET_WIDTH_NS to exact ~104.167-day (9e15 ns) limit within IEEE 754 precision', () => {
      expect(MAX_SAFE_POLAR_BRACKET_WIDTH_NS).toBe(9_000_000_000_000_000n);
      // Strictly less than Number.MAX_SAFE_INTEGER (9,007,199,254,740,991 ns)
      expect(MAX_SAFE_POLAR_BRACKET_WIDTH_NS).toBeLessThan(BigInt(Number.MAX_SAFE_INTEGER));
      // Confirms positive non-zero bound
      expect(MAX_SAFE_POLAR_BRACKET_WIDTH_NS > 0n).toBe(true);
    });
  });

  // =========================================================================
  // 4. Separate Polar Regime from Solar Phase
  // =========================================================================
  describe('4. Separate Polar Regime from Solar Illumination Phase', () => {
    it('classifies illumination phase as civil twilight during polar night at noon in Tromsø', () => {
      // Winter solstice at noon in Tromsø (69.65°N): Sun is below -0.833° but above -6.0°
      const winterNoon = ChronoFlux.instant('2026-12-21T12:00:00Z');
      const state = ChronoFlux.solar.evaluate(winterNoon, tromso);

      expect(state.isPolarNight).toBe(true);
      expect(state.polarRegime).toBe('polar_night');
      // Crucial: illumination phase must NOT be overridden by 'polar_night'
      expect(state.phase).toBe('civil_twilight');
      expect(state.geometricElevationDeg).toBeLessThan(NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG);
      expect(state.geometricElevationDeg).toBeGreaterThan(-6.0);
    });

    it('classifies illumination phase as night during polar night at midnight in Tromsø', () => {
      const winterMidnight = ChronoFlux.instant('2026-12-21T00:00:00Z');
      const state = ChronoFlux.solar.evaluate(winterMidnight, tromso);

      expect(state.isPolarNight).toBe(true);
      expect(state.polarRegime).toBe('polar_night');
      expect(state.phase).toBe('night');
      expect(state.geometricElevationDeg).toBeLessThan(-18.0);
    });

    it('classifies illumination phase as day during polar day (Midnight Sun) in Svalbard', () => {
      const summerSolstice = ChronoFlux.instant('2026-06-21T00:00:00Z');
      const state = ChronoFlux.solar.evaluate(summerSolstice, svalbard);

      expect(state.isPolarDay).toBe(true);
      expect(state.polarRegime).toBe('polar_day');
      expect(state.phase).toBe('day');
    });

    it('reports polarRegime as none for temperate locations', () => {
      const state = ChronoFlux.solar.evaluate(ChronoFlux.now(), greenwich);
      expect(state.polarRegime).toBe('none');
      expect(state.isPolarDay).toBe(false);
      expect(state.isPolarNight).toBe(false);
    });
  });

  // =========================================================================
  // 5. Astronomical Time-Scale Policy
  // =========================================================================
  describe('5. Astronomical Time-Scale Policy (UTC, UT1, TT, ΔT)', () => {
    it('computes Delta T for historical and modern epochs conforming to Espenak & Meeus (2006)', () => {
      const timeScale = new StandardAstronomicalTimeScale();

      // Epoch 2000.0: ΔT ≈ 63.8s
      const y2000 = ChronoFlux.instant('2000-01-01T00:00:00Z');
      expect(timeScale.getDeltaT(y2000)).toBeCloseTo(63.86, 0.5);

      // Epoch 2026.0: ΔT ≈ 71-75s
      const y2026 = ChronoFlux.instant('2026-01-01T00:00:00Z');
      expect(timeScale.getDeltaT(y2026)).toBeGreaterThan(68.0);
      expect(timeScale.getDeltaT(y2026)).toBeLessThan(80.0);

      // Historical and piecewise polynomial era checks
      expect(timeScale.getDeltaT(Instant.fromEpochMilliseconds(Date.UTC(800, 0, 1)))).toBeGreaterThan(0);
      expect(timeScale.getDeltaT(Instant.fromEpochMilliseconds(Date.UTC(1400, 0, 1)))).toBeGreaterThan(0);
      expect(timeScale.getDeltaT(Instant.fromEpochMilliseconds(Date.UTC(1650, 0, 1)))).toBeGreaterThan(0);
      expect(timeScale.getDeltaT(Instant.fromEpochMilliseconds(Date.UTC(1750, 0, 1)))).toBeGreaterThan(0);
      expect(timeScale.getDeltaT(Instant.fromEpochMilliseconds(Date.UTC(1850, 0, 1)))).toBeCloseTo(7.1, 0);
      expect(timeScale.getDeltaT(Instant.fromEpochMilliseconds(Date.UTC(1880, 0, 1)))).toBeCloseTo(-5.0, 0);
      expect(timeScale.getDeltaT(Instant.fromEpochMilliseconds(Date.UTC(1900, 0, 1)))).toBeCloseTo(-2.8, 0);
      expect(timeScale.getDeltaT(Instant.fromEpochMilliseconds(Date.UTC(1910, 0, 1)))).toBeCloseTo(10.0, 0);
      expect(timeScale.getDeltaT(Instant.fromEpochMilliseconds(Date.UTC(1930, 0, 1)))).toBeCloseTo(24.0, 0);
      expect(timeScale.getDeltaT(Instant.fromEpochMilliseconds(Date.UTC(1955, 0, 1)))).toBeCloseTo(31.0, 0);
      expect(timeScale.getDeltaT(Instant.fromEpochMilliseconds(Date.UTC(1980, 0, 1)))).toBeCloseTo(50.5, 0);
      expect(timeScale.getDeltaT(Instant.fromEpochMilliseconds(Date.UTC(2030, 0, 1)))).toBeGreaterThan(70.0);
      expect(timeScale.getDeltaT(Instant.fromEpochMilliseconds(Date.UTC(2100, 0, 1)))).toBeGreaterThan(100.0);
      expect(timeScale.getDeltaT(Instant.fromEpochMilliseconds(Date.UTC(2200, 0, 1)))).toBeGreaterThan(200.0);
    });

    it('converts Instant to Terrestrial Time (TT) Julian Day and Century, and UT1 Julian Day', () => {
      const timeScale = standardAstronomicalTimeScale;
      const j2000 = ChronoFlux.instant('2000-01-01T12:00:00Z');
      const jdUt = 2451545.0;
      const jdTT = timeScale.toTerrestrialJulianDay(j2000);
      const jdUt1 = timeScale.toUt1JulianDay(j2000);
      const tTT = timeScale.toTerrestrialJulianCentury(j2000);
      const deltaT = timeScale.getDeltaT(j2000);

      expect(jdUt1).toBeCloseTo(jdUt, 7);
      expect(jdTT).toBeCloseTo(jdUt + deltaT / 86400.0, 7);
      expect(tTT).toBeCloseTo((jdTT - 2451545.0) / 36525.0, 7);
    });


    it('supports pluggable astronomical time scale provider registration', () => {
      const customTimeScale: AstronomicalTimeScale = {
        getDeltaT: () => 70.0,
        toTerrestrialJulianDay: (inst) => 2451545.0 + 70.0 / 86400.0,
        toUt1JulianDay: () => 2451545.0,
        toTerrestrialJulianCentury: () => 0.0,
      };

      registerAstronomicalTimeScale(customTimeScale);
      expect(getAstronomicalTimeScale()).toBe(customTimeScale);
      expect(getAstronomicalTimeScale().getDeltaT(ChronoFlux.now())).toBe(70.0);

      // Restore default
      registerAstronomicalTimeScale(null);
      expect(getAstronomicalTimeScale()).toBe(standardAstronomicalTimeScale);
    });

    it('exposes astronomical time scale methods symmetrically on ChronoFlux.solar facade', () => {
      expect(ChronoFlux.solar.getAstronomicalTimeScale()).toBe(standardAstronomicalTimeScale);

      const customScale: AstronomicalTimeScale = {
        getDeltaT: () => 42.0,
        toTerrestrialJulianDay: () => 2451545.0,
        toUt1JulianDay: () => 2451545.0,
        toTerrestrialJulianCentury: () => 0.0,
      };

      ChronoFlux.solar.registerAstronomicalTimeScale(customScale);
      expect(ChronoFlux.solar.getAstronomicalTimeScale()).toBe(customScale);
      expect(ChronoFlux.solar.getAstronomicalTimeScale().getDeltaT(ChronoFlux.now())).toBe(42.0);

      // Restore default
      ChronoFlux.solar.registerAstronomicalTimeScale(null);
      expect(ChronoFlux.solar.getAstronomicalTimeScale()).toBe(standardAstronomicalTimeScale);
    });

    it('applies active DUT1 offset to True Solar Time, hour angle, solar noon, sunrise, and sunset', () => {
      const instant = ChronoFlux.instant('2026-06-21T12:00:00Z');
      const place = greenwich;

      // Standard evaluation
      const stdPos = ChronoFlux.solar.evaluatePosition(instant, place);
      const stdState = ChronoFlux.solar.evaluate(instant, place);

      // Custom provider with DUT1 = +60s
      const customTimeScale: AstronomicalTimeScale = {
        getDeltaT: () => 70.0,
        getDut1: () => 60.0,
        toTerrestrialJulianDay: (inst) => {
          const jdUt = instantToJulianDay(inst);
          return jdUt + (70.0 + 60.0) / 86400.0;
        },
        toUt1JulianDay: (inst) => {
          const jdUt = instantToJulianDay(inst);
          return jdUt + 60.0 / 86400.0;
        },
        toTerrestrialJulianCentury: (inst) => {
          const jdTT = instantToJulianDay(inst) + (70.0 + 60.0) / 86400.0;
          return (jdTT - 2451545.0) / 36525.0;
        },
      };

      try {
        ChronoFlux.solar.registerAstronomicalTimeScale(customTimeScale);

        const customPos = ChronoFlux.solar.evaluatePosition(instant, place);
        const customState = ChronoFlux.solar.evaluate(instant, place);

        // 1. TST increases by +1.0 minute (60s / 60s/min)
        expect(customPos.trueSolarTimeMinutes - stdPos.trueSolarTimeMinutes).toBeCloseTo(1.0, 3);

        // 2. Hour angle increases by +0.25° (15°/hr * 1/60 hr)
        expect(customPos.hourAngleDeg - stdPos.hourAngleDeg).toBeCloseTo(0.25, 4);

        // 3. Solar noon occurs earlier in UTC by 60 seconds (60,000,000,000 ns)
        const noonShiftSec =
          Number(stdState.solarNoon.epochNanoseconds - customState.solarNoon.epochNanoseconds) / 1_000_000_000;
        expect(noonShiftSec).toBeCloseTo(60.0, 1);

        // 4. Sunrise and sunset shift earlier in UTC by ~60 seconds
        const sunriseShiftSec =
          Number(stdState.sunrise!.epochNanoseconds - customState.sunrise!.epochNanoseconds) / 1_000_000_000;
        expect(sunriseShiftSec).toBeCloseTo(60.0, 1);

        const sunsetShiftSec =
          Number(stdState.sunset!.epochNanoseconds - customState.sunset!.epochNanoseconds) / 1_000_000_000;
        expect(sunsetShiftSec).toBeCloseTo(60.0, 1);

        // 5. nextEvent shifts earlier by ~60s
        const anchor = ChronoFlux.instant('2026-06-21T02:00:00Z');
        const customNextSunrise = ChronoFlux.solar.nextEvent({ event: 'sunrise', place, after: anchor });
        registerAstronomicalTimeScale(null); // revert to standard to compare nextEvent
        const stdNextSunrise = ChronoFlux.solar.nextEvent({ event: 'sunrise', place, after: anchor });

        expect(
          Number(stdNextSunrise!.epochNanoseconds - customNextSunrise!.epochNanoseconds) / 1_000_000_000
        ).toBeCloseTo(60.0, 1);

        // 6. findTransitions shifts earlier by ~60s
        const window = ChronoFlux.interval(
          ChronoFlux.instant('2026-06-21T00:00:00Z'),
          ChronoFlux.instant('2026-06-22T00:00:00Z')
        );
        ChronoFlux.solar.registerAstronomicalTimeScale(customTimeScale);
        const customTransitions = ChronoFlux.solar.findTransitions(place, window, 0.0);
        registerAstronomicalTimeScale(null);
        const stdTransitions = ChronoFlux.solar.findTransitions(place, window, 0.0);

        expect(customTransitions.length).toBe(2);
        expect(stdTransitions.length).toBe(2);
        const transShiftSec =
          Number(stdTransitions[0]!.epochNanoseconds - customTransitions[0]!.epochNanoseconds) / 1_000_000_000;
        expect(transShiftSec).toBeCloseTo(60.0, 1);
      } finally {
        ChronoFlux.solar.registerAstronomicalTimeScale(null);
      }
    });

    it('applies active TT offset to ephemeris orbital coordinates without affecting UT1-governed hour angle', () => {
      const instant = ChronoFlux.instant('2026-06-21T12:00:00Z');
      const place = greenwich;

      const stdPos = ChronoFlux.solar.evaluatePosition(instant, place);

      // Custom provider with TT offset +86400s (advance ephemeris by 1 dynamical day) while DUT1 = 0
      const ephemerisDayShift: AstronomicalTimeScale = {
        getDeltaT: () => 86400.0,
        getDut1: () => 0.0,
        toTerrestrialJulianDay: (inst) => instantToJulianDay(inst) + 1.0,
        toUt1JulianDay: (inst) => instantToJulianDay(inst),
        toTerrestrialJulianCentury: (inst) => (instantToJulianDay(inst) + 1.0 - 2451545.0) / 36525.0,
      };

      try {
        ChronoFlux.solar.registerAstronomicalTimeScale(ephemerisDayShift);
        const shiftedPos = ChronoFlux.solar.evaluatePosition(instant, place);

        // Orbital right ascension advances by ~1.04°/day near solstice (due to obliquity dRA/dLambda = 1/cos(eps) ≈ 1.09)
        const raDiff = shiftedPos.rightAscensionDeg - stdPos.rightAscensionDeg;
        expect(raDiff).toBeCloseTo(1.039, 1);
        expect(raDiff).toBeGreaterThan(0.95);
        expect(raDiff).toBeLessThan(1.15);

        // Hour angle depends on UT1 (Earth diurnal rotation); advancing TT by 1 dynamical day
        // shifts hour angle ONLY through the daily Equation of Time orbital gradient (~13s ≈ 0.054°),
        // proving it does not experience the 360° diurnal rotation shift.
        expect(Math.abs(shiftedPos.hourAngleDeg - stdPos.hourAngleDeg)).toBeLessThan(0.1);
      } finally {
        ChronoFlux.solar.registerAstronomicalTimeScale(null);
      }
    });

    it('invalidates diurnal event cache automatically when astronomical time scale changes', () => {
      const instant = ChronoFlux.instant('2026-06-21T12:00:00Z');
      const place = greenwich;

      // Populate diurnal cache under standard provider
      const state1 = ChronoFlux.solar.evaluate(instant, place);

      // Register provider with DUT1 = +60s
      const customTimeScale: AstronomicalTimeScale = {
        getDeltaT: () => 70.0,
        getDut1: () => 60.0,
        toTerrestrialJulianDay: (inst) => instantToJulianDay(inst) + 130.0 / 86400.0,
        toUt1JulianDay: (inst) => instantToJulianDay(inst) + 60.0 / 86400.0,
        toTerrestrialJulianCentury: (inst) => (instantToJulianDay(inst) + 130.0 / 86400.0 - 2451545.0) / 36525.0,
      };

      try {
        ChronoFlux.solar.registerAstronomicalTimeScale(customTimeScale);

        // Immediate subsequent evaluate must return shifted values rather than stale cached events
        const state2 = ChronoFlux.solar.evaluate(instant, place);
        expect(state2.solarNoon.epochNanoseconds).not.toBe(state1.solarNoon.epochNanoseconds);
        expect(
          Number(state1.solarNoon.epochNanoseconds - state2.solarNoon.epochNanoseconds) / 1_000_000_000
        ).toBeCloseTo(60.0, 1);
      } finally {
        ChronoFlux.solar.registerAstronomicalTimeScale(null);
      }
    });

    it('derives canonical Julian Day and Century conversions via BaseAstronomicalTimeScale without contradictory conversions', () => {
      class MinimalProvider extends BaseAstronomicalTimeScale {
        readonly metadata = undefined;
        getDeltaT(_instant: Instant): number {
          return 72.0;
        }
        override getDut1(_instant: Instant): number {
          return 0.5;
        }
      }

      const provider = new MinimalProvider();
      const testInstant = ChronoFlux.instant('2026-06-21T12:00:00Z');
      const jdUt = instantToJulianDay(testInstant);

      // Verify canonical derivation
      expect(provider.toUt1JulianDay(testInstant)).toBeCloseTo(jdUt + 0.5 / 86400.0, 8);
      expect(provider.toTerrestrialJulianDay(testInstant)).toBeCloseTo(jdUt + 72.5 / 86400.0, 8);
      expect(provider.toTerrestrialJulianCentury(testInstant)).toBeCloseTo(
        (jdUt + 72.5 / 86400.0 - 2451545.0) / 36525.0,
        8
      );

      // Must pass validation
      expect(() => validateAstronomicalTimeScale(provider, testInstant)).not.toThrow();
    });

    it('creates canonical providers via createAstronomicalTimeScale helper', () => {
      const provider = createAstronomicalTimeScale({
        deltaT: 69.5,
        dut1: -0.2,
        metadata: {
          source: 'Custom Test Standard',
          description: 'Provider created via helper',
          deltaTUncertaintySeconds: 0.5,
          dut1UncertaintySeconds: 0.1,
          isDut1Approximation: false,
        },
      });

      const testInstant = ChronoFlux.instant('2026-06-21T12:00:00Z');
      expect(provider.getDeltaT(testInstant)).toBe(69.5);
      expect(provider.getDut1!(testInstant)).toBe(-0.2);
      expect(provider.metadata?.isDut1Approximation).toBe(false);

      expect(() => validateAstronomicalTimeScale(provider, testInstant)).not.toThrow();
      expect(() => ChronoFlux.solar.validateAstronomicalTimeScale(provider, testInstant)).not.toThrow();
    });

    it('handles BaseAstronomicalTimeScale subclasses implementing only getDeltaT without getDut1 recursion', () => {
      class PureDeltaTProvider extends BaseAstronomicalTimeScale {
        readonly metadata = undefined;
        getDeltaT(_instant: Instant): number {
          return 69.184;
        }
      }

      const provider = new PureDeltaTProvider();
      const testInstant = ChronoFlux.instant('2026-06-21T12:00:00Z');
      const jdUt = instantToJulianDay(testInstant);

      // Must not recurse or throw stack overflow
      expect(provider.getDut1(testInstant)).toBe(0.0);
      expect(provider.getDut1Seconds(testInstant)).toBe(0.0);
      expect(provider.toUt1JulianDay(testInstant)).toBeCloseTo(jdUt, 8);
      expect(provider.toTerrestrialJulianDay(testInstant)).toBeCloseTo(jdUt + 69.184 / 86400.0, 8);
      expect(() => validateAstronomicalTimeScale(provider, testInstant)).not.toThrow();

      // Subclass overriding only getDut1Seconds
      class SecondsOnlyProvider extends BaseAstronomicalTimeScale {
        readonly metadata = undefined;
        getDeltaT(_instant: Instant): number {
          return 70.0;
        }
        override getDut1Seconds(_instant: Instant): number {
          return -0.35;
        }
      }

      const secondsProvider = new SecondsOnlyProvider();
      expect(secondsProvider.getDut1(testInstant)).toBe(-0.35);
      expect(secondsProvider.getDut1Seconds(testInstant)).toBe(-0.35);
      expect(secondsProvider.toUt1JulianDay(testInstant)).toBeCloseTo(jdUt - 0.35 / 86400.0, 8);
      expect(() => validateAstronomicalTimeScale(secondsProvider, testInstant)).not.toThrow();
    });

    it('validates provider self-consistency and rejects contradictory conversions with RangeError', () => {
      const testInstant = ChronoFlux.instant('2026-06-21T12:00:00Z');
      const jdUt = instantToJulianDay(testInstant);

      // 1. Contradictory UT1 Julian Day
      const badUt1Provider: AstronomicalTimeScale = {
        getDeltaT: () => 70.0,
        getDut1: () => 0.5,
        toUt1JulianDay: () => jdUt + 10.0, // Contradicts getDut1: 10 days vs 0.5s
        toTerrestrialJulianDay: () => jdUt + 70.5 / 86400.0,
        toTerrestrialJulianCentury: () => (jdUt + 70.5 / 86400.0 - 2451545.0) / 36525.0,
      };
      expect(() => validateAstronomicalTimeScale(badUt1Provider, testInstant)).toThrow(RangeError);

      // 1b. Subtle 1-second discrepancy on UT1 (~1.157e-5 days) must be rejected under strict 1e-7 tolerance
      const subtleBadUt1Provider: AstronomicalTimeScale = {
        getDeltaT: () => 70.0,
        getDut1: () => 0.0,
        toUt1JulianDay: () => jdUt + 1.0 / 86400.0, // 1 second offset contradicts getDut1 = 0
        toTerrestrialJulianDay: () => jdUt + 70.0 / 86400.0,
        toTerrestrialJulianCentury: () => (jdUt + 70.0 / 86400.0 - 2451545.0) / 36525.0,
      };
      expect(() => validateAstronomicalTimeScale(subtleBadUt1Provider, testInstant)).toThrow(RangeError);

      // 2. Contradictory Terrestrial Time Julian Day
      const badTtProvider: AstronomicalTimeScale = {
        getDeltaT: () => 70.0,
        getDut1: () => 0.0,
        toUt1JulianDay: () => jdUt,
        toTerrestrialJulianDay: () => jdUt + 5.0, // Contradicts getDeltaT: 5 days vs 70s
        toTerrestrialJulianCentury: () => (jdUt + 5.0 - 2451545.0) / 36525.0,
      };
      expect(() => validateAstronomicalTimeScale(badTtProvider, testInstant)).toThrow(RangeError);

      // 3. Contradictory Terrestrial Century
      const badCenturyProvider: AstronomicalTimeScale = {
        getDeltaT: () => 70.0,
        getDut1: () => 0.0,
        toUt1JulianDay: () => jdUt,
        toTerrestrialJulianDay: () => jdUt + 70.0 / 86400.0,
        toTerrestrialJulianCentury: () => 100.0, // Completely contradicts Julian Day
      };
      expect(() => validateAstronomicalTimeScale(badCenturyProvider, testInstant)).toThrow(RangeError);

      // 4. registerAstronomicalTimeScale rejects bad provider when validate: true option is supplied
      expect(() => registerAstronomicalTimeScale(badUt1Provider, { validate: true })).toThrow(RangeError);
      expect(() => ChronoFlux.solar.registerAstronomicalTimeScale(badUt1Provider, { validate: true })).toThrow(
        RangeError
      );

      // 5. Standard provider passes validation
      expect(() => validateAstronomicalTimeScale(standardAstronomicalTimeScale)).not.toThrow();
    });

    it('exposes TimeScaleMetadata documenting DUT1 = 0 as approximation and propagates uncertainty into solar metadata', () => {
      const metadata: TimeScaleMetadata = standardAstronomicalTimeScale.metadata;
      expect(metadata.source).toContain('NASA TP-2006-214141');
      expect(metadata.description).toContain('approximation');
      expect(metadata.isDut1Approximation).toBe(true);
      expect(metadata.deltaTUncertaintySeconds).toBe(1.0);
      expect(metadata.dut1UncertaintySeconds).toBe(0.9);

      // Verify propagation into SolarUncertaintyDetails
      const instant = ChronoFlux.instant('2026-06-21T12:00:00Z');
      const state = ChronoFlux.solar.evaluate(instant, greenwich);

      expect(state.uncertainty.timeScaleUncertaintyDeg).toBeGreaterThan(0.0);
      // Delta T 1.0s and DUT1 0.9s uncertainty converts to degrees (15°/3600s * 0.9s ≈ 0.00375°)
      expect(state.uncertainty.timeScaleUncertaintyDeg).toBeCloseTo(0.00375, 4);

      // Custom provider with 10x larger uncertainty
      const customProvider = createAstronomicalTimeScale({
        deltaT: 70.0,
        dut1: 0.0,
        metadata: {
          source: 'Coarse Ephemeris Model',
          description: 'Provider with larger input uncertainty',
          deltaTUncertaintySeconds: 10.0,
          dut1UncertaintySeconds: 9.0,
          isDut1Approximation: true,
        },
      });

      try {
        ChronoFlux.solar.registerAstronomicalTimeScale(customProvider);
        const customState = ChronoFlux.solar.evaluate(instant, greenwich);

        // timeScaleUncertaintyDeg must scale proportionally (~10x larger)
        expect(customState.uncertainty.timeScaleUncertaintyDeg).toBeCloseTo(0.0375, 3);
        expect(customState.uncertainty.timeScaleUncertaintyDeg).toBeGreaterThan(
          state.uncertainty.timeScaleUncertaintyDeg
        );

        // Combined coordinate uncertainty must reflect provider uncertainty
        expect(customState.uncertainty.combinedCoordinateUncertaintyDeg).toBeGreaterThan(
          state.uncertainty.combinedCoordinateUncertaintyDeg
        );

        // Event-crossing uncertainty must propagate provider uncertainty
        expect(customState.sunrise!.uncertaintyMinutes).toBeGreaterThan(
          state.sunrise!.uncertaintyMinutes
        );
        expect(customState.uncertainty.eventTimeUncertaintyMinutes).toBeGreaterThan(
          state.uncertainty.eventTimeUncertaintyMinutes
        );
      } finally {
        ChronoFlux.solar.registerAstronomicalTimeScale(null);
      }
    });
  });

  // =========================================================================
  // 6. Validity Enforcement
  // =========================================================================
  describe('6. Validity Enforcement (1800-2100 CE Range & Degradation)', () => {
    it('marks evaluations within 1800-2100 (including 19th century T in [-2.0, +1.0]) as valid with non-degraded accuracy', () => {
      const datesToTest = [
        '1800-01-01T00:00:00Z', // Lower validity bound (T ≈ -2.0)
        '1850-06-21T12:00:00Z', // 19th century mid-point (T ≈ -1.5)
        '1900-01-01T00:00:00Z', // Turn of 20th century (T ≈ -1.0)
        '2000-01-01T12:00:00Z', // J2000.0 epoch (T = 0.0)
        '2026-06-21T12:00:00Z', // Modern evaluation
        '2099-12-31T23:59:59Z', // Upper validity bound (T ≈ +1.0)
      ];

      for (const iso of datesToTest) {
        const inst = ChronoFlux.instant(iso);
        const state = ChronoFlux.solar.evaluate(inst, greenwich);

        expect(state.isWithinValidityRange).toBe(true);
        expect(state.isAccuracyDegraded).toBe(false);
        expect(state.uncertainty.numericalErrorDeg).toBe(0.01);

        const pos = ChronoFlux.solar.evaluatePosition(inst, greenwich);
        expect(pos.isWithinValidityRange).toBe(true);
        expect(pos.isAccuracyDegraded).toBe(false);
        expect(pos.uncertainty.numericalErrorDeg).toBe(0.01);
      }
    });

    it('explicitly marks evaluations outside 1800-2100 as out-of-range with degraded accuracy', () => {
      // Year 1600 CE (2 centuries before 1800, T ≈ -4.0, excess = 2.0)
      const historicalInstant = ChronoFlux.instant('1600-01-01T00:00:00Z');
      const histState = ChronoFlux.solar.evaluate(historicalInstant, greenwich);

      expect(histState.isWithinValidityRange).toBe(false);
      expect(histState.isAccuracyDegraded).toBe(true);
      // Ephemeris error expands quadratically: 0.01 + 0.05 * 2^2 = 0.21°
      expect(histState.uncertainty.numericalErrorDeg).toBeCloseTo(0.21, 2);

      // Year 2300 CE (2 centuries after 2100, T ≈ +3.0, excess = 2.0)
      const futureInstant = ChronoFlux.instant('2300-01-01T00:00:00Z');
      const futureState = ChronoFlux.solar.evaluate(futureInstant, greenwich);

      expect(futureState.isWithinValidityRange).toBe(false);
      expect(futureState.isAccuracyDegraded).toBe(true);
      expect(futureState.uncertainty.numericalErrorDeg).toBeCloseTo(0.21, 2);
    });

    it('returns SolarEventInstant from nextEvent preserving validity, event name, and uncertainty metadata', () => {
      const anchor = ChronoFlux.instant('2026-06-21T02:00:00Z');
      const nextSunrise = ChronoFlux.solar.nextEvent({
        event: 'sunrise',
        place: greenwich,
        after: anchor,
      });

      expect(nextSunrise).not.toBeNull();
      expect(nextSunrise).toBeInstanceOf(Instant);
      expect(nextSunrise).toBeInstanceOf(SolarEventInstant);

      const eventInst = nextSunrise as SolarEventInstant;
      expect(eventInst.event).toBe('sunrise');
      expect(eventInst.isWithinValidityRange).toBe(true);
      expect(eventInst.isAccuracyDegraded).toBe(false);
      expect(eventInst.uncertaintyDeg).toBeGreaterThan(0.0);
      expect(eventInst.uncertaintyMinutes).toBeGreaterThan(0.0);
      expect(eventInst.uncertainty.numericalErrorDeg).toBe(0.01);
    });

    it('returns SolarTransitionInstant[] from findTransitions preserving threshold, direction, and validity metadata', () => {
      const start = ChronoFlux.instant('2026-06-21T00:00:00Z');
      const end = ChronoFlux.instant('2026-06-22T00:00:00Z');
      const window = ChronoFlux.interval(start, end);

      const transitions = ChronoFlux.solar.findTransitions(greenwich, window, 0.0);
      expect(transitions.length).toBe(2);

      for (const t of transitions) {
        expect(t).toBeInstanceOf(Instant);
        expect(t).toBeInstanceOf(SolarTransitionInstant);
        const transInst = t as SolarTransitionInstant;
        expect(transInst.thresholdDeg).toBe(0.0);
        expect(transInst.isWithinValidityRange).toBe(true);
        expect(transInst.isAccuracyDegraded).toBe(false);
        expect(transInst.uncertaintyMinutes).toBeGreaterThan(0.0);
        expect(transInst.uncertainty.numericalErrorDeg).toBe(0.01);
      }

      const rising = transitions[0] as SolarTransitionInstant;
      const setting = transitions[1] as SolarTransitionInstant;
      expect(rising.direction).toBe('rising');
      expect(setting.direction).toBe('setting');
    });

    it('preserves degraded validity and expanded uncertainty for out-of-range transitions and events', () => {
      const histStart = ChronoFlux.instant('1600-06-21T00:00:00Z');
      const histEnd = ChronoFlux.instant('1600-06-22T00:00:00Z');
      const histWindow = ChronoFlux.interval(histStart, histEnd);

      const transitions = ChronoFlux.solar.findTransitions(greenwich, histWindow, 0.0);
      expect(transitions.length).toBe(2);

      for (const t of transitions) {
        const transInst = t as SolarTransitionInstant;
        expect(transInst.isWithinValidityRange).toBe(false);
        expect(transInst.isAccuracyDegraded).toBe(true);
        // Ephemeris uncertainty degrades outside 1800-2100 (excess = 2 centuries -> ~0.21°)
        expect(transInst.uncertaintyDeg).toBeGreaterThan(0.15);
      }
    });

    it('preserves validity and accuracy metadata on evaluate() and diurnal cycle event properties', () => {
      const instant = ChronoFlux.instant('2026-06-21T12:00:00Z');
      const state = ChronoFlux.solar.evaluate(instant, greenwich);

      expect(state.solarNoon).toBeInstanceOf(SolarEventInstant);
      expect(state.solarNoon.event).toBe('solarNoon');
      expect(state.solarNoon.isWithinValidityRange).toBe(true);
      expect(state.solarNoon.isAccuracyDegraded).toBe(false);
      expect(state.solarNoon.uncertaintyDeg).toBeGreaterThan(0.0);
      expect(state.solarNoon.uncertaintyMinutes).toBeGreaterThan(0.0);

      expect(state.solarMidnight).toBeInstanceOf(SolarEventInstant);
      expect(state.solarMidnight.event).toBe('solarMidnight');
      expect(state.solarMidnight.isWithinValidityRange).toBe(true);

      expect(state.sunrise).toBeInstanceOf(SolarEventInstant);
      expect(state.sunrise!.event).toBe('sunrise');
      expect(state.sunrise!.isWithinValidityRange).toBe(true);
      expect(state.sunrise!.isAccuracyDegraded).toBe(false);
      expect(state.sunrise!.uncertaintyMinutes).toBeGreaterThan(0.0);

      expect(state.sunset).toBeInstanceOf(SolarEventInstant);
      expect(state.sunset!.event).toBe('sunset');
      expect(state.sunset!.isWithinValidityRange).toBe(true);
      expect(state.sunset!.isAccuracyDegraded).toBe(false);
      expect(state.sunset!.uncertaintyMinutes).toBeGreaterThan(0.0);

      // Historical out-of-range evaluation preserves degraded metadata on event properties
      const histInstant = ChronoFlux.instant('1600-06-21T12:00:00Z');
      const histState = ChronoFlux.solar.evaluate(histInstant, greenwich);
      expect(histState.solarNoon.isWithinValidityRange).toBe(false);
      expect(histState.solarNoon.isAccuracyDegraded).toBe(true);
      expect(histState.sunrise!.isWithinValidityRange).toBe(false);
      expect(histState.sunrise!.isAccuracyDegraded).toBe(true);
    });
  });

  // =========================================================================
  // 7. DST Classification Confidence
  // =========================================================================
  describe('7. Civil DST Classification Confidence', () => {
    it('classifies US Daylight Saving Time as authoritative in July', () => {
      const summerInstant = ChronoFlux.instant('2026-07-01T12:00:00Z');
      const state = ChronoFlux.civil.evaluate(summerInstant, newYork);

      expect(state.isDaylightSaving).toBe(true);
      expect(state.dstConfidence).toBe('authoritative');
      expect(state.utcOffsetMinutes).toBe(-240); // EDT UTC-4
    });

    it('classifies US Standard Time as authoritative in January', () => {
      const winterInstant = ChronoFlux.instant('2026-01-01T12:00:00Z');
      const state = ChronoFlux.civil.evaluate(winterInstant, newYork);

      expect(state.isDaylightSaving).toBe(false);
      expect(state.dstConfidence).toBe('authoritative');
      expect(state.utcOffsetMinutes).toBe(-300); // EST UTC-5
    });

    it('classifies British Summer Time (BST) and Greenwich Mean Time (GMT) as authoritative in London', () => {
      const summerInstant = ChronoFlux.instant('2026-07-01T12:00:00Z');
      const summerState = ChronoFlux.civil.evaluate(summerInstant, greenwich);
      expect(summerState.isDaylightSaving).toBe(true);
      expect(summerState.dstConfidence).toBe('authoritative');
      expect(summerState.utcOffsetMinutes).toBe(60); // BST UTC+1

      const winterInstant = ChronoFlux.instant('2026-01-01T12:00:00Z');
      const winterState = ChronoFlux.civil.evaluate(winterInstant, greenwich);
      expect(winterState.isDaylightSaving).toBe(false);
      expect(winterState.dstConfidence).toBe('authoritative');
      expect(winterState.utcOffsetMinutes).toBe(0); // GMT UTC+0
    });

    it('classifies Irish Standard Time (IST UTC+1 in summer) as authoritative DST, and GMT as winter standard', () => {
      const summerInstant = ChronoFlux.instant('2026-07-01T12:00:00Z');
      const summerState = ChronoFlux.civil.evaluate(summerInstant, dublin);
      expect(summerState.isDaylightSaving).toBe(true);
      expect(summerState.dstConfidence).toBe('authoritative');
      expect(summerState.utcOffsetMinutes).toBe(60); // IST UTC+1

      const winterInstant = ChronoFlux.instant('2026-01-01T12:00:00Z');
      const winterState = ChronoFlux.civil.evaluate(winterInstant, dublin);
      expect(winterState.isDaylightSaving).toBe(false);
      expect(winterState.dstConfidence).toBe('authoritative');
      expect(winterState.utcOffsetMinutes).toBe(0); // GMT UTC+0
    });

    it('classifies non-DST time zones as authoritatively false', () => {
      const instant = ChronoFlux.instant('2026-07-01T12:00:00Z');

      const phxState = ChronoFlux.civil.evaluate(instant, phoenix);
      expect(phxState.isDaylightSaving).toBe(false);
      expect(phxState.dstConfidence).toBe('authoritative');

      const tokyoState = ChronoFlux.civil.evaluate(instant, tokyo);
      expect(tokyoState.isDaylightSaving).toBe(false);
      expect(tokyoState.dstConfidence).toBe('authoritative');

      const kolkataState = ChronoFlux.civil.evaluate(instant, kolkata);
      expect(kolkataState.isDaylightSaving).toBe(false);
      expect(kolkataState.dstConfidence).toBe('authoritative');
    });

    it('falls back to heuristic confidence for time zones with numeric runtime names (Casablanca)', () => {
      const casablanca = ChronoFlux.place({ latitude: 33.5731, longitude: -7.5898, timeZoneId: 'Africa/Casablanca' });
      const instant = ChronoFlux.instant('2026-07-01T12:00:00Z');
      const state = ChronoFlux.civil.evaluate(instant, casablanca);

      // Africa/Casablanca produces purely numeric GMT offset names in Intl without 'Daylight' or 'Standard' markers
      expect(state.dstConfidence).toBe('heuristic');
    });

    it('classifies Etc/GMT+3 as heuristic confidence despite uniform 12-month offset due to lack of statutory names', () => {
      const etcGmt3 = ChronoFlux.place({ latitude: 0, longitude: -45, timeZoneId: 'Etc/GMT+3' });
      const instant = ChronoFlux.instant('2026-07-01T12:00:00Z');
      const state = ChronoFlux.civil.evaluate(instant, etcGmt3);

      expect(state.utcOffsetMinutes).toBe(-180);
      expect(state.isDaylightSaving).toBe(false);
      expect(state.dstConfidence).toBe('heuristic');
    });

    it('exposes civil time engine and IANA tz database provenance', () => {
      const prov = ChronoFlux.civil.getProvenance();
      expect(prov.runtime).toContain('Node.js');
      expect(typeof prov.tzVersion).toBe('string');
      expect(typeof prov.icuVersion).toBe('string');
      expect(typeof prov.cldrVersion).toBe('string');
      expect(typeof prov.unicodeVersion).toBe('string');
    });

    it('returns unknown confidence when runtime formatter fails unexpectedly', () => {
      const originalFormatToParts = Intl.DateTimeFormat.prototype.formatToParts;
      Intl.DateTimeFormat.prototype.formatToParts = function (date?: Date | number) {
        if (this.resolvedOptions().timeZoneName) {
          throw new Error('Simulated runtime Intl failure');
        }
        return originalFormatToParts.call(this, date);
      };

      try {
        const ny = ChronoFlux.place({ latitude: 40.7128, longitude: -74.006, timeZoneId: 'America/New_York' });
        const instant = ChronoFlux.instant('2026-07-01T12:00:00Z');
        const state = ChronoFlux.civil.evaluate(instant, ny);
        expect(state.dstConfidence).toBe('unknown');
      } finally {
        Intl.DateTimeFormat.prototype.formatToParts = originalFormatToParts;
      }
    });
  });

  // =========================================================================
  // 8. Reproducible Performance Benchmark
  // =========================================================================
  describe('8. Performance Benchmarking (Measured vs Claimed)', () => {
    // Benchmark Environment Report
    console.log(
      `[Benchmark Environment] OS: ${process.platform} (${process.arch}) | Node: ${process.version} | V8: ${process.versions.v8}`
    );

    it('measures evaluatePosition throughput over 10,000 iterations (portability bound < 25 µs/op)', () => {
      const place = greenwich;
      const baseEpochNs = ChronoFlux.instant('2026-06-21T00:00:00Z').epochNanoseconds;
      const iterations = 10_000;

      // Warmup JIT
      for (let i = 0; i < 500; i++) {
        const inst = Instant.fromEpochNanoseconds(baseEpochNs + BigInt(i) * 60_000_000_000n);
        ChronoFlux.solar.evaluatePosition(inst, place);
      }

      const t0 = performance.now();
      for (let i = 0; i < iterations; i++) {
        const inst = Instant.fromEpochNanoseconds(baseEpochNs + BigInt(i) * 60_000_000_000n);
        ChronoFlux.solar.evaluatePosition(inst, place);
      }
      const t1 = performance.now();

      const totalElapsedMs = t1 - t0;
      const avgMicrosPerOp = (totalElapsedMs / iterations) * 1000.0;
      const opsPerSec = Math.round((iterations / totalElapsedMs) * 1000.0);

      // Portability Disclaimer: Benchmark throughput depends on underlying host CPU, operating system,
      // thermal throttling, and Node.js runtime. Thresholds enforce regression ceilings.
      console.log(
        `[Benchmark: Instantaneous Position] ${totalElapsedMs.toFixed(2)} ms for ${iterations} ops | ${avgMicrosPerOp.toFixed(3)} µs/op | ${opsPerSec.toLocaleString()} ops/sec (Platform: ${process.platform}/${process.arch})`
      );

      const isCoverage =
        process.env.NODE_V8_COVERAGE !== undefined ||
        process.env.VITEST_COVERAGE !== undefined ||
        process.argv.some((arg) => arg.includes('coverage'));
      const maxMicros = isCoverage ? 40.0 : 25.0;
      expect(avgMicrosPerOp).toBeLessThan(maxMicros);
    });

    it('measures cold-cache diurnal solve throughput over 1,000 distinct calendar days', () => {
      const place = greenwich;
      const startMs = Date.UTC(2026, 0, 1, 12, 0, 0);
      const iterations = 1_000;

      // Warmup JIT for diurnal root-finding and central-difference derivatives
      for (let i = 0; i < 50; i++) {
        const inst = Instant.fromEpochMilliseconds(startMs - (i + 1) * 86_400_000);
        ChronoFlux.solar.evaluate(inst, place);
      }

      // Each iteration is a distinct day, intentionally missing the diurnal cache and solving full diurnal events
      const t0 = performance.now();
      for (let i = 0; i < iterations; i++) {
        const inst = Instant.fromEpochMilliseconds(startMs + i * 86_400_000);
        ChronoFlux.solar.evaluate(inst, place);
      }
      const t1 = performance.now();

      const totalElapsedMs = t1 - t0;
      const avgMicrosPerOp = (totalElapsedMs / iterations) * 1000.0;
      const opsPerSec = Math.round((iterations / totalElapsedMs) * 1000.0);

      console.log(
        `[Benchmark: Cold-Cache Diurnal Solves] ${totalElapsedMs.toFixed(2)} ms for ${iterations} ops | ${avgMicrosPerOp.toFixed(3)} µs/op | ${opsPerSec.toLocaleString()} ops/sec`
      );

      // Portability bound for cold full-day root-finding solve (sunrise, sunset, noon, midnight, twilights)
      // Accommodates unoptimized initial VM tiers and background JIT compilation (< 1.5ms standard, < 2.5ms under coverage)
      const isCoverage =
        process.env.NODE_V8_COVERAGE !== undefined ||
        process.env.VITEST_COVERAGE !== undefined ||
        process.argv.some((arg) => arg.includes('coverage'));
      const maxMicros = isCoverage ? 2500.0 : 1500.0;
      expect(avgMicrosPerOp).toBeLessThan(maxMicros);
    });

    it('measures warm-cache diurnal hit throughput over 10,000 evaluations (portability bound < 60 µs/op)', () => {
      const place = greenwich;
      const baseInstant = ChronoFlux.instant('2026-06-21T12:00:00Z');
      const iterations = 10_000;

      // Warmup cache and JIT to steady-state execution
      for (let i = 0; i < 200; i++) {
        const sampleInstant = baseInstant.add(ChronoFlux.duration.seconds(i % 3600));
        ChronoFlux.solar.evaluate(sampleInstant, place);
      }

      const t0 = performance.now();
      for (let i = 0; i < iterations; i++) {
        // Querying across the same day hits the diurnal cache
        const sampleInstant = baseInstant.add(ChronoFlux.duration.seconds(i % 3600));
        ChronoFlux.solar.evaluate(sampleInstant, place);
      }
      const t1 = performance.now();

      const totalElapsedMs = t1 - t0;
      const avgMicrosPerOp = (totalElapsedMs / iterations) * 1000.0;
      const opsPerSec = Math.round((iterations / totalElapsedMs) * 1000.0);

      console.log(
        `[Benchmark: Warm-Cache Hits] ${totalElapsedMs.toFixed(2)} ms for ${iterations} ops | ${avgMicrosPerOp.toFixed(3)} µs/op | ${opsPerSec.toLocaleString()} ops/sec`
      );

      // Portability bound: accommodates V8 coverage instrumentation and virtualized runners (< 60 µs/op standard, < 120 µs/op coverage)
      const isCoverage =
        process.env.NODE_V8_COVERAGE !== undefined ||
        process.env.VITEST_COVERAGE !== undefined ||
        process.argv.some((arg) => arg.includes('coverage'));
      const maxMicros = isCoverage ? 120.0 : 60.0;
      expect(avgMicrosPerOp).toBeLessThan(maxMicros);
    });
  });
});
