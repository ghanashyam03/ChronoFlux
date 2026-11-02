/**
 * @file types.ts
 * Type definitions for the astronomical solar model.
 */

import { Instant } from '../../primitives/instant.js';
import { Place } from '../../primitives/place.js';

/**
 * Solar illumination and twilight regimes.
 *
 * Astronomical Conventions (Harmonized to Geometric Solar Elevation h_geom):
 * - 'day': Direct sunlight, geometric elevation h_geom >= -0.8333° (apparent upper limb above horizon)
 * - 'civil_twilight': [-6.0°, -0.8333°)
 * - 'nautical_twilight': [-12.0°, -6.0°)
 * - 'astronomical_twilight': [-18.0°, -12.0°)
 * - 'night': < -18.0°
 * - 'polar_day': Perpetual daylight (Midnight Sun) where diurnal minimum h_geom >= -0.8333°
 * - 'polar_night': Perpetual darkness where diurnal maximum h_geom < -0.8333°
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
 * Granular breakdown of coordinate, atmospheric, and dynamic event-time uncertainties.
 */
export interface SolarUncertaintyDetails {
  /**
   * Ephemeris / numerical algorithm coordinate error in degrees (Meeus truncated series: ±0.01° for 1800-2100 CE).
   */
  readonly numericalErrorDeg: number;

  /**
   * Refraction model uncertainty in degrees based on atmospheric temperature/pressure variability
   * (±0.05° near horizon, diminishing at high elevations).
   */
  readonly atmosphericRefractionUncertaintyDeg: number;

  /**
   * Combined root-sum-square coordinate uncertainty in degrees: sqrt(numerical^2 + refraction^2).
   */
  readonly combinedCoordinateUncertaintyDeg: number;

  /**
   * Dynamic event-time uncertainty in minutes: Delta t = Delta h_geom / |dh/dt|.
   * Dynamically expands near tangential threshold crossings or high latitudes where |dh/dt| -> 0.
   */
  readonly eventTimeUncertaintyMinutes: number;

  /**
   * Horizon limitation dip in degrees due to observer height above sea level: 0.0293 * sqrt(elevationMeters).
   */
  readonly horizonLimitationDeg: number;
}

/**
 * Instantaneous solar position without diurnal cycle event overhead.
 */
export interface InstantaneousSolarPosition {
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
   * Null when azimuth is mathematically indeterminate (e.g. at zenith/nadir or geographic poles).
   */
  readonly azimuthDeg: number | null;

  /**
   * True if solar azimuth is mathematically indeterminate (|latitude| = 90° or zenith angle <= 1e-5°).
   */
  readonly isAzimuthIndeterminate: boolean;

  /**
   * Apparent solar zenith angle in degrees [0, 180], equal to 90° - elevationDeg.
   */
  readonly zenithDeg: number;

  /**
   * Current solar phase or twilight classification based on geometric solar elevation.
   */
  readonly phase: SolarPhase;

  /**
   * Whether direct sunlight is present (geometricElevationDeg >= -0.8333°).
   */
  readonly isDirectSunlight: boolean;

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
   * Combined coordinate uncertainty in degrees.
   */
  readonly uncertaintyDeg: number;

  /**
   * Dynamic event-time uncertainty in minutes (Delta h / |dh/dt|).
   */
  readonly uncertaintyMinutes: number;

  /**
   * Granular uncertainty decomposition.
   */
  readonly uncertainty: SolarUncertaintyDetails;
}

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
   * Null when azimuth is mathematically indeterminate (e.g. at zenith/nadir or geographic poles).
   */
  readonly azimuthDeg: number | null;

  /**
   * True if solar azimuth is mathematically indeterminate (|latitude| = 90° or zenith angle <= 1e-5°).
   */
  readonly isAzimuthIndeterminate: boolean;

  /**
   * Apparent solar zenith angle in degrees [0, 180], equal to 90° - elevationDeg.
   */
  readonly zenithDeg: number;

  /**
   * Current solar phase or twilight classification based on geometric solar elevation.
   */
  readonly phase: SolarPhase;

  /**
   * Whether direct sunlight is present (geometricElevationDeg >= -0.8333°).
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
   * Combined coordinate uncertainty in degrees.
   */
  readonly uncertaintyDeg: number;

  /**
   * Dynamic event-time uncertainty in minutes (Delta h / |dh/dt|).
   */
  readonly uncertaintyMinutes: number;

  /**
   * Granular uncertainty decomposition.
   */
  readonly uncertainty: SolarUncertaintyDetails;
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
  | 'civilDusk'
  | 'nauticalDawn'
  | 'nauticalDusk'
  | 'astronomicalDawn'
  | 'astronomicalDusk';

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
