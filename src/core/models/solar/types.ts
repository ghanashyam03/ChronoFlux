/**
 * @file types.ts
 * Type definitions for the astronomical solar model.
 */

import { Instant } from '../../primitives/instant.js';
import { Place } from '../../primitives/place.js';

/**
 * Solar illumination and twilight regimes.
 *
 * - 'day': Direct sunlight, elevation >= -0.833°
 * - 'civil_twilight': [-6.0°, -0.833°)
 * - 'nautical_twilight': [-12.0°, -6.0°)
 * - 'astronomical_twilight': [-18.0°, -12.0°)
 * - 'night': < -18.0°
 * - 'polar_day': Perpetual daylight (Midnight Sun) where elevation never drops below -0.833°
 * - 'polar_night': Perpetual darkness where elevation never reaches -0.833°
 */
export type SolarPhase =
  | 'day'
  | 'civil_twilight'
  | 'nautical_twilight'
  | 'astronomical_twilight'
  | 'night'
  | 'polar_day'
  | 'polar_night';

/**
 * Comprehensive solar state evaluated at a specific Instant and Place.
 */
export interface SolarState {
  /**
   * Apparent solar elevation above horizon in degrees [-90, +90], corrected for atmospheric refraction.
   */
  readonly elevationDeg: number;

  /**
   * True geometric solar elevation above horizon in degrees [-90, +90] without atmospheric refraction.
   */
  readonly geometricElevationDeg: number;

  /**
   * Solar azimuth in degrees clockwise from true North [0, 360).
   * 0° = North, 90° = East, 180° = South, 270° = West.
   */
  readonly azimuthDeg: number;

  /**
   * Apparent solar zenith angle in degrees [0, 180], equal to 90° - elevationDeg.
   */
  readonly zenithDeg: number;

  /**
   * Current solar phase or twilight classification.
   */
  readonly phase: SolarPhase;

  /**
   * Whether direct sunlight is present (elevationDeg >= -0.833°).
   */
  readonly isDirectSunlight: boolean;

  /**
   * Whether the location is experiencing Polar Day (Midnight Sun) on this diurnal cycle.
   */
  readonly isPolarDay: boolean;

  /**
   * Whether the location is experiencing Polar Night on this diurnal cycle.
   */
  readonly isPolarNight: boolean;

  /**
   * Transit instant (solar noon) when the Sun reaches diurnal maximum elevation.
   */
  readonly solarNoon: Instant;

  /**
   * Nadir instant (solar midnight) when the Sun reaches diurnal minimum elevation.
   */
  readonly solarMidnight: Instant;

  /**
   * Sunrise instant for the diurnal cycle, or null if in polar day or polar night.
   */
  readonly sunrise: Instant | null;

  /**
   * Sunset instant for the diurnal cycle, or null if in polar day or polar night.
   */
  readonly sunset: Instant | null;

  /**
   * Solar declination in degrees [-23.45°, +23.45°].
   */
  readonly declinationDeg: number;

  /**
   * Solar Right Ascension in degrees [0, 360).
   */
  readonly rightAscensionDeg: number;

  /**
   * Equation of Time in minutes.
   */
  readonly equationOfTimeMinutes: number;

  /**
   * Solar hour angle in degrees [-180°, +180°]. 0° = solar noon, negative = morning, positive = afternoon.
   */
  readonly hourAngleDeg: number;

  /**
   * True Solar Time in minutes [0, 1440).
   */
  readonly trueSolarTimeMinutes: number;

  /**
   * Atmospheric refraction correction in degrees added to geometric elevation.
   */
  readonly atmosphericRefractionDeg: number;

  /**
   * Theoretical model uncertainty in degrees (±0.01° for 1800-2100 CE).
   */
  readonly uncertaintyDeg: number;

  /**
   * Theoretical model uncertainty in minutes of time (±0.04 minutes / ~2.4 seconds).
   */
  readonly uncertaintyMinutes: number;
}

/**
 * Recognized solar event names for discrete event finding.
 */
export type SolarEventName =
  | 'sunrise'
  | 'sunset'
  | 'solarNoon'
  | 'solarMidnight'
  | 'civilDawn'
  | 'civilDusk';

/**
 * Options for querying the next solar event.
 */
export interface SolarEventOptions {
  /**
   * The solar event to search for.
   */
  readonly event: SolarEventName;

  /**
   * Target geographic location on the WGS84 ellipsoid.
   */
  readonly place: Place;

  /**
   * Instant strictly after which to find the next event.
   */
  readonly after: Instant;

  /**
   * Maximum search window in days (default: 365 days).
   */
  readonly searchLimitDays?: number;
}
