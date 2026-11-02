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
  calcSolarNoon,
  computeSolarCoordinates,
  findSolarCrossing,
  NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG,
} from './math.js';
import { classifySolarPhase, DIRECT_SUNLIGHT_THRESHOLD_DEG, evaluatePolarRegime } from './polar.js';
import { SolarEventOptions, SolarState } from './types.js';

export const SOLAR_MODEL_METADATA: ModelMetadata = Object.freeze({
  name: 'Astronomical Solar Model (Jean Meeus / NOAA)',
  version: '1.0.0',
  accuracy: Object.freeze({
    timeResolution: Duration.fromMilliseconds(1),
    marginOfError: '±0.01° for 1800-2100 CE (±0.04 minutes / ~2.4 seconds of time)',
  }),
  assumptions: Object.freeze([
    'Jean Meeus (Astronomical Algorithms, 2nd ed.) solar positioning formulations',
    'NOAA Solar Calculator atmospheric refraction formulation (Saemundsson / Bennett nominal 1010 mbar, 10°C)',
    'Nominal solar disc center-of-disc horizon dip of -0.833° (34 arcmin refraction + 16 arcmin semidiameter)',
    'WGS84 ellipsoidal coordinate frame',
    'Leap-second-free Unix epoch time scale',
  ]),
  validityRange: new Interval(
    Instant.fromEpochMilliseconds(-5364662400000), // 1800-01-01T00:00:00Z
    Instant.fromEpochMilliseconds(4133980800000)  // 2101-01-01T00:00:00Z
  ),
});

/**
 * SolarModel calculates astronomical solar position, twilight regimes,
 * and sunrise/sunset/transit events using Meeus and NOAA formulations.
 */
export class SolarModel implements TemporalModel<SolarState> {
  readonly metadata: ModelMetadata = SOLAR_MODEL_METADATA;

  /**
   * Evaluates the full solar state at a given Instant and Place.
   */
  evaluate(instant: Instant, place: Place): SolarState {
    const coords = computeSolarCoordinates(instant, place);
    const regime = evaluatePolarRegime(place, instant);
    const phase = classifySolarPhase(coords.apparentElevationDeg, regime);

    let sunrise: Instant | null = null;
    let sunset: Instant | null = null;

    if (!regime.isPolarDay && !regime.isPolarNight) {
      sunrise = findSolarCrossing(
        place,
        regime.solarNoon,
        NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG,
        'rising'
      );
      sunset = findSolarCrossing(
        place,
        regime.solarNoon,
        NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG,
        'setting'
      );
    }

    const state: SolarState = Object.freeze({
      elevationDeg: coords.apparentElevationDeg,
      geometricElevationDeg: coords.geometricElevationDeg,
      azimuthDeg: coords.azimuthDeg,
      zenithDeg: coords.apparentZenithDeg,
      phase,
      isDirectSunlight: coords.apparentElevationDeg >= DIRECT_SUNLIGHT_THRESHOLD_DEG,
      isPolarDay: regime.isPolarDay,
      isPolarNight: regime.isPolarNight,
      solarNoon: regime.solarNoon,
      solarMidnight: regime.solarMidnight,
      sunrise,
      sunset,
      declinationDeg: coords.declinationDeg,
      rightAscensionDeg: coords.rightAscensionDeg,
      equationOfTimeMinutes: coords.equationOfTimeMinutes,
      hourAngleDeg: coords.hourAngleDeg,
      trueSolarTimeMinutes: coords.trueSolarTimeMinutes,
      atmosphericRefractionDeg: coords.atmosphericRefractionDeg,
      uncertaintyDeg: 0.01,
      uncertaintyMinutes: 0.04,
    });

    return state;
  }

  /**
   * Finds the next discrete solar event strictly after options.after.
   */
  nextEvent(options: SolarEventOptions): Instant | null {
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
  ): Instant[] {
    const transitions: Instant[] = [];
    const oneDayNs = 86_400_000_000_000n;
    const startNs = searchWindow.start.epochNanoseconds;
    const endNs = searchWindow.end.epochNanoseconds;

    // Iterate through diurnal cycles within searchWindow
    for (let currentNs = startNs; currentNs <= endNs + oneDayNs; currentNs += oneDayNs) {
      const anchor = Instant.fromEpochNanoseconds(currentNs);
      const noon = calcSolarNoon(anchor, place.longitude);

      const rising = findSolarCrossing(place, noon, thresholdDeg, 'rising');
      if (rising !== null && searchWindow.contains(rising)) {
        transitions.push(rising);
      }

      const setting = findSolarCrossing(place, noon, thresholdDeg, 'setting');
      if (setting !== null && searchWindow.contains(setting)) {
        transitions.push(setting);
      }
    }

    // Deduplicate and sort
    transitions.sort((a, b) => (a.isBefore(b) ? -1 : a.equals(b) ? 0 : 1));
    return transitions.filter(
      (inst, idx, arr) => idx === 0 || !inst.equals(arr[idx - 1]!)
    );
  }
}

/**
 * Frozen singleton instance of the Astronomical Solar Model.
 */
export const solarModel = Object.freeze(new SolarModel());
