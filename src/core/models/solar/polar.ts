/**
 * @file polar.ts
 * Polar edge case detection and handlers (Midnight Sun and Polar Night).
 */

import { Instant } from '../../primitives/instant.js';
import { Place } from '../../primitives/place.js';
import {
  ASTRONOMICAL_TWILIGHT_ELEVATION_DEG,
  calcHorizonDip,
  calcSolarMidnight,
  calcSolarNoon,
  CIVIL_TWILIGHT_ELEVATION_DEG,
  computeSolarCoordinates,
  NAUTICAL_TWILIGHT_ELEVATION_DEG,
  NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG,
} from './math.js';
import { PolarRegimeType, SolarPhase } from './types.js';

/**
 * Standard horizon threshold for direct sunlight and sunrise/sunset (-0.8333°).
 * Represents the geometric elevation of the center of the solar disk when the
 * apparent upper limb touches the astronomical horizon (34' refraction + 16' semidiameter = 50' = 0.8333333333333334°).
 */
export const DIRECT_SUNLIGHT_THRESHOLD_DEG = NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG;

export interface PolarRegime {
  readonly isPolarDay: boolean;
  readonly isPolarNight: boolean;
  readonly polarRegime: PolarRegimeType;
  readonly solarNoon: Instant;
  readonly solarMidnight: Instant;
  readonly maxGeometricElevationDeg: number;
  readonly minGeometricElevationDeg: number;
  readonly maxElevationDeg: number;
  readonly minElevationDeg: number;
}

/**
 * Evaluates whether the given place and instant falls in a Polar Day or Polar Night regime
 * on its diurnal cycle.
 *
 * Polar day and polar night are strictly evaluated on geometric solar elevation (h_geom):
 * - Polar Day: Diurnal minimum h_geom >= -0.8333° (apparent upper limb never sets).
 * - Polar Night: Diurnal maximum h_geom < -0.8333° (apparent upper limb never rises).
 */
export function evaluatePolarRegime(place: Place, instant: Instant): PolarRegime {
  const noon = calcSolarNoon(instant, place.longitude);
  const midnight = calcSolarMidnight(instant, place.longitude);
  const coordsNoon = computeSolarCoordinates(noon, place);
  const coordsMidnight = computeSolarCoordinates(midnight, place);

  // Check latitude: polar day/night only physically possible at high latitudes (|phi| > 65°)
  if (Math.abs(place.latitude) < 65.0) {
    return {
      isPolarDay: false,
      isPolarNight: false,
      polarRegime: 'none',
      solarNoon: noon,
      solarMidnight: midnight,
      maxGeometricElevationDeg: coordsNoon.geometricElevationDeg,
      minGeometricElevationDeg: coordsMidnight.geometricElevationDeg,
      maxElevationDeg: coordsNoon.apparentElevationDeg,
      minElevationDeg: coordsMidnight.apparentElevationDeg,
    };
  }

  const maxGeometricElevationDeg = coordsNoon.geometricElevationDeg;
  const minGeometricElevationDeg = coordsMidnight.geometricElevationDeg;
  const maxElevationDeg = coordsNoon.apparentElevationDeg;
  const minElevationDeg = coordsMidnight.apparentElevationDeg;

  const horizonDipDeg = calcHorizonDip(place.elevationMeters);
  const thresholdDeg = DIRECT_SUNLIGHT_THRESHOLD_DEG - horizonDipDeg;

  // Polar Day: geometric elevation never drops below observer's dipped horizon
  const isPolarDay = minGeometricElevationDeg >= thresholdDeg;

  // Polar Night: geometric elevation never reaches observer's dipped horizon
  const isPolarNight = maxGeometricElevationDeg < thresholdDeg;
  const polarRegime: PolarRegimeType = isPolarDay ? 'polar_day' : isPolarNight ? 'polar_night' : 'none';

  return {
    isPolarDay,
    isPolarNight,
    polarRegime,
    solarNoon: noon,
    solarMidnight: midnight,
    maxGeometricElevationDeg,
    minGeometricElevationDeg,
    maxElevationDeg,
    minElevationDeg,
  };
}

/**
 * Classifies the solar phase based strictly on instantaneous geometric elevation.
 *
 * All twilight thresholds (civil -6°, nautical -12°, astronomical -18°) are astronomically defined
 * on geometric solar elevation h_geom. Polar regime ('polar_day' | 'polar_night') is decoupled
 * so that locations in polar night correctly report civil, nautical, or astronomical twilight
 * or night according to instantaneous solar elevation.
 */
export function classifySolarPhase(geometricElevationDeg: number): SolarPhase {
  if (geometricElevationDeg >= DIRECT_SUNLIGHT_THRESHOLD_DEG) {
    return 'day';
  }
  if (geometricElevationDeg >= CIVIL_TWILIGHT_ELEVATION_DEG) {
    return 'civil_twilight';
  }
  if (geometricElevationDeg >= NAUTICAL_TWILIGHT_ELEVATION_DEG) {
    return 'nautical_twilight';
  }
  if (geometricElevationDeg >= ASTRONOMICAL_TWILIGHT_ELEVATION_DEG) {
    return 'astronomical_twilight';
  }
  return 'night';
}

