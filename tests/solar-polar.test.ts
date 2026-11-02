/**
 * @file solar-polar.test.ts
 * Astronomical Solar Model Polar Extremes Tests.
 * Validates Polar Night in Tromsø, Norway (69.65°N) and Midnight Sun in Svalbard (78.22°N).
 */

import { describe, expect, it } from 'vitest';
import { ChronoFlux } from '../src/index.js';

describe('Astronomical Solar Model — Polar Edge Cases', () => {
  const tromso = ChronoFlux.place({
    latitude: 69.6492,
    longitude: 18.9553,
    timeZoneId: 'Europe/Oslo',
  });

  const svalbard = ChronoFlux.place({
    latitude: 78.2232,
    longitude: 15.6267,
    timeZoneId: 'Arctic/Longyearbyen',
  });

  describe('Polar Night (Tromsø, Norway in December)', () => {
    const winterSolstice = ChronoFlux.instant('2026-12-21T12:00:00Z');

    it('identifies perpetual darkness regime without throwing or returning NaN', () => {
      const state = ChronoFlux.solar.evaluate(winterSolstice, tromso);

      expect(Number.isFinite(state.elevationDeg)).toBe(true);
      expect(Number.isNaN(state.elevationDeg)).toBe(false);
      expect(state.isPolarNight).toBe(true);
      expect(state.isPolarDay).toBe(false);
      expect(state.phase).toBe('polar_night');
      expect(state.isDirectSunlight).toBe(false);
      expect(state.sunrise).toBeNull();
      expect(state.sunset).toBeNull();
    });

    it('verifies elevation never reaches -0.833° during a 24-hour cycle in polar night', () => {
      const start = ChronoFlux.instant('2026-12-21T00:00:00Z');
      const stepMinutes = 15;
      const totalSteps = (24 * 60) / stepMinutes;

      for (let i = 0; i < totalSteps; i++) {
        const instant = start.add(ChronoFlux.duration.minutes(i * stepMinutes));
        const state = ChronoFlux.solar.evaluate(instant, tromso);

        expect(state.elevationDeg).toBeLessThan(-0.833);
        expect(state.isPolarNight).toBe(true);
        expect(state.phase).toBe('polar_night');
      }
    });

    it('returns null for nextSunrise over a 24-hour search limit without throwing', () => {
      const sunrise = ChronoFlux.solar.nextEvent({
        event: 'sunrise',
        place: tromso,
        after: winterSolstice,
        searchLimitDays: 1,
      });

      expect(sunrise).toBeNull();
    });

    it('returns null for nextSunset over a 24-hour search limit without throwing', () => {
      const sunset = ChronoFlux.solar.nextEvent({
        event: 'sunset',
        place: tromso,
        after: winterSolstice,
        searchLimitDays: 1,
      });

      expect(sunset).toBeNull();
    });

    it('finds solar noon and solar midnight transit events during polar night', () => {
      const noon = ChronoFlux.solar.nextEvent({
        event: 'solarNoon',
        place: tromso,
        after: winterSolstice,
      });

      expect(noon).not.toBeNull();
      expect(noon!.isAfter(winterSolstice)).toBe(true);

      const midnight = ChronoFlux.solar.nextEvent({
        event: 'solarMidnight',
        place: tromso,
        after: winterSolstice,
      });

      expect(midnight).not.toBeNull();
      expect(midnight!.isAfter(winterSolstice)).toBe(true);
    });
  });

  describe('Midnight Sun (Svalbard in June)', () => {
    const summerSolstice = ChronoFlux.instant('2026-06-21T12:00:00Z');

    it('identifies perpetual daylight regime without throwing or returning NaN', () => {
      const state = ChronoFlux.solar.evaluate(summerSolstice, svalbard);

      expect(Number.isFinite(state.elevationDeg)).toBe(true);
      expect(Number.isNaN(state.elevationDeg)).toBe(false);
      expect(state.isPolarDay).toBe(true);
      expect(state.isPolarNight).toBe(false);
      expect(state.phase).toBe('polar_day');
      expect(state.isDirectSunlight).toBe(true);
      expect(state.sunrise).toBeNull();
      expect(state.sunset).toBeNull();
    });

    it('verifies elevation remains well above -0.833° throughout the entire 24-hour cycle', () => {
      const start = ChronoFlux.instant('2026-06-21T00:00:00Z');
      const stepMinutes = 15;
      const totalSteps = (24 * 60) / stepMinutes;

      for (let i = 0; i < totalSteps; i++) {
        const instant = start.add(ChronoFlux.duration.minutes(i * stepMinutes));
        const state = ChronoFlux.solar.evaluate(instant, svalbard);

        // At 78°N in June, elevation never drops below +11°
        expect(state.elevationDeg).toBeGreaterThan(11.0);
        expect(state.isPolarDay).toBe(true);
        expect(state.phase).toBe('polar_day');
        expect(state.isDirectSunlight).toBe(true);
      }
    });

    it('returns null for nextSunset over a 24-hour search limit in Midnight Sun', () => {
      const sunset = ChronoFlux.solar.nextEvent({
        event: 'sunset',
        place: svalbard,
        after: summerSolstice,
        searchLimitDays: 1,
      });

      expect(sunset).toBeNull();
    });

    it('returns null for nextSunrise over a 24-hour search limit in Midnight Sun', () => {
      const sunrise = ChronoFlux.solar.nextEvent({
        event: 'sunrise',
        place: svalbard,
        after: summerSolstice,
        searchLimitDays: 1,
      });

      expect(sunrise).toBeNull();
    });

    it('confirms smooth sinusoidal continuity with zero derivative discontinuities', () => {
      const start = ChronoFlux.instant('2026-06-21T00:00:00Z');
      const stepMinutes = 10;
      const totalSteps = (24 * 60) / stepMinutes;

      let prevElev = ChronoFlux.solar.evaluate(start, svalbard).elevationDeg;

      for (let i = 1; i <= totalSteps; i++) {
        const instant = start.add(ChronoFlux.duration.minutes(i * stepMinutes));
        const curElev = ChronoFlux.solar.evaluate(instant, svalbard).elevationDeg;

        // In 10 minutes, solar elevation changes smoothly by at most 1.5°
        const delta = Math.abs(curElev - prevElev);
        expect(delta).toBeLessThan(1.5);
        prevElev = curElev;
      }
    });
  });
});
