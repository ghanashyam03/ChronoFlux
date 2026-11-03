/**
 * @file types.ts
 * Type definitions for the astronomical solar model.
 */

import { Instant } from '../../primitives/instant.js';
import { Place } from '../../primitives/place.js';

/**
 * Solar illumination and twilight regimes based strictly on instantaneous geometric solar elevation.
 *
 * Astronomical Conventions (Harmonized to Geometric Solar Elevation h_geom):
 * - 'day': Direct sunlight, geometric elevation h_geom >= -0.8333° (apparent upper limb above horizon)
 * - 'civil_twilight': [-6.0°, -0.8333°)
 * - 'nautical_twilight': [-12.0°, -6.0°)
 * - 'astronomical_twilight': [-18.0°, -12.0°)
 * - 'night': < -18.0°
 */
export type SolarPhase =
  | 'day'
  | 'civil_twilight'
  | 'nautical_twilight'
  | 'astronomical_twilight'
  | 'night';

/**
 * Diurnal polar regime tracking whether the location experiences midnight sun, polar night, or normal diurnal cycle.
 * Evaluated independently from instantaneous solar illumination phase.
 */
export type PolarRegimeType = 'none' | 'polar_day' | 'polar_night';

/**
 * Granular breakdown of coordinate, atmospheric, and dynamic event-time uncertainties.
 */
export interface SolarUncertaintyDetails {
  /**
   * Assumed ephemeris / numerical algorithm coordinate error in degrees (Meeus truncated series: ±0.01° for 1800-2100 CE).
   * Semantics: Assumed theoretical accuracy bound of truncated analytical ephemeris.
   */
  readonly numericalErrorDeg: number;

  /**
   * Calculated atmospheric refraction model uncertainty in degrees based on atmospheric temperature/pressure variability
   * (~12% of refraction at nominal 1010 mbar, 10°C; diminishing at high elevations).
   * Semantics: Calculated from current solar elevation and nominal refraction model.
   */
  readonly atmosphericRefractionUncertaintyDeg: number;

  /**
   * Combined root-sum-square instantaneous angular uncertainty in degrees:
   * Delta h(t) = sqrt(numericalErrorDeg^2 + atmosphericRefractionUncertaintyDeg^2).
   * Semantics: Instantaneous coordinate error bound.
   */
  readonly combinedCoordinateUncertaintyDeg: number;

  /**
   * Instantaneous threshold crossing sensitivity |dh/dt| in degrees per minute at the evaluated instant:
   * dh/dt = -cos(phi)*cos(delta)*sin(H) * (0.25 deg/min) / cos(h).
   * Semantics: Rate of solar elevation change with respect to time.
   */
  readonly crossingSensitivityDegPerMin: number;

  /**
   * Dynamic threshold-crossing time uncertainty in minutes: Delta t = Delta h / |dh/dt|.
   * Dynamically expands near diurnal stationary points (noon/midnight) or high latitudes where |dh/dt| -> 0.
   * Semantics: Sensitivity of crossing an arbitrary elevation threshold at the evaluated instant's rate.
   */
  readonly eventTimeUncertaintyMinutes: number;

  /**
   * Predicted event-time uncertainty in minutes evaluated at the actual sunrise crossing instant:
   * Delta t_sunrise = Delta h_horizon / |dh/dt|_{sunrise}.
   * Null if sunrise does not occur on this diurnal cycle (e.g. polar day/night) or if not evaluated.
   * Semantics: Physical event-crossing accuracy at sunrise.
   */
  readonly sunriseUncertaintyMinutes: number | null;

  /**
   * Predicted event-time uncertainty in minutes evaluated at the actual sunset crossing instant:
   * Delta t_sunset = Delta h_horizon / |dh/dt|_{sunset}.
   * Null if sunset does not occur on this diurnal cycle (e.g. polar day/night) or if not evaluated.
   * Semantics: Physical event-crossing accuracy at sunset.
   */
  readonly sunsetUncertaintyMinutes: number | null;

  /**
   * Horizon limitation dip in degrees due to observer height above sea level: 0.0293 * sqrt(elevationMeters).
   * Semantics: Geometric horizon depression dependent on external elevation measurement.
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
   * Whether the evaluated instant lies within the verified validity range (1800-01-01 to 2100-12-31 CE).
   */
  readonly isWithinValidityRange: boolean;

  /**
   * True if accuracy guarantees (±0.01°) are degraded because the instant lies outside the model's verified range.
   */
  readonly isAccuracyDegraded: boolean;

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
   * Independent polar regime classification for this diurnal cycle ('none' | 'polar_day' | 'polar_night').
   */
  readonly polarRegime: PolarRegimeType;

  /**
   * Whether the location is experiencing Polar Day (Midnight Sun) on this diurnal cycle.
   */
  readonly isPolarDay: boolean;

  /**
   * Whether the location is experiencing Polar Night on this diurnal cycle.
   */
  readonly isPolarNight: boolean;

  /**
   * Whether the evaluated instant lies within the verified validity range (1800-01-01 to 2100-12-31 CE).
   */
  readonly isWithinValidityRange: boolean;

  /**
   * True if accuracy guarantees (±0.01°) are degraded because the instant lies outside the model's verified range.
   */
  readonly isAccuracyDegraded: boolean;

  /**
   * Transit instant (solar noon) when the Sun reaches diurnal maximum elevation.
   */
  readonly solarNoon: SolarEventInstant;

  /**
   * Nadir instant (solar midnight) when the Sun reaches diurnal minimum elevation.
   */
  readonly solarMidnight: SolarEventInstant;

  /**
   * Sunrise instant for the diurnal cycle, or null if in polar day or polar night.
   */
  readonly sunrise: SolarEventInstant | null;

  /**
   * Sunset instant for the diurnal cycle, or null if in polar day or polar night.
   */
  readonly sunset: SolarEventInstant | null;

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

/**
 * High-precision solar event Instant preserving validity and accuracy metadata.
 * Extends Instant so that callers may treat it as a standard Instant or inspect
 * event-specific accuracy and validity attributes.
 */
export class SolarEventInstant extends Instant {
  readonly event: SolarEventName;
  readonly isWithinValidityRange: boolean;
  readonly isAccuracyDegraded: boolean;
  readonly uncertaintyDeg: number;
  readonly uncertaintyMinutes: number;
  readonly uncertainty: SolarUncertaintyDetails;

  constructor(
    epochNanoseconds: bigint,
    metadata: {
      event: SolarEventName;
      isWithinValidityRange: boolean;
      isAccuracyDegraded: boolean;
      uncertaintyDeg: number;
      uncertaintyMinutes: number;
      uncertainty: SolarUncertaintyDetails;
    }
  ) {
    super(epochNanoseconds);
    this.event = metadata.event;
    this.isWithinValidityRange = metadata.isWithinValidityRange;
    this.isAccuracyDegraded = metadata.isAccuracyDegraded;
    this.uncertaintyDeg = metadata.uncertaintyDeg;
    this.uncertaintyMinutes = metadata.uncertaintyMinutes;
    this.uncertainty = metadata.uncertainty;
    Object.freeze(this);
  }
}

/**
 * High-precision threshold transition Instant preserving threshold angle,
 * direction ('rising' | 'setting'), validity, and accuracy metadata.
 * Extends Instant so that callers may treat it as a standard Instant.
 */
export class SolarTransitionInstant extends Instant {
  readonly thresholdDeg: number;
  readonly direction: 'rising' | 'setting';
  readonly isWithinValidityRange: boolean;
  readonly isAccuracyDegraded: boolean;
  readonly uncertaintyDeg: number;
  readonly uncertaintyMinutes: number;
  readonly uncertainty: SolarUncertaintyDetails;

  constructor(
    epochNanoseconds: bigint,
    metadata: {
      thresholdDeg: number;
      direction: 'rising' | 'setting';
      isWithinValidityRange: boolean;
      isAccuracyDegraded: boolean;
      uncertaintyDeg: number;
      uncertaintyMinutes: number;
      uncertainty: SolarUncertaintyDetails;
    }
  ) {
    super(epochNanoseconds);
    this.thresholdDeg = metadata.thresholdDeg;
    this.direction = metadata.direction;
    this.isWithinValidityRange = metadata.isWithinValidityRange;
    this.isAccuracyDegraded = metadata.isAccuracyDegraded;
    this.uncertaintyDeg = metadata.uncertaintyDeg;
    this.uncertaintyMinutes = metadata.uncertaintyMinutes;
    this.uncertainty = metadata.uncertainty;
    Object.freeze(this);
  }
}

