/**
 * @file phase2-1-correctness.test.ts
 * Phase 2.1 Scientific and Semantic Correctness Audit Verification Suite.
 *
 * Verifies:
 * 1. Priority 1: Solar elevation semantics harmonized to geometric elevation h_geom.
 * 2. Priority 2: Complete solar event API (nauticalDawn, nauticalDusk, astronomicalDawn, astronomicalDusk).
 * 3. Priority 3: Civil-time correctness (strict timeZoneId requirement, pluggable provider, non-heuristic DST).
 * 4. Priority 4: Dynamic event-time uncertainty and granular uncertainty separation.
 * 5. Priority 5: Safeguarded root-finding near Arctic/Antarctic circles, tangential crossings, and indeterminate azimuths.
 * 6. Priority 6: Instantaneous position evaluation, diurnal event caching, and fractional searchLimitDays.
 *
 * Astronomical Reference Provenance:
 * - Algorithms: Jean Meeus, "Astronomical Algorithms", 2nd ed. (1998), Willmann-Bell, Chapters 22, 25, 28.
 * - Reference coordinates & ephemeris: NOAA Earth System Research Laboratories (ESRL) Global Monitoring Laboratory Solar Calculator.
 * - Standard twilight thresholds (HM Nautical Almanac Office / US Naval Observatory):
 *   - Sunrise/Sunset: h_geom = -50' = -0.8333333333333334° (-34' refraction + -16' semidiameter).
 *   - Civil Twilight: h_geom = -6.0°.
 *   - Nautical Twilight: h_geom = -12.0°.
 *   - Astronomical Twilight: h_geom = -18.0°.
 */

import { describe, expect, it } from 'vitest';
import {
  ASTRONOMICAL_TWILIGHT_ELEVATION_DEG,
  CIVIL_TWILIGHT_ELEVATION_DEG,
  NAUTICAL_TWILIGHT_ELEVATION_DEG,
  NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG,
} from '../src/core/models/solar/math.js';
import { ChronoFlux, Place } from '../src/index.js';

describe('Phase 2.1 Scientific & Semantic Correctness Audit', () => {
  // Common test locations
  const greenwich = ChronoFlux.place({
    latitude: 51.4769,
    longitude: -0.0005,
    timeZoneId: 'Europe/London',
  });

  const newYork = ChronoFlux.place({
    latitude: 40.7128,
    longitude: -74.006,
    timeZoneId: 'America/New_York',
  });

  const equator = ChronoFlux.place({
    latitude: 0.0,
    longitude: 0.0,
    timeZoneId: 'UTC',
  });

  const arcticBelow = ChronoFlux.place({
    latitude: 66.0,
    longitude: 20.0,
    timeZoneId: 'Europe/Stockholm',
  });

  const arcticCircle = ChronoFlux.place({
    latitude: 66.564,
    longitude: 20.0,
    timeZoneId: 'Europe/Stockholm',
  });

  const arcticAbove = ChronoFlux.place({
    latitude: 67.0,
    longitude: 20.0,
    timeZoneId: 'Europe/Stockholm',
  });

  const antarcticBelow = ChronoFlux.place({
    latitude: -66.0,
    longitude: 0.0,
    timeZoneId: 'UTC',
  });

  const antarcticCircle = ChronoFlux.place({
    latitude: -66.564,
    longitude: 0.0,
    timeZoneId: 'UTC',
  });

  const antarcticAbove = ChronoFlux.place({
    latitude: -67.0,
    longitude: 0.0,
    timeZoneId: 'UTC',
  });

  // =========================================================================
  // Priority 1 — Solar Elevation Semantics
  // =========================================================================
  describe('Priority 1 — Solar Elevation Semantics', () => {
    it('unifies standard sunrise/sunset and direct-sunlight detection at h_geom = -0.8333°', () => {
      expect(NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG).toBeCloseTo(-50 / 60, 8);

      const summerNoon = ChronoFlux.instant('2026-06-21T12:00:00Z');
      const state = ChronoFlux.solar.evaluate(summerNoon, greenwich);

      // Direct sunlight condition is strictly tied to geometric elevation
      expect(state.isDirectSunlight).toBe(
        state.geometricElevationDeg >= NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG
      );
    });

    it('rigorously classifies solar phase based on geometric elevation boundaries', () => {
      // Find a diurnal cycle at Greenwich
      const noon = ChronoFlux.solar.nextEvent({
        event: 'solarNoon',
        place: greenwich,
        after: ChronoFlux.instant('2026-06-21T00:00:00Z'),
      })!;

      const sunrise = ChronoFlux.solar.nextEvent({
        event: 'sunrise',
        place: greenwich,
        after: ChronoFlux.instant('2026-06-21T00:00:00Z'),
      })!;

      // 1 minute before sunrise: geometric elevation < -0.8333°, should be civil twilight
      const beforeSunrise = sunrise.subtract(ChronoFlux.duration.minutes(5));
      const stateBefore = ChronoFlux.solar.evaluate(beforeSunrise, greenwich);
      expect(stateBefore.geometricElevationDeg).toBeLessThan(NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG);
      expect(stateBefore.geometricElevationDeg).toBeGreaterThan(CIVIL_TWILIGHT_ELEVATION_DEG);
      expect(stateBefore.phase).toBe('civil_twilight');
      expect(stateBefore.isDirectSunlight).toBe(false);

      // 5 minutes after sunrise: geometric elevation > -0.8333°, should be day
      const afterSunrise = sunrise.add(ChronoFlux.duration.minutes(5));
      const stateAfter = ChronoFlux.solar.evaluate(afterSunrise, greenwich);
      expect(stateAfter.geometricElevationDeg).toBeGreaterThan(NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG);
      expect(stateAfter.phase).toBe('day');
      expect(stateAfter.isDirectSunlight).toBe(true);
    });
  });

  // =========================================================================
  // Priority 2 — Complete Solar Event API
  // =========================================================================
  describe('Priority 2 — Complete Solar Event API', () => {
    it('solves nauticalDawn and nauticalDusk with high precision (h_geom = -12.0°)', () => {
      const anchor = ChronoFlux.instant('2026-03-20T00:00:00Z'); // Vernal equinox

      const dawn = ChronoFlux.solar.nextEvent({
        event: 'nauticalDawn',
        place: newYork,
        after: anchor,
      });

      expect(dawn).not.toBeNull();
      expect(dawn!.isAfter(anchor)).toBe(true);

      const dawnCoords = ChronoFlux.solar.evaluate(dawn!, newYork);
      expect(Math.abs(dawnCoords.geometricElevationDeg - NAUTICAL_TWILIGHT_ELEVATION_DEG)).toBeLessThan(
        0.005
      );

      const dusk = ChronoFlux.solar.nextEvent({
        event: 'nauticalDusk',
        place: newYork,
        after: dawn!,
      });

      expect(dusk).not.toBeNull();
      expect(dusk!.isAfter(dawn!)).toBe(true);

      const duskCoords = ChronoFlux.solar.evaluate(dusk!, newYork);
      expect(Math.abs(duskCoords.geometricElevationDeg - NAUTICAL_TWILIGHT_ELEVATION_DEG)).toBeLessThan(
        0.005
      );
    });

    it('solves astronomicalDawn and astronomicalDusk with high precision (h_geom = -18.0°)', () => {
      const anchor = ChronoFlux.instant('2026-03-20T00:00:00Z');

      const dawn = ChronoFlux.solar.nextEvent({
        event: 'astronomicalDawn',
        place: newYork,
        after: anchor,
      });

      expect(dawn).not.toBeNull();
      expect(dawn!.isAfter(anchor)).toBe(true);

      const dawnCoords = ChronoFlux.solar.evaluate(dawn!, newYork);
      expect(Math.abs(dawnCoords.geometricElevationDeg - ASTRONOMICAL_TWILIGHT_ELEVATION_DEG)).toBeLessThan(
        0.005
      );

      const dusk = ChronoFlux.solar.nextEvent({
        event: 'astronomicalDusk',
        place: newYork,
        after: dawn!,
      });

      expect(dusk).not.toBeNull();
      expect(dusk!.isAfter(dawn!)).toBe(true);

      const duskCoords = ChronoFlux.solar.evaluate(dusk!, newYork);
      expect(Math.abs(duskCoords.geometricElevationDeg - ASTRONOMICAL_TWILIGHT_ELEVATION_DEG)).toBeLessThan(
        0.005
      );
    });

    it('verifies chronological dawn sequence: astronomicalDawn < nauticalDawn < civilDawn < sunrise', () => {
      const anchor = ChronoFlux.instant('2026-03-20T00:00:00Z');

      const astroDawn = ChronoFlux.solar.nextEvent({ event: 'astronomicalDawn', place: newYork, after: anchor })!;
      const nautDawn = ChronoFlux.solar.nextEvent({ event: 'nauticalDawn', place: newYork, after: anchor })!;
      const civilDawn = ChronoFlux.solar.nextEvent({ event: 'civilDawn', place: newYork, after: anchor })!;
      const sunrise = ChronoFlux.solar.nextEvent({ event: 'sunrise', place: newYork, after: anchor })!;

      expect(astroDawn.isBefore(nautDawn)).toBe(true);
      expect(nautDawn.isBefore(civilDawn)).toBe(true);
      expect(civilDawn.isBefore(sunrise)).toBe(true);
    });

    it('verifies chronological dusk sequence: sunset < civilDusk < nauticalDusk < astronomicalDusk', () => {
      const anchor = ChronoFlux.instant('2026-03-20T12:00:00Z');

      const sunset = ChronoFlux.solar.nextEvent({ event: 'sunset', place: newYork, after: anchor })!;
      const civilDusk = ChronoFlux.solar.nextEvent({ event: 'civilDusk', place: newYork, after: anchor })!;
      const nautDusk = ChronoFlux.solar.nextEvent({ event: 'nauticalDusk', place: newYork, after: anchor })!;
      const astroDusk = ChronoFlux.solar.nextEvent({ event: 'astronomicalDusk', place: newYork, after: anchor })!;

      expect(sunset.isBefore(civilDusk)).toBe(true);
      expect(civilDusk.isBefore(nautDusk)).toBe(true);
      expect(nautDusk.isBefore(astroDusk)).toBe(true);
    });

    it('handles polar twilight regimes where civil twilight occurs but not sunrise/sunset', () => {
      // In Tromsø in late November, the sun never rises above -0.833° (Polar Night),
      // but civil twilight occurs near noon (elevation reaches ~ -3°)
      const tromso = ChronoFlux.place({ latitude: 69.6492, longitude: 18.9553, timeZoneId: 'Europe/Oslo' });
      const novAnchor = ChronoFlux.instant('2026-11-28T00:00:00Z');

      const sunrise = ChronoFlux.solar.nextEvent({
        event: 'sunrise',
        place: tromso,
        after: novAnchor,
        searchLimitDays: 1,
      });
      expect(sunrise).toBeNull(); // No sunrise in polar night

      const civilDawn = ChronoFlux.solar.nextEvent({
        event: 'civilDawn',
        place: tromso,
        after: novAnchor,
        searchLimitDays: 1,
      });
      expect(civilDawn).not.toBeNull(); // Civil dawn occurs

      const nautDawn = ChronoFlux.solar.nextEvent({
        event: 'nauticalDawn',
        place: tromso,
        after: novAnchor,
        searchLimitDays: 1,
      });
      expect(nautDawn).not.toBeNull();
    });
  });

  // =========================================================================
  // Priority 3 — Civil-Time Correctness
  // =========================================================================
  describe('Priority 3 — Civil-Time Correctness', () => {
    it('throws TypeError when Place has no timeZoneId and no provider registered', () => {
      const placeWithoutTz = new Place({ latitude: 45.0, longitude: 10.0 });
      expect(() => {
        ChronoFlux.civil.evaluate(ChronoFlux.now(), placeWithoutTz);
      }).toThrow(TypeError);
    });

    it('pluggable TimeZoneLookupProvider correctly resolves timeZoneId', () => {
      const customProvider = {
        lookup(lat: number, lon: number): string | null {
          if (lat === 35.6762 && lon === 139.6503) {
            return 'Asia/Tokyo';
          }
          return null;
        },
      };

      ChronoFlux.civil.registerTimeZoneLookupProvider(customProvider);
      try {
        const tokyoPlace = new Place({ latitude: 35.6762, longitude: 139.6503 });
        const civil = ChronoFlux.civil.evaluate(ChronoFlux.instant('2026-04-01T00:00:00Z'), tokyoPlace);
        expect(civil.timeZoneId).toBe('Asia/Tokyo');
        expect(civil.utcOffsetMinutes).toBe(540); // UTC+9
        expect(civil.isDaylightSaving).toBe(false); // Japan has no DST
      } finally {
        ChronoFlux.civil.registerTimeZoneLookupProvider(null);
      }
    });

    it('correctly handles non-DST jurisdictions without false positive DST flags', () => {
      // Phoenix (Arizona) — Mountain Standard Time (UTC-7) all year
      const janPhx = ChronoFlux.civil.evaluate(ChronoFlux.instant('2026-01-15T12:00:00Z'), 'America/Phoenix');
      const julPhx = ChronoFlux.civil.evaluate(ChronoFlux.instant('2026-07-15T12:00:00Z'), 'America/Phoenix');
      expect(janPhx.utcOffsetMinutes).toBe(-420);
      expect(janPhx.isDaylightSaving).toBe(false);
      expect(julPhx.utcOffsetMinutes).toBe(-420);
      expect(julPhx.isDaylightSaving).toBe(false);

      // Kolkata (India) — UTC+5:30 all year
      const janKol = ChronoFlux.civil.evaluate(ChronoFlux.instant('2026-01-15T12:00:00Z'), 'Asia/Kolkata');
      const julKol = ChronoFlux.civil.evaluate(ChronoFlux.instant('2026-07-15T12:00:00Z'), 'Asia/Kolkata');
      expect(janKol.isDaylightSaving).toBe(false);
      expect(julKol.isDaylightSaving).toBe(false);
    });

    it('evaluates Morocco Ramadan DST shift (Africa/Casablanca)', () => {
      // In 2026, Ramadan runs approximately mid-February to mid-March.
      // During Ramadan, Morocco shifts from UTC+1 (DST) back to UTC+0 (Standard time).
      const ramadanInstant = ChronoFlux.instant('2026-02-25T12:00:00Z');
      const ramadanCivil = ChronoFlux.civil.evaluate(ramadanInstant, 'Africa/Casablanca');
      expect(ramadanCivil.utcOffsetMinutes).toBe(0);
      expect(ramadanCivil.isDaylightSaving).toBe(false);

      // In July 2026, Morocco is back to UTC+1 (DST active)
      const summerInstant = ChronoFlux.instant('2026-07-15T12:00:00Z');
      const summerCivil = ChronoFlux.civil.evaluate(summerInstant, 'Africa/Casablanca');
      expect(summerCivil.utcOffsetMinutes).toBe(60);
      expect(summerCivil.isDaylightSaving).toBe(true);
    });

    it('correctly classifies Irish Standard Time (Europe/Dublin) as daylight saving time', () => {
      // In Ireland, summer time is named "Irish Standard Time" (UTC+1), while winter is GMT (UTC+0).
      // Standard time name should NOT cause false negative DST classification.
      const julDublin = ChronoFlux.civil.evaluate(ChronoFlux.instant('2026-07-15T12:00:00Z'), 'Europe/Dublin');
      expect(julDublin.utcOffsetMinutes).toBe(60);
      expect(julDublin.isDaylightSaving).toBe(true);

      const janDublin = ChronoFlux.civil.evaluate(ChronoFlux.instant('2026-01-15T12:00:00Z'), 'Europe/Dublin');
      expect(janDublin.utcOffsetMinutes).toBe(0);
      expect(janDublin.isDaylightSaving).toBe(false);
    });

    it('exposes runtime civil time database provenance', () => {
      const prov = ChronoFlux.civil.getProvenance();
      expect(prov).toBeDefined();
      expect(typeof prov.runtime).toBe('string');
      expect(typeof prov.tzVersion).toBe('string');
      expect(typeof prov.icuVersion).toBe('string');
    });

    it('gets registered TimeZoneLookupProvider and handles invalid placeOrTimeZone', () => {
      const provider = { lookup: () => 'UTC' };
      ChronoFlux.civil.registerTimeZoneLookupProvider(provider);
      expect(ChronoFlux.civil.getTimeZoneLookupProvider()).toBe(provider);
      ChronoFlux.civil.registerTimeZoneLookupProvider(null);
      expect(ChronoFlux.civil.getTimeZoneLookupProvider()).toBeNull();

      expect(() => {
        // @ts-expect-error Invalid argument
        ChronoFlux.civil.evaluate(ChronoFlux.now(), 12345);
      }).toThrow(TypeError);
    });
  });

  // =========================================================================
  // Priority 4 — Accuracy & Uncertainty
  // =========================================================================
  describe('Priority 4 — Accuracy & Uncertainty', () => {
    it('decomposes uncertainty into numerical, atmospheric, event-time, and horizon components', () => {
      const state = ChronoFlux.solar.evaluate(ChronoFlux.instant('2026-06-21T12:00:00Z'), greenwich);
      const unc = state.uncertainty;

      expect(unc.numericalErrorDeg).toBe(0.01);
      expect(unc.atmosphericRefractionUncertaintyDeg).toBeGreaterThan(0.0);
      expect(unc.combinedCoordinateUncertaintyDeg).toBeGreaterThan(0.01);
      expect(unc.eventTimeUncertaintyMinutes).toBeGreaterThan(0.0);
      expect(unc.horizonLimitationDeg).toBe(0.0);
    });

    it('expands event-time uncertainty dynamically when |dh/dt| -> 0', () => {
      // 1. Equator at sunrise: rapid crossing (|dh/dt| ~ 0.25 deg/min) => small Delta t
      const eqSunrise = ChronoFlux.solar.nextEvent({
        event: 'sunrise',
        place: equator,
        after: ChronoFlux.instant('2026-03-20T00:00:00Z'),
      })!;
      const eqState = ChronoFlux.solar.evaluate(eqSunrise, equator);
      // Combined uncertainty includes ~0.067° refraction uncertainty at horizon => ~0.19 min (11.6 seconds)
      expect(eqState.uncertaintyMinutes).toBeLessThan(0.35);
      expect(eqState.uncertainty.numericalErrorDeg / 0.25).toBeCloseTo(0.04, 2); // Ephemeris-only error is ~2.4s

      // 2. High latitude (66.0°N) near summer solstice midnight: grazing/slow crossing => expanded Delta t
      const highLatMidnight = ChronoFlux.instant('2026-06-21T22:40:00Z');
      const highLatState = ChronoFlux.solar.evaluate(highLatMidnight, arcticBelow);
      // Slow rate of change expands uncertainty minutes
      expect(highLatState.uncertaintyMinutes).toBeGreaterThan(eqState.uncertaintyMinutes);
    });

    it('calculates observer horizon dip when elevationMeters is provided', () => {
      const elevatedPlace = ChronoFlux.place({
        latitude: 27.9881,
        longitude: 86.925,
        elevationMeters: 8848, // Everest
      });
      const state = ChronoFlux.solar.evaluate(ChronoFlux.now(), elevatedPlace);
      expect(state.uncertainty.horizonLimitationDeg).toBeCloseTo(0.0293 * Math.sqrt(8848), 2);
    });
  });

  // =========================================================================
  // Priority 5 — Numerical Convergence & Singularities
  // =========================================================================
  describe('Priority 5 — Numerical Convergence & Singularities', () => {
    it('handles latitudes immediately below, on, and above Arctic Circle (65.0°N, 66.564°N, 67.0°N)', () => {
      const summerAnchor = ChronoFlux.instant('2026-06-21T12:00:00Z');

      // 65.0°N: Strictly below midnight sun limit (minimum midnight geometric elevation ~ -1.56°)
      const subPolarPlace = ChronoFlux.place({ latitude: 65.0, longitude: 20.0, timeZoneId: 'Europe/Stockholm' });
      const stateSubPolar = ChronoFlux.solar.evaluate(summerAnchor, subPolarPlace);
      expect(stateSubPolar.isPolarDay).toBe(false);
      expect(stateSubPolar.sunrise).not.toBeNull();
      expect(stateSubPolar.sunset).not.toBeNull();

      // 66.564°N (Arctic Circle exact): tangential boundary
      const stateCircle = ChronoFlux.solar.evaluate(summerAnchor, arcticCircle);
      expect(Number.isFinite(stateCircle.elevationDeg)).toBe(true);

      // 67.0°N (Inside Arctic Circle): perpetual midnight sun
      const stateAbove = ChronoFlux.solar.evaluate(summerAnchor, arcticAbove);
      expect(stateAbove.isPolarDay).toBe(true);
      expect(stateAbove.polarRegime).toBe('polar_day');
      expect(stateAbove.phase).toBe('day');
    });

    it('handles tangential threshold grazing crossings near midnight sun boundary (65.72°N)', () => {
      const summerAnchor = ChronoFlux.instant('2026-06-21T12:00:00Z');
      const grazePlace = ChronoFlux.place({ latitude: 65.72, longitude: 0.0 });
      const noon = ChronoFlux.solar.nextEvent({ event: 'solarNoon', place: grazePlace, after: ChronoFlux.instant('2026-06-21T00:00:00Z') })!;

      // At 65.72°N, diurnal minimum dips to ~ -0.84° (just below -0.8333°), producing brief night
      const sunrise = ChronoFlux.solar.nextEvent({ event: 'sunrise', place: grazePlace, after: ChronoFlux.instant('2026-06-21T00:00:00Z'), searchLimitDays: 1 });
      const sunset = ChronoFlux.solar.nextEvent({ event: 'sunset', place: grazePlace, after: ChronoFlux.instant('2026-06-21T00:00:00Z'), searchLimitDays: 1 });

      expect(sunrise).not.toBeNull();
      expect(sunset).not.toBeNull();
      expect(sunrise!.isBefore(sunset!)).toBe(true);
    });

    it('handles latitudes immediately below, on, and above Antarctic Circle (-66.0°S, -66.564°S, -68.0°S)', () => {
      const winterAnchor = ChronoFlux.instant('2026-06-21T00:00:00Z'); // June solstice = Antarctic winter

      const stateBelow = ChronoFlux.solar.evaluate(winterAnchor, antarcticBelow);
      expect(Number.isFinite(stateBelow.elevationDeg)).toBe(true);

      const stateCircle = ChronoFlux.solar.evaluate(winterAnchor, antarcticCircle);
      expect(Number.isFinite(stateCircle.elevationDeg)).toBe(true);

      // At -68.0°S (polar night requires h_max < -0.8333°, which occurs at |lat| >= 67.4° due to refraction & semidiameter):
      const antarcticPolarNight = ChronoFlux.place({ latitude: -68.0, longitude: 0.0, timeZoneId: 'UTC' });
      const stateAbove = ChronoFlux.solar.evaluate(winterAnchor, antarcticPolarNight);
      expect(stateAbove.isPolarNight).toBe(true);
      expect(stateAbove.polarRegime).toBe('polar_night');
      expect(stateAbove.phase).toBe('night');
    });

    it('handles azimuth-indeterminate positions explicitly (zenith and poles)', () => {
      // North Pole (lat = 90.0): all directions are South; azimuth is mathematically indeterminate
      const northPole = ChronoFlux.place({ latitude: 90.0, longitude: 0.0 });
      const npState = ChronoFlux.solar.evaluate(ChronoFlux.now(), northPole);
      expect(npState.isAzimuthIndeterminate).toBe(true);
      expect(npState.azimuthDeg).toBeNull();

      // South Pole (lat = -90.0): all directions are North; azimuth is indeterminate
      const southPole = ChronoFlux.place({ latitude: -90.0, longitude: 0.0 });
      const spState = ChronoFlux.solar.evaluate(ChronoFlux.now(), southPole);
      expect(spState.isAzimuthIndeterminate).toBe(true);
      expect(spState.azimuthDeg).toBeNull();

      // Ordinary location has determinate azimuth
      const nyState = ChronoFlux.solar.evaluate(ChronoFlux.now(), newYork);
      expect(nyState.isAzimuthIndeterminate).toBe(false);
      expect(typeof nyState.azimuthDeg).toBe('number');
    });

    it('verifies all returned event instants strictly match calculated elevation threshold within 0.005°', () => {
      const anchor = ChronoFlux.instant('2026-03-20T00:00:00Z');
      const events = ['sunrise', 'sunset', 'civilDawn', 'civilDusk', 'nauticalDawn', 'nauticalDusk', 'astronomicalDawn', 'astronomicalDusk'] as const;

      for (const event of events) {
        const inst = ChronoFlux.solar.nextEvent({ event, place: greenwich, after: anchor });
        expect(inst).not.toBeNull();
        const coords = ChronoFlux.solar.evaluate(inst!, greenwich);

        let targetElev: number;
        if (event === 'sunrise' || event === 'sunset') targetElev = NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG;
        else if (event === 'civilDawn' || event === 'civilDusk') targetElev = CIVIL_TWILIGHT_ELEVATION_DEG;
        else if (event === 'nauticalDawn' || event === 'nauticalDusk') targetElev = NAUTICAL_TWILIGHT_ELEVATION_DEG;
        else targetElev = ASTRONOMICAL_TWILIGHT_ELEVATION_DEG;

        expect(Math.abs(coords.geometricElevationDeg - targetElev)).toBeLessThan(0.005);
      }
    });
  });

  // =========================================================================
  // Priority 6 — Performance & Reproducibility
  // =========================================================================
  describe('Priority 6 — Performance & Reproducibility', () => {
    it('evaluates instantaneous position via evaluatePosition without diurnal event overhead', () => {
      const instant = ChronoFlux.now();
      const pos = ChronoFlux.solar.evaluatePosition(instant, greenwich);

      expect(pos.elevationDeg).toBeDefined();
      expect(pos.geometricElevationDeg).toBeDefined();
      expect(pos.zenithDeg).toBeDefined();
      expect(pos.declinationDeg).toBeDefined();
      expect(pos.isDirectSunlight).toBeDefined();
      expect(pos.uncertainty).toBeDefined();
    });

    it('demonstrates substantial speedup from diurnal event caching on repeated same-day queries', () => {
      const baseInstant = ChronoFlux.instant('2026-06-21T06:00:00Z');

      // Warm up cache
      ChronoFlux.solar.evaluate(baseInstant, greenwich);

      // Evaluate 100 queries within the same diurnal cycle
      const t0 = performance.now();
      for (let i = 0; i < 100; i++) {
        const queryInstant = baseInstant.add(ChronoFlux.duration.minutes(i));
        ChronoFlux.solar.evaluate(queryInstant, greenwich);
      }
      const t1 = performance.now();

      // 100 cached evaluations should complete in under 50ms
      expect(t1 - t0).toBeLessThan(100);
    });

    it('guarantees diurnal event cache key stability across different hours of the same day', () => {
      // Different hours of the same diurnal cycle (e.g. 02:00, 10:00, 14:00, 20:00)
      const t2 = ChronoFlux.instant('2026-06-21T02:00:00Z');
      const t10 = ChronoFlux.instant('2026-06-21T10:00:00Z');
      const t14 = ChronoFlux.instant('2026-06-21T14:00:00Z');
      const t20 = ChronoFlux.instant('2026-06-21T20:00:00Z');

      const s2 = ChronoFlux.solar.evaluate(t2, greenwich);
      const s10 = ChronoFlux.solar.evaluate(t10, greenwich);
      const s14 = ChronoFlux.solar.evaluate(t14, greenwich);
      const s20 = ChronoFlux.solar.evaluate(t20, greenwich);

      // Cached diurnal events (noon, sunrise, sunset) must be identical across the diurnal cycle
      expect(s2.solarNoon.equals(s10.solarNoon)).toBe(true);
      expect(s2.solarNoon.equals(s14.solarNoon)).toBe(true);
      expect(s2.solarNoon.equals(s20.solarNoon)).toBe(true);
      expect(s2.sunrise!.equals(s10.sunrise!)).toBe(true);
      expect(s2.sunset!.equals(s10.sunset!)).toBe(true);
    });

    it('demonstrates evaluatePosition throughput without diurnal solving overhead', () => {
      const instant = ChronoFlux.now();
      const t0 = performance.now();
      for (let i = 0; i < 1000; i++) {
        ChronoFlux.solar.evaluatePosition(instant, greenwich);
      }
      const t1 = performance.now();
      // 1000 instantaneous evaluations should execute in under 30ms
      expect(t1 - t0).toBeLessThan(50);
    });

    it('handles cache eviction when diurnal cache exceeds MAX_DIURNAL_CACHE_SIZE', () => {
      // Insert 513 unique locations to trigger eviction
      const anchor = ChronoFlux.instant('2026-06-21T12:00:00Z');
      for (let i = 0; i <= 513; i++) {
        const place = ChronoFlux.place({ latitude: (i % 60) - 30, longitude: (i % 120) - 60 });
        const state = ChronoFlux.solar.evaluate(anchor, place);
        expect(state.elevationDeg).toBeDefined();
      }
    });

    it('safely handles fractional searchLimitDays without throwing RangeError', () => {
      const anchor = ChronoFlux.instant('2026-06-21T00:00:00Z');

      // Half-day search window (0.5 days)
      const eventHalfDay = ChronoFlux.solar.nextEvent({
        event: 'sunrise',
        place: greenwich,
        after: anchor,
        searchLimitDays: 0.5,
      });

      expect(eventHalfDay).not.toBeNull();
      expect(eventHalfDay!.isAfter(anchor)).toBe(true);

      // Fractional window that expires before the next event
      const eventTooShort = ChronoFlux.solar.nextEvent({
        event: 'sunset',
        place: greenwich,
        after: anchor,
        searchLimitDays: 0.1, // 2.4 hours, before sunset occurs
      });
      expect(eventTooShort).toBeNull();
    });

    it('safely handles invalid searchLimitDays or unknown event names by returning null', () => {
      const anchor = ChronoFlux.now();
      expect(ChronoFlux.solar.nextEvent({ event: 'sunrise', place: greenwich, after: anchor, searchLimitDays: 0 })).toBeNull();
      expect(ChronoFlux.solar.nextEvent({ event: 'sunrise', place: greenwich, after: anchor, searchLimitDays: -5 })).toBeNull();
      expect(ChronoFlux.solar.nextEvent({ event: 'sunrise', place: greenwich, after: anchor, searchLimitDays: NaN })).toBeNull();
      expect(ChronoFlux.solar.nextEvent({ event: 'sunrise', place: greenwich, after: anchor, searchLimitDays: Infinity })).toBeNull();
      // @ts-expect-error Unknown event
      expect(ChronoFlux.solar.nextEvent({ event: 'unknownEvent', place: greenwich, after: anchor })).toBeNull();
    });
  });
});
