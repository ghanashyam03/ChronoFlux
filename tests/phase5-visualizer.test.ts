/**
 * @file phase5-visualizer.test.ts
 * Rigorous tests for Phase 5 Visual Diagnostic Suite mathematical models,
 * timeline transformations, subsolar coordinates, query presets, and ribbon synchronization.
 */

import { describe, it, expect } from 'vitest';
import {
  ChronoFlux,
  Instant,
  Place,
  Interval,
  Conditions,
  type SolarPhase,
} from '../src/index.js';
import {
  getSubsolarPoint,
  normalizeLongitudeDeg,
} from '../src/visualizer/src/utils/subsolar-point.js';
import {
  getTimelineFraction,
  instantToPixel,
  pixelToInstant,
  intervalToPixelRange,
  createSearchWindow,
  formatUtcIso,
  formatCivilDateTime,
  formatDurationFriendly,
  formatCoordinate,
} from '../src/visualizer/src/utils/timeline.js';
import {
  elevationToY,
  azimuthToY,
  getSolarPhaseColor,
  getSolarPhaseBandRgba,
  getPolarRegimeLabel,
  getPolarRegimeBadgeColor,
} from '../src/visualizer/src/utils/canvas-renderers.js';
import {
  LOCATION_PRESETS,
  DATE_PRESETS,
  QUERY_PRESETS,
} from '../src/visualizer/src/state/presets.js';

describe('Phase 5 — Visual Diagnostic Suite & Developer Console', () => {
  describe('1. Subsolar Point Mathematics & Consistency', () => {
    it('normalizes longitude into [-180, +180) degrees accurately', () => {
      expect(normalizeLongitudeDeg(0)).toBe(0);
      expect(normalizeLongitudeDeg(180)).toBe(-180);
      expect(normalizeLongitudeDeg(-180)).toBe(-180);
      expect(normalizeLongitudeDeg(185)).toBeCloseTo(-175, 6);
      expect(normalizeLongitudeDeg(-190)).toBeCloseTo(170, 6);
      expect(normalizeLongitudeDeg(360)).toBe(0);
      expect(normalizeLongitudeDeg(540)).toBe(-180);
      expect(normalizeLongitudeDeg(-360)).toBe(0);
    });

    it('derives subsolar latitude directly from solar declination', () => {
      // Vernal Equinox 2026: declination should be ~0°
      const equinox = Instant.fromJSON('2026-03-20T12:00:00.000Z');
      const subEquinox = getSubsolarPoint(equinox);
      expect(subEquinox.latitudeDeg).toBeCloseTo(0.0, 1);
      expect(subEquinox.declinationDeg).toBe(subEquinox.latitudeDeg);

      // Summer Solstice 2026: declination should be ~+23.44°
      const solsticeSummer = Instant.fromJSON('2026-06-21T12:00:00.000Z');
      const subSummer = getSubsolarPoint(solsticeSummer);
      expect(subSummer.latitudeDeg).toBeCloseTo(23.44, 1);

      // Winter Solstice 2026: declination should be ~-23.44°
      const solsticeWinter = Instant.fromJSON('2026-12-21T12:00:00.000Z');
      const subWinter = getSubsolarPoint(solsticeWinter);
      expect(subWinter.latitudeDeg).toBeCloseTo(-23.44, 1);
    });

    it('proves subsolar coordinates are invariant across different observer longitudes', () => {
      const instant = Instant.fromJSON('2026-06-21T15:30:00.000Z');

      const placeLondon = ChronoFlux.place({ latitude: 51.5074, longitude: -0.1278 });
      const placeTokyo = ChronoFlux.place({ latitude: 35.6762, longitude: 139.6503 });
      const placeNewYork = ChronoFlux.place({ latitude: 40.7128, longitude: -74.006 });
      const placeSydney = ChronoFlux.place({ latitude: -33.8688, longitude: 151.2093 });

      const subLondon = getSubsolarPoint(instant, placeLondon);
      const subTokyo = getSubsolarPoint(instant, placeTokyo);
      const subNewYork = getSubsolarPoint(instant, placeNewYork);
      const subSydney = getSubsolarPoint(instant, placeSydney);

      // Latitude (declination) must be identical
      expect(subTokyo.latitudeDeg).toBeCloseTo(subLondon.latitudeDeg, 5);
      expect(subNewYork.latitudeDeg).toBeCloseTo(subLondon.latitudeDeg, 5);
      expect(subSydney.latitudeDeg).toBeCloseTo(subLondon.latitudeDeg, 5);

      // Subsolar Longitude must be identical within numerical precision
      expect(subTokyo.longitudeDeg).toBeCloseTo(subLondon.longitudeDeg, 5);
      expect(subNewYork.longitudeDeg).toBeCloseTo(subLondon.longitudeDeg, 5);
      expect(subSydney.longitudeDeg).toBeCloseTo(subLondon.longitudeDeg, 5);

      // Greenwich Hour Angle must be identical
      expect(subTokyo.greenwichHourAngleDeg).toBeCloseTo(subLondon.greenwichHourAngleDeg, 5);
    });

    it('aligns with known reference instant at ~12:00 UTC solar noon at Prime Meridian', () => {
      // Near solar noon on Greenwich meridian at equinox (March 20, 12:00 UTC)
      // EoT is small (~-7 minutes), so subsolar longitude should be close to 0°
      const instant = Instant.fromJSON('2026-03-20T12:07:00.000Z');
      const sub = getSubsolarPoint(instant);

      expect(Math.abs(sub.longitudeDeg)).toBeLessThan(5.0);
    });
  });

  describe('2. Timeline Nanosecond-Safe Mappings & Transformations', () => {
    const start = Instant.fromJSON('2026-06-21T00:00:00.000Z');
    const end = Instant.fromJSON('2026-06-22T00:00:00.000Z');
    const window24h = ChronoFlux.interval(start, end);
    const width = 1000;

    it('computes exact fractions across the search window without precision loss', () => {
      expect(getTimelineFraction(start, window24h)).toBe(0);
      expect(getTimelineFraction(end, window24h)).toBe(1);

      const noon = Instant.fromJSON('2026-06-21T12:00:00.000Z');
      expect(getTimelineFraction(noon, window24h)).toBeCloseTo(0.5, 9);

      const sixAm = Instant.fromJSON('2026-06-21T06:00:00.000Z');
      expect(getTimelineFraction(sixAm, window24h)).toBeCloseTo(0.25, 9);
    });

    it('maps Instant to pixel and pixel to Instant bidirectionally with nanosecond safety', () => {
      const noon = Instant.fromJSON('2026-06-21T12:00:00.000Z');
      const pixelX = instantToPixel(noon, window24h, width);
      expect(pixelX).toBeCloseTo(500, 4);

      const recoveredInstant = pixelToInstant(pixelX, window24h, width);
      expect(recoveredInstant.toISOString()).toBe('2026-06-21T12:00:00.000Z');
    });

    it('converts half-open interval into safe pixel bounding box', () => {
      const intStart = Instant.fromJSON('2026-06-21T06:00:00.000Z');
      const intEnd = Instant.fromJSON('2026-06-21T18:00:00.000Z');
      const interval = ChronoFlux.interval(intStart, intEnd);

      const box = intervalToPixelRange(interval, window24h, width);
      expect(box.startX).toBeCloseTo(250, 4);
      expect(box.endX).toBeCloseTo(750, 4);
      expect(box.width).toBeCloseTo(500, 4);
    });

    it('creates search windows for 24h, 48h, and 7d centered on anchor instant', () => {
      const anchor = Instant.fromJSON('2026-06-21T12:00:00.000Z');

      const win24 = createSearchWindow(anchor, '24h', 'centered');
      expect(win24.duration.totalHours).toBe(24);
      expect(win24.start.toISOString()).toBe('2026-06-21T00:00:00.000Z');
      expect(win24.end.toISOString()).toBe('2026-06-22T00:00:00.000Z');

      const win48 = createSearchWindow(anchor, '48h', 'centered');
      expect(win48.duration.totalHours).toBe(48);

      const win7d = createSearchWindow(anchor, '7d', 'centered');
      expect(win7d.duration.totalDays).toBe(7);
    });

    it('formats UTC ISO, civil date time, durations, and coordinates cleanly', () => {
      const inst = Instant.fromJSON('2026-06-21T14:30:45.123Z');
      expect(formatUtcIso(inst)).toBe('2026-06-21T14:30:45.123Z');

      const civilNy = formatCivilDateTime(inst, 'America/New_York');
      expect(civilNy).toContain('2026');
      expect(civilNy).toContain('EDT');

      const civilUtc = formatCivilDateTime(inst);
      expect(civilUtc).toContain('No Timezone');

      const dur = ChronoFlux.duration.of({ hours: 5, minutes: 23, seconds: 12 });
      expect(formatDurationFriendly(dur)).toBe('5h 23m 12s');

      const coord = formatCoordinate(40.7128, -74.006);
      expect(coord).toBe('40.7128° N, 74.0060° W');
    });
  });

  describe('3. Canvas 2D Plotting Coordinates & Color Mapping', () => {
    it('maps elevation [-90°, +90°] to canvas Y axis monotonically', () => {
      const canvasHeight = 300;
      const padTop = 20;
      const padBottom = 20;

      const yZenith = elevationToY(90, canvasHeight, padTop, padBottom);
      const yHorizon = elevationToY(0, canvasHeight, padTop, padBottom);
      const yNadir = elevationToY(-90, canvasHeight, padTop, padBottom);

      expect(yZenith).toBe(padTop); // Top of canvas
      expect(yHorizon).toBeCloseTo(150, 4); // Center of canvas
      expect(yNadir).toBe(canvasHeight - padBottom); // Bottom of canvas
      expect(yZenith).toBeLessThan(yHorizon);
      expect(yHorizon).toBeLessThan(yNadir);
    });

    it('maps azimuth [0°, 360°] to canvas Y axis monotonically', () => {
      const canvasHeight = 300;
      const padTop = 20;
      const padBottom = 20;

      const yNorth = azimuthToY(0, canvasHeight, padTop, padBottom);
      const ySouth = azimuthToY(180, canvasHeight, padTop, padBottom);
      const yWrapNorth = azimuthToY(360, canvasHeight, padTop, padBottom);

      expect(yNorth).toBe(canvasHeight - padBottom);
      expect(ySouth).toBeCloseTo(150, 4);
      expect(yWrapNorth).toBe(padTop);
    });

    it('resolves distinct styling colors for all 5 ChronoFlux SolarPhase regimes', () => {
      const phases: SolarPhase[] = [
        'day',
        'civil_twilight',
        'nautical_twilight',
        'astronomical_twilight',
        'night',
      ];
      const colors = phases.map(getSolarPhaseColor);
      // All colors must be unique hex strings
      const uniqueColors = new Set(colors);
      expect(uniqueColors.size).toBe(5);

      for (const phase of phases) {
        const rgba = getSolarPhaseBandRgba(phase);
        expect(rgba).toContain('rgba');
      }
    });

    it('resolves labels and badge colors for PolarRegimeType independently from solar phase', () => {
      expect(getPolarRegimeLabel('polar_day')).toContain('Midnight Sun');
      expect(getPolarRegimeLabel('polar_night')).toBe('Polar Night');
      expect(getPolarRegimeLabel('none')).toBe('Diurnal Cycle');

      expect(getPolarRegimeBadgeColor('polar_day')).toBeDefined();
      expect(getPolarRegimeBadgeColor('polar_night')).toBeDefined();
      expect(getPolarRegimeBadgeColor('none')).toBeDefined();
    });
  });

  describe('4. Query Presets AST Construction & Core Resolver Execution', () => {
    const nyPlace = ChronoFlux.place({
      latitude: 40.7128,
      longitude: -74.006,
      elevationMeters: 10,
      timeZoneId: 'America/New_York',
    });

    const tromsoPlace = ChronoFlux.place({
      latitude: 69.6492,
      longitude: 18.9553,
      elevationMeters: 20,
      timeZoneId: 'Europe/Oslo',
    });

    const searchWindow = ChronoFlux.interval(
      Instant.fromJSON('2026-06-21T00:00:00.000Z'),
      Instant.fromJSON('2026-06-22T00:00:00.000Z')
    );

    it('validates Preset 1 (High-Sun Window: elevation >= 15°)', () => {
      const preset = QUERY_PRESETS.find((p) => p.id === 'high_sun')!;
      expect(preset).toBeDefined();

      const res = ChronoFlux.resolve({
        place: nyPlace,
        within: searchWindow,
        where: preset.condition,
      });

      expect(res.intervals).toBeDefined();
      expect(res.report.modelsConsulted).toContain('solar');
      expect(res.intervals.intervals.length).toBeGreaterThan(0);
      expect(res.report.accuracy.solarNumericalToleranceDeg).toBeDefined();
    });

    it('validates Preset 2 (Civil Business Daylight: elevation >= 0° AND civil hour between 9 and 17)', () => {
      const preset = QUERY_PRESETS.find((p) => p.id === 'civil_business_daylight')!;
      expect(preset).toBeDefined();

      const res = ChronoFlux.resolve({
        place: nyPlace,
        within: searchWindow,
        where: preset.condition,
      });

      expect(res.report.modelsConsulted).toContain('solar');
      expect(res.report.modelsConsulted).toContain('civil');
      expect(res.intervals.intervals.length).toBe(1);

      // In New York (EDT, UTC-4), 09:00 to 17:00 EDT corresponds to 13:00 to 21:00 UTC
      const int = res.intervals.intervals[0]!;
      expect(int.start.toISOString()).toBe('2026-06-21T13:00:00.000Z');
      expect(int.end.toISOString()).toBe('2026-06-21T21:00:00.000Z');
      expect(int.duration.totalHours).toBe(8);
    });

    it('validates Preset 3 (Golden Hour: elevation between -4° and 6°)', () => {
      const preset = QUERY_PRESETS.find((p) => p.id === 'golden_hour')!;
      expect(preset).toBeDefined();

      const res = ChronoFlux.resolve({
        place: nyPlace,
        within: searchWindow,
        where: preset.condition,
      });

      expect(res.intervals.intervals.length).toBe(3); // Previous evening end + morning + next evening start
    });

    it('validates Preset 4 (Dark Sky Astrophotography across midnight)', () => {
      const preset = QUERY_PRESETS.find((p) => p.id === 'dark_sky')!;
      expect(preset).toBeDefined();

      const res = ChronoFlux.resolve({
        place: nyPlace,
        within: searchWindow,
        where: preset.condition,
      });

      expect(res.report.modelsConsulted).toContain('solar');
      expect(res.report.modelsConsulted).toContain('civil');
    });

    it('validates Preset 5 (Arctic Midnight Sun: polarRegime == polar_day in Tromsø during summer solstice)', () => {
      const preset = QUERY_PRESETS.find((p) => p.id === 'arctic_midnight_sun')!;
      expect(preset).toBeDefined();

      const res = ChronoFlux.resolve({
        place: tromsoPlace,
        within: searchWindow,
        where: preset.condition,
      });

      // At Tromsø on June 21, polar day persists continuously across the full window
      expect(res.intervals.intervals.length).toBe(1);
      const int = res.intervals.intervals[0]!;
      expect(int.start.equals(searchWindow.start)).toBe(true);
      expect(int.end.equals(searchWindow.end)).toBe(true);
    });

    it('applies selection policies (earliest, latest, longest) through QueryConsole options', () => {
      const goldenPreset = QUERY_PRESETS.find((p) => p.id === 'golden_hour')!;

      const resAll = ChronoFlux.resolve({
        place: nyPlace,
        within: searchWindow,
        where: goldenPreset.condition,
        policy: 'all',
      });
      expect(resAll.intervals.intervals.length).toBe(3);

      const resEarliest = ChronoFlux.resolve({
        place: nyPlace,
        within: searchWindow,
        where: goldenPreset.condition,
        policy: 'earliest',
      });
      expect(resEarliest.intervals.intervals.length).toBe(1);
      expect(resEarliest.intervals.intervals[0]!.equals(resAll.intervals.intervals[0]!)).toBe(true);

      const resLatest = ChronoFlux.resolve({
        place: nyPlace,
        within: searchWindow,
        where: goldenPreset.condition,
        policy: 'latest',
      });
      expect(resLatest.intervals.intervals.length).toBe(1);
      expect(resLatest.intervals.intervals[0]!.equals(resAll.intervals.intervals[resAll.intervals.intervals.length - 1]!)).toBe(true);
    });
  });

  describe('5. Multi-Location Spacetime Synchronization & DST Awareness', () => {
    it('verifies all 5 reference locations evaluate simultaneously at the same UTC instant', () => {
      const instant = Instant.fromJSON('2026-06-21T12:00:00.000Z');

      const tromso = LOCATION_PRESETS.find((p) => p.id === 'tromso')!.place;
      const quito = LOCATION_PRESETS.find((p) => p.id === 'quito')!.place;
      const ny = LOCATION_PRESETS.find((p) => p.id === 'new_york')!.place;
      const tokyo = LOCATION_PRESETS.find((p) => p.id === 'tokyo')!.place;
      const sydney = LOCATION_PRESETS.find((p) => p.id === 'sydney')!.place;

      const posTromso = ChronoFlux.solar.evaluatePosition(instant, tromso);
      const posQuito = ChronoFlux.solar.evaluatePosition(instant, quito);
      const posNy = ChronoFlux.solar.evaluatePosition(instant, ny);
      const posTokyo = ChronoFlux.solar.evaluatePosition(instant, tokyo);
      const posSydney = ChronoFlux.solar.evaluatePosition(instant, sydney);

      // Verify physical solar conditions differ geographically at the identical instant
      expect(posTromso.phase).toBe('day'); // High summer sun
      expect(posTokyo.phase).toBe('night'); // 21:00 in Tokyo -> night
      expect(posQuito.phase).toBe('day'); // Midday at equator
      expect(posSydney.phase).toBe('night'); // 22:00 in Sydney -> winter night

      // Verify civil models produce exact local times
      const civilNy = ChronoFlux.civil.evaluate(instant, ny);
      const civilTokyo = ChronoFlux.civil.evaluate(instant, tokyo);
      const civilSydney = ChronoFlux.civil.evaluate(instant, sydney);

      expect(civilNy.hour).toBe(8); // 12:00 UTC - 4 = 08:00 EDT
      expect(civilTokyo.hour).toBe(21); // 12:00 UTC + 9 = 21:00 JST
      expect(civilSydney.hour).toBe(22); // 12:00 UTC + 10 = 22:00 AEST
    });

    it('demonstrates DST repeated hour visibility in America/New_York on Nov 1, 2026', () => {
      const place = LOCATION_PRESETS.find((p) => p.id === 'new_york')!.place;

      // 1. First occurrence of 01:30 (EDT, UTC-4) -> 05:30:00 UTC
      const tEarlier = Instant.fromJSON('2026-11-01T05:30:00.000Z');
      const stateEarlier = ChronoFlux.civil.evaluate(tEarlier, place);
      expect(stateEarlier.hour).toBe(1);
      expect(stateEarlier.minute).toBe(30);
      expect(stateEarlier.utcOffsetMinutes).toBe(-240); // UTC-4
      expect(stateEarlier.isDaylightSaving).toBe(true);

      // 2. Second occurrence of 01:30 (EST, UTC-5) -> 06:30:00 UTC
      const tLater = Instant.fromJSON('2026-11-01T06:30:00.000Z');
      const stateLater = ChronoFlux.civil.evaluate(tLater, place);
      expect(stateLater.hour).toBe(1);
      expect(stateLater.minute).toBe(30);
      expect(stateLater.utcOffsetMinutes).toBe(-300); // UTC-5
      expect(stateLater.isDaylightSaving).toBe(false);

      // Resolving hour == 1 synthesizes both physical occurrences, canonically merged into a continuous 2-hour block [05:00Z, 07:00Z)
      const windowDst = ChronoFlux.interval(
        Instant.fromJSON('2026-11-01T04:00:00.000Z'),
        Instant.fromJSON('2026-11-01T08:00:00.000Z')
      );
      const resHour = ChronoFlux.resolve({
        place,
        within: windowDst,
        where: Conditions.civil.hour.eq(1),
      });

      expect(resHour.intervals.intervals.length).toBe(1);
      expect(resHour.intervals.intervals[0]!.start.toISOString()).toBe('2026-11-01T05:00:00.000Z');
      expect(resHour.intervals.intervals[0]!.end.toISOString()).toBe('2026-11-01T07:00:00.000Z');
      expect(resHour.intervals.intervals[0]!.duration.totalHours).toBe(2);

      // Resolving minute == 15 inside the repeated hour synthesizes two distinct physical intervals
      const resMin = ChronoFlux.resolve({
        place,
        within: windowDst,
        where: Conditions.and(
          Conditions.civil.hour.eq(1),
          Conditions.civil.minute.eq(15)
        ),
      });
      expect(resMin.intervals.intervals.length).toBe(2);
      expect(resMin.intervals.intervals[0]!.start.toISOString()).toBe('2026-11-01T05:15:00.000Z');
      expect(resMin.intervals.intervals[1]!.start.toISOString()).toBe('2026-11-01T06:15:00.000Z');
    });

    it('proves polar regime and solar phase are independent dimensions', () => {
      const tromso = LOCATION_PRESETS.find((p) => p.id === 'tromso')!.place;

      // Equinox crossing: diurnal cycle exists, phase varies from day to twilight
      const equinoxNoon = Instant.fromJSON('2026-03-20T11:00:00.000Z');
      const stateNoon = ChronoFlux.solar.evaluate(equinoxNoon, tromso);
      expect(stateNoon.polarRegime).toBe('none');
      expect(stateNoon.phase).toBe('day');

      // Polar Night in December: location has polarRegime == 'polar_night',
      // but around noon experiences civil_twilight as the Sun grazes below the horizon!
      const polarNoon = Instant.fromJSON('2026-12-21T11:00:00.000Z');
      const statePolar = ChronoFlux.solar.evaluate(polarNoon, tromso);
      expect(statePolar.polarRegime).toBe('polar_night');
      // Elevation is ~-3° (above -6° civil twilight limit), so civil_twilight holds!
      expect(statePolar.phase).toBe('civil_twilight');
    });
  });

  describe('6. Allen Interval Relationship Verification in Query Console', () => {
    it('accurately verifies all 13 Allen relationships between intervals', () => {
      const t0 = Instant.fromJSON('2026-06-21T00:00:00.000Z');
      const t1 = Instant.fromJSON('2026-06-21T01:00:00.000Z');
      const t2 = Instant.fromJSON('2026-06-21T02:00:00.000Z');
      const t3 = Instant.fromJSON('2026-06-21T03:00:00.000Z');
      const t4 = Instant.fromJSON('2026-06-21T04:00:00.000Z');

      const i01 = ChronoFlux.interval(t0, t1);
      const i12 = ChronoFlux.interval(t1, t2);
      const i23 = ChronoFlux.interval(t2, t3);
      const i02 = ChronoFlux.interval(t0, t2);
      const i13 = ChronoFlux.interval(t1, t3);
      const i03 = ChronoFlux.interval(t0, t3);
      const i14 = ChronoFlux.interval(t1, t4);

      // before / after
      expect(i01.relationTo(i23)).toBe('before');
      expect(i23.relationTo(i01)).toBe('after');

      // meets / metBy
      expect(i01.relationTo(i12)).toBe('meets');
      expect(i12.relationTo(i01)).toBe('metBy');

      // overlaps / overlappedBy
      expect(i02.relationTo(i13)).toBe('overlaps');
      expect(i13.relationTo(i02)).toBe('overlappedBy');

      // starts / startedBy
      expect(i01.relationTo(i02)).toBe('starts');
      expect(i02.relationTo(i01)).toBe('startedBy');

      // during / contains
      expect(i12.relationTo(i03)).toBe('during');
      expect(i03.relationTo(i12)).toBe('contains');

      // finishes / finishedBy
      expect(i23.relationTo(i03)).toBe('finishes');
      expect(i03.relationTo(i23)).toBe('finishedBy');

      // equals
      const i01Dup = ChronoFlux.interval(t0, t1);
      expect(i01.relationTo(i01Dup)).toBe('equals');
    });
  });

  describe('7. TIME 2.0 Product Transformation & Interactive Presets', () => {
    it('guarantees Time and ChronoFlux are identical facades', async () => {
      const { Time } = await import('../src/index.js');
      expect(Time).toBe(ChronoFlux);
      expect(Time.resolve).toBe(ChronoFlux.resolve);
      expect(Time.solar).toBe(ChronoFlux.solar);
      expect(Time.civil).toBe(ChronoFlux.civil);
    });

    it('validates all 6 interactive questions point to existing presets and resolve cleanly', async () => {
      const { INTERACTIVE_QUESTIONS } = await import('../src/visualizer/src/state/presets.js');
      const { Time } = await import('../src/index.js');

      expect(INTERACTIVE_QUESTIONS.length).toBe(6);

      for (const q of INTERACTIVE_QUESTIONS) {
        expect(q.title).toBeTruthy();
        expect(q.subtitle).toBeTruthy();
        const loc = LOCATION_PRESETS.find((p) => p.id === q.locationId);
        expect(loc).toBeDefined();

        // Solar evaluation must execute with 0 errors
        const now = Time.now();
        const state = Time.solar.evaluate(now, loc!.place);
        expect(state.elevationDeg).toBeTypeOf('number');
        expect(state.phase).toBeTypeOf('string');
      }
    });

    it('verifies all 12 glossary terms provide plain-language and detailed explanations', async () => {
      const { GLOSSARY_TERMS } = await import('../src/visualizer/src/state/presets.js');

      expect(GLOSSARY_TERMS.length).toBeGreaterThanOrEqual(12);

      const validCategories = new Set(['solar', 'civil', 'intervals', 'engine']);
      for (const item of GLOSSARY_TERMS) {
        expect(item.term).toBeTruthy();
        expect(item.simpleExplanation).toBeTruthy();
        expect(item.detailedExplanation).toBeTruthy();
        expect(validCategories.has(item.category)).toBe(true);
      }
    });
  });
});
