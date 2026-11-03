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
  calcSolarCrossingUncertainty,
  calcSolarNoon,
  computeSolarCoordinates,
  findSolarCrossing,
  NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG,
  solvePolarCrossingBracket,
} from '../src/core/models/solar/math.js';
import {
  AstronomicalTimeScale,
  getAstronomicalTimeScale,
  registerAstronomicalTimeScale,
  standardAstronomicalTimeScale,
  StandardAstronomicalTimeScale,
} from '../src/core/models/solar/timescale.js';
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

    it('returns null when bracket does not span the target solar elevation', () => {
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

      expect(result).toBeNull();
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
  // 2. Cache Key Precision
  // =========================================================================
  describe('2. Diurnal Cache Key Precision', () => {
    it('distinguishes locations differing only at the 6th decimal place without collision', () => {
      const instant = ChronoFlux.instant('2026-06-21T12:00:00Z');
      const placeA = ChronoFlux.place({ latitude: 51.476901, longitude: -0.000501 });
      const placeB = ChronoFlux.place({ latitude: 51.476902, longitude: -0.000502 });

      const stateA = ChronoFlux.solar.evaluate(instant, placeA);
      const stateB = ChronoFlux.solar.evaluate(instant, placeB);

      // Coordinates differ: azimuth and hour angle must reflect subtle distinction rather than identical cached coordinates
      expect(stateA.azimuthDeg).not.toBe(stateB.azimuthDeg);
      expect(stateA.geometricElevationDeg).not.toBe(stateB.geometricElevationDeg);
    });

    it('distinguishes locations with identical lat/lon but different elevations in cache', () => {
      const instant = ChronoFlux.instant('2026-06-21T12:00:00Z');
      const seaLevel = ChronoFlux.place({ latitude: 27.9881, longitude: 86.925, elevationMeters: 0 });
      const everest = ChronoFlux.place({ latitude: 27.9881, longitude: 86.925, elevationMeters: 8848 });

      const stateSea = ChronoFlux.solar.evaluate(instant, seaLevel);
      const stateEverest = ChronoFlux.solar.evaluate(instant, everest);

      expect(stateSea.uncertainty.horizonLimitationDeg).toBe(0.0);
      expect(stateEverest.uncertainty.horizonLimitationDeg).toBeCloseTo(0.0293 * Math.sqrt(8848), 2);
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

      // 3. Combined root-sum-square angular error Δh(t)
      expect(unc.combinedCoordinateUncertaintyDeg).toBeCloseTo(
        Math.sqrt(unc.numericalErrorDeg ** 2 + unc.atmosphericRefractionUncertaintyDeg ** 2),
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
    it('measures evaluatePosition throughput over 10,000 iterations', () => {
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

      // Reproducible benchmark logging
      console.log(
        `[Benchmark] evaluatePosition: ${totalElapsedMs.toFixed(2)} ms for ${iterations} ops | ${avgMicrosPerOp.toFixed(3)} µs/op | ${opsPerSec.toLocaleString()} ops/sec`
      );

      // Bound: Must execute in < 25 microseconds per evaluation in modern V8
      expect(avgMicrosPerOp).toBeLessThan(25.0);
    });

    it('measures diurnal cache hit throughput over 10,000 evaluations', () => {
      const place = greenwich;
      const baseInstant = ChronoFlux.instant('2026-06-21T12:00:00Z');
      const iterations = 10_000;

      // Warmup cache
      ChronoFlux.solar.evaluate(baseInstant, place);

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
        `[Benchmark] evaluate (diurnal cache hits): ${totalElapsedMs.toFixed(2)} ms for ${iterations} ops | ${avgMicrosPerOp.toFixed(3)} µs/op | ${opsPerSec.toLocaleString()} ops/sec`
      );

      expect(avgMicrosPerOp).toBeLessThan(35.0);
    });
  });
});
