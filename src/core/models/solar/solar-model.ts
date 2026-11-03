/**
 * @file solar-model.ts
 * High-precision astronomical solar model implementing TemporalModel<SolarState>.
 */

import { Duration } from '../../primitives/duration.js';
import { Instant } from '../../primitives/instant.js';
import { Interval } from '../../primitives/interval.js';
import { Place } from '../../primitives/place.js';
import { ModelMetadata, TemporalModel } from '../model.js';
import { findNextSolarEvent } from './events.js';
import {
  calcHorizonDip,
  calcSolarCrossingUncertainty,
  calcSolarNoon,
  computeSolarCoordinates,
  findSolarCrossing,
  NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG,
  SOLAR_MODEL_VALIDITY_RANGE,
} from './math.js';
import { classifySolarPhase, evaluatePolarRegime, PolarRegime } from './polar.js';
import { onAstronomicalTimeScaleChange } from './timescale.js';
import {
  InstantaneousSolarPosition,
  SolarEventInstant,
  SolarEventOptions,
  SolarState,
  SolarTransitionInstant,
  SolarUncertaintyDetails,
} from './types.js';

export { SOLAR_MODEL_VALIDITY_RANGE };

export const SOLAR_MODEL_METADATA: ModelMetadata = Object.freeze({
  name: 'Astronomical Solar Model (Jean Meeus / NOAA)',
  version: '1.0.0',
  accuracy: Object.freeze({
    timeResolution: Duration.fromMilliseconds(1),
    marginOfError: '±0.01° for 1800-2100 CE; dynamic event-time uncertainty Delta t = Delta h / |dh/dt|',
  }),
  assumptions: Object.freeze([
    'Jean Meeus (Astronomical Algorithms, 2nd ed.) solar positioning formulations',
    'NOAA Solar Calculator atmospheric refraction formulation (Saemundsson / Bennett nominal 1010 mbar, 10°C)',
    'Nominal solar disc center-of-disc horizon dip of -0.8333° (34 arcmin refraction + 16 arcmin semidiameter)',
    'WGS84 ellipsoidal coordinate frame',
    'Leap-second-free Unix epoch time scale',
  ]),
  validityRange: SOLAR_MODEL_VALIDITY_RANGE,
});

interface DiurnalCycleEvents extends PolarRegime {
  readonly solarNoon: SolarEventInstant;
  readonly solarMidnight: SolarEventInstant;
  readonly sunrise: SolarEventInstant | null;
  readonly sunset: SolarEventInstant | null;
  readonly sunriseUncertaintyMinutes: number | null;
  readonly sunsetUncertaintyMinutes: number | null;
}

const MAX_DIURNAL_CACHE_SIZE = 512;
const diurnalCache = new Map<string, DiurnalCycleEvents>();

/**
 * Clears the diurnal event cache.
 */
export function clearSolarCache(): void {
  diurnalCache.clear();
}

// Invalidate diurnal event cache whenever active astronomical timescale provider changes
onAstronomicalTimeScaleChange(() => {
  clearSolarCache();
});

function getDiurnalCycleEvents(place: Place, instant: Instant): DiurnalCycleEvents {
  const noon = calcSolarNoon(instant, place.longitude);
  const noonSeconds = Math.round(Number(noon.epochNanoseconds / 1_000_000_000n));
  const elevMeters = place.elevationMeters ?? 0;
  // Exact coordinate and elevation stringification without lossy rounding to prevent cross-location cache collisions.
  const cacheKey = `${place.latitude},${place.longitude},${elevMeters}:${noonSeconds}`;

  const cached = diurnalCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const regime = evaluatePolarRegime(place, instant);
  let sunrise: Instant | null = null;
  let sunset: Instant | null = null;
  let sunriseUncertaintyMinutes: number | null = null;
  let sunsetUncertaintyMinutes: number | null = null;

  const horizonDipDeg = calcHorizonDip(place.elevationMeters);
  const targetElevationDeg = NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG - horizonDipDeg;

  if (!regime.isPolarDay && !regime.isPolarNight) {
    sunrise = findSolarCrossing(
      place,
      regime.solarNoon,
      targetElevationDeg,
      'rising'
    );
    if (sunrise !== null) {
      sunriseUncertaintyMinutes = calcSolarCrossingUncertainty(
        place,
        sunrise,
        targetElevationDeg
      );
    }
    sunset = findSolarCrossing(
      place,
      regime.solarNoon,
      targetElevationDeg,
      'setting'
    );
    if (sunset !== null) {
      sunsetUncertaintyMinutes = calcSolarCrossingUncertainty(
        place,
        sunset,
        targetElevationDeg
      );
    }
  }

  const isNoonValid = SOLAR_MODEL_VALIDITY_RANGE.contains(regime.solarNoon);
  const noonCoords = computeSolarCoordinates(regime.solarNoon, place);
  const solarNoon = new SolarEventInstant(regime.solarNoon.epochNanoseconds, {
    event: 'solarNoon',
    isWithinValidityRange: isNoonValid,
    isAccuracyDegraded: !isNoonValid,
    uncertaintyDeg: noonCoords.uncertainty.combinedCoordinateUncertaintyDeg,
    uncertaintyMinutes: noonCoords.uncertainty.eventTimeUncertaintyMinutes,
    uncertainty: noonCoords.uncertainty,
  });

  const isMidnightValid = SOLAR_MODEL_VALIDITY_RANGE.contains(regime.solarMidnight);
  const midnightCoords = computeSolarCoordinates(regime.solarMidnight, place);
  const solarMidnight = new SolarEventInstant(regime.solarMidnight.epochNanoseconds, {
    event: 'solarMidnight',
    isWithinValidityRange: isMidnightValid,
    isAccuracyDegraded: !isMidnightValid,
    uncertaintyDeg: midnightCoords.uncertainty.combinedCoordinateUncertaintyDeg,
    uncertaintyMinutes: midnightCoords.uncertainty.eventTimeUncertaintyMinutes,
    uncertainty: midnightCoords.uncertainty,
  });

  let sunriseInst: SolarEventInstant | null = null;
  if (sunrise !== null) {
    const isSunriseValid = SOLAR_MODEL_VALIDITY_RANGE.contains(sunrise);
    const sunriseCoords = computeSolarCoordinates(sunrise, place);
    sunriseInst = new SolarEventInstant(sunrise.epochNanoseconds, {
      event: 'sunrise',
      isWithinValidityRange: isSunriseValid,
      isAccuracyDegraded: !isSunriseValid,
      uncertaintyDeg: sunriseCoords.uncertainty.combinedCoordinateUncertaintyDeg,
      uncertaintyMinutes: sunriseUncertaintyMinutes ?? sunriseCoords.uncertainty.eventTimeUncertaintyMinutes,
      uncertainty: sunriseCoords.uncertainty,
    });
  }

  let sunsetInst: SolarEventInstant | null = null;
  if (sunset !== null) {
    const isSunsetValid = SOLAR_MODEL_VALIDITY_RANGE.contains(sunset);
    const sunsetCoords = computeSolarCoordinates(sunset, place);
    sunsetInst = new SolarEventInstant(sunset.epochNanoseconds, {
      event: 'sunset',
      isWithinValidityRange: isSunsetValid,
      isAccuracyDegraded: !isSunsetValid,
      uncertaintyDeg: sunsetCoords.uncertainty.combinedCoordinateUncertaintyDeg,
      uncertaintyMinutes: sunsetUncertaintyMinutes ?? sunsetCoords.uncertainty.eventTimeUncertaintyMinutes,
      uncertainty: sunsetCoords.uncertainty,
    });
  }

  const events: DiurnalCycleEvents = Object.freeze({
    ...regime,
    solarNoon,
    solarMidnight,
    sunrise: sunriseInst,
    sunset: sunsetInst,
    sunriseUncertaintyMinutes,
    sunsetUncertaintyMinutes,
  });

  if (diurnalCache.size >= MAX_DIURNAL_CACHE_SIZE) {
    // Evict oldest entry
    const oldestKey = diurnalCache.keys().next().value;
    if (oldestKey) {
      diurnalCache.delete(oldestKey);
    }
  }
  diurnalCache.set(cacheKey, events);

  return events;
}

/**
 * SolarModel calculates astronomical solar position, twilight regimes,
 * and sunrise/sunset/transit events using Meeus and NOAA formulations.
 */
export class SolarModel implements TemporalModel<SolarState> {
  readonly metadata: ModelMetadata = SOLAR_MODEL_METADATA;

  /**
   * Evaluates instantaneous solar coordinates and position without expensive diurnal event solving.
   * Highly optimized for timeseries loops and high-throughput queries.
   */
  evaluatePosition(instant: Instant, place: Place): InstantaneousSolarPosition {
    const coords = computeSolarCoordinates(instant, place);
    const horizonDipDeg = calcHorizonDip(place.elevationMeters);
    const phase = classifySolarPhase(coords.geometricElevationDeg, horizonDipDeg);
    const isWithinValidityRange = SOLAR_MODEL_VALIDITY_RANGE.contains(instant);
    const isAccuracyDegraded = !isWithinValidityRange;
    const targetElevationDeg = NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG - horizonDipDeg;

    const uncertainty: SolarUncertaintyDetails = Object.freeze({
      ...coords.uncertainty,
      sunriseUncertaintyMinutes: null,
      sunsetUncertaintyMinutes: null,
    });

    return Object.freeze({
      elevationDeg: coords.apparentElevationDeg,
      geometricElevationDeg: coords.geometricElevationDeg,
      azimuthDeg: coords.azimuthDeg,
      isAzimuthIndeterminate: coords.isAzimuthIndeterminate,
      zenithDeg: coords.apparentZenithDeg,
      phase,
      isWithinValidityRange,
      isAccuracyDegraded,
      isDirectSunlight: coords.geometricElevationDeg >= targetElevationDeg,
      declinationDeg: coords.declinationDeg,
      rightAscensionDeg: coords.rightAscensionDeg,
      equationOfTimeMinutes: coords.equationOfTimeMinutes,
      hourAngleDeg: coords.hourAngleDeg,
      trueSolarTimeMinutes: coords.trueSolarTimeMinutes,
      atmosphericRefractionDeg: coords.atmosphericRefractionDeg,
      uncertaintyDeg: coords.uncertainty.combinedCoordinateUncertaintyDeg,
      uncertaintyMinutes: coords.uncertainty.eventTimeUncertaintyMinutes,
      uncertainty,
    });
  }

  /**
   * Evaluates the full solar state at a given Instant and Place.
   * Utilizes high-performance diurnal event caching for repeated queries at the same location and date.
   */
  evaluate(instant: Instant, place: Place): SolarState {
    const coords = computeSolarCoordinates(instant, place);
    const diurnal = getDiurnalCycleEvents(place, instant);
    const horizonDipDeg = calcHorizonDip(place.elevationMeters);
    const phase = classifySolarPhase(coords.geometricElevationDeg, horizonDipDeg);
    const isWithinValidityRange = SOLAR_MODEL_VALIDITY_RANGE.contains(instant);
    const isAccuracyDegraded = !isWithinValidityRange;
    const targetElevationDeg = NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG - horizonDipDeg;

    const uncertainty: SolarUncertaintyDetails = Object.freeze({
      ...coords.uncertainty,
      sunriseUncertaintyMinutes: diurnal.sunriseUncertaintyMinutes,
      sunsetUncertaintyMinutes: diurnal.sunsetUncertaintyMinutes,
    });

    const state: SolarState = Object.freeze({
      elevationDeg: coords.apparentElevationDeg,
      geometricElevationDeg: coords.geometricElevationDeg,
      azimuthDeg: coords.azimuthDeg,
      isAzimuthIndeterminate: coords.isAzimuthIndeterminate,
      zenithDeg: coords.apparentZenithDeg,
      phase,
      polarRegime: diurnal.polarRegime,
      isDirectSunlight: coords.geometricElevationDeg >= targetElevationDeg,
      isPolarDay: diurnal.isPolarDay,
      isPolarNight: diurnal.isPolarNight,
      isWithinValidityRange,
      isAccuracyDegraded,
      solarNoon: diurnal.solarNoon,
      solarMidnight: diurnal.solarMidnight,
      sunrise: diurnal.sunrise,
      sunset: diurnal.sunset,
      declinationDeg: coords.declinationDeg,
      rightAscensionDeg: coords.rightAscensionDeg,
      equationOfTimeMinutes: coords.equationOfTimeMinutes,
      hourAngleDeg: coords.hourAngleDeg,
      trueSolarTimeMinutes: coords.trueSolarTimeMinutes,
      atmosphericRefractionDeg: coords.atmosphericRefractionDeg,
      uncertaintyDeg: coords.uncertainty.combinedCoordinateUncertaintyDeg,
      uncertaintyMinutes: coords.uncertainty.eventTimeUncertaintyMinutes,
      uncertainty,
    });

    return state;
  }

  /**
   * Finds the next discrete solar event strictly after options.after.
   */
  nextEvent(options: SolarEventOptions): SolarEventInstant | null {
    return findNextSolarEvent(options);
  }

  /**
   * Finds all transition boundary instants where solar elevation crosses a threshold
   * within a given search interval.
   */
  findTransitions(
    place: Place,
    searchWindow: Interval,
    thresholdDeg: number
  ): SolarTransitionInstant[] {
    const transitions: SolarTransitionInstant[] = [];
    const oneDayNs = 86_400_000_000_000n;
    const startNs = searchWindow.start.epochNanoseconds;
    const endNs = searchWindow.end.epochNanoseconds;

    // Iterate through diurnal cycles within searchWindow
    for (let currentNs = startNs; currentNs <= endNs + oneDayNs; currentNs += oneDayNs) {
      const anchor = Instant.fromEpochNanoseconds(currentNs);
      const noon = calcSolarNoon(anchor, place.longitude);

      const rising = findSolarCrossing(place, noon, thresholdDeg, 'rising');
      if (rising !== null && searchWindow.contains(rising)) {
        const coords = computeSolarCoordinates(rising, place);
        const isWithinValidityRange = SOLAR_MODEL_VALIDITY_RANGE.contains(rising);
        transitions.push(
          new SolarTransitionInstant(rising.epochNanoseconds, {
            thresholdDeg,
            direction: 'rising',
            isWithinValidityRange,
            isAccuracyDegraded: !isWithinValidityRange,
            uncertaintyDeg: coords.uncertainty.combinedCoordinateUncertaintyDeg,
            uncertaintyMinutes: coords.uncertainty.eventTimeUncertaintyMinutes,
            uncertainty: coords.uncertainty,
          })
        );
      }

      const setting = findSolarCrossing(place, noon, thresholdDeg, 'setting');
      if (setting !== null && searchWindow.contains(setting)) {
        const coords = computeSolarCoordinates(setting, place);
        const isWithinValidityRange = SOLAR_MODEL_VALIDITY_RANGE.contains(setting);
        transitions.push(
          new SolarTransitionInstant(setting.epochNanoseconds, {
            thresholdDeg,
            direction: 'setting',
            isWithinValidityRange,
            isAccuracyDegraded: !isWithinValidityRange,
            uncertaintyDeg: coords.uncertainty.combinedCoordinateUncertaintyDeg,
            uncertaintyMinutes: coords.uncertainty.eventTimeUncertaintyMinutes,
            uncertainty: coords.uncertainty,
          })
        );
      }
    }

    // Deduplicate and sort
    transitions.sort((a, b) => (a.isBefore(b) ? -1 : a.equals(b) ? 0 : 1));
    return transitions.filter(
      (inst, idx, arr) =>
        idx === 0 ||
        (!inst.equals(arr[idx - 1]!) &&
          (Math.abs(Number(inst.epochNanoseconds - arr[idx - 1]!.epochNanoseconds)) > 1_000_000_000 ||
            inst.direction !== arr[idx - 1]!.direction))
    );
  }
}

/**
 * Frozen singleton instance of the Astronomical Solar Model.
 */
export const solarModel = Object.freeze(new SolarModel());
