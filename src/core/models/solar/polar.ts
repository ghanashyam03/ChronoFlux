/**
 * @file polar.ts
 * Polar edge case detection and handlers (Midnight Sun and Polar Night).
 */

import { Instant } from '../../primitives/instant.js';
import { Place } from '../../primitives/place.js';
import {
  ASTRONOMICAL_TWILIGHT_ELEVATION_DEG,
  calcSolarMidnight,
  calcSolarNoon,
  CIVIL_TWILIGHT_ELEVATION_DEG,
  computeSolarCoordinates,
  NAUTICAL_TWILIGHT_ELEVATION_DEG,
} from './math.js';
import { SolarPhase } from './types.js';

/**
 * Standard horizon threshold for direct sunlight and sunrise/sunset (-0.833°).
 */
export const DIRECT_SUNLIGHT_THRESHOLD_DEG = -0.833;

export interface PolarRegime {
  readonly isPolarDay: boolean;
  readonly isPolarNight: boolean;
  readonly solarNoon: Instant;
  readonly solarMidnight: Instant;
  readonly maxElevationDeg: number;
  readonly minElevationDeg: number;
}

/**
 * Evaluates whether the given place and instant falls in a Polar Day or Polar Night regime
 * on its diurnal cycle.
 */
export function evaluatePolarRegime(place: Place, instant: Instant): PolarRegime {
  // Check latitude: polar day/night only physically possible at high latitudes (|phi| > 65°)
  if (Math.abs(place.latitude) < 65.0) {
    const noon = calcSolarNoon(instant, place.longitude);
    const midnight = calcSolarMidnight(instant, place.longitude);
    const coordsNoon = computeSolarCoordinates(noon, place);
    const coordsMidnight = computeSolarCoordinates(midnight, place);
    return {
      isPolarDay: false,
      isPolarNight: false,
      solarNoon: noon,
      solarMidnight: midnight,
      maxElevationDeg: coordsNoon.apparentElevationDeg,
      minElevationDeg: coordsMidnight.apparentElevationDeg,
    };
  }

  const noon = calcSolarNoon(instant, place.longitude);
  const midnight = calcSolarMidnight(instant, place.longitude);
  const coordsNoon = computeSolarCoordinates(noon, place);
  const coordsMidnight = computeSolarCoordinates(midnight, place);

  const maxElevationDeg = coordsNoon.apparentElevationDeg;
  const minElevationDeg = coordsMidnight.apparentElevationDeg;

  // Polar Day: elevation never drops below nominal horizon (-0.833°)
  const isPolarDay = minElevationDeg >= DIRECT_SUNLIGHT_THRESHOLD_DEG;

  // Polar Night: elevation never reaches nominal horizon (-0.833°)
  const isPolarNight = maxElevationDeg < DIRECT_SUNLIGHT_THRESHOLD_DEG;

  return {
    isPolarDay,
    isPolarNight,
    solarNoon: noon,
    solarMidnight: midnight,
    maxElevationDeg,
    minElevationDeg,
  };
}

/**
 * Classifies the solar phase based on elevation and polar regime.
 */
export function classifySolarPhase(apparentElevationDeg: number, regime: PolarRegime): SolarPhase {
  if (regime.isPolarDay) {
    return 'polar_day';
  }
  if (regime.isPolarNight) {
    return 'polar_night';
  }
  if (apparentElevationDeg >= DIRECT_SUNLIGHT_THRESHOLD_DEG) {
    return 'day';
  }
  if (apparentElevationDeg >= CIVIL_TWILIGHT_ELEVATION_DEG) {
    return 'civil_twilight';
  }
  if (apparentElevationDeg >= NAUTICAL_TWILIGHT_ELEVATION_DEG) {
    return 'nautical_twilight';
  }
  if (apparentElevationDeg >= ASTRONOMICAL_TWILIGHT_ELEVATION_DEG) {
    return 'astronomical_twilight';
  }
  return 'night';
}
