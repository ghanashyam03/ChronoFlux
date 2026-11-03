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
 * - 'day': Direct sunlight, geometric elevation h_geom >= -0.8333° - d_dip (apparent upper limb above horizon)
 * - 'civil_twilight': [-6.0° - d_dip, -0.8333° - d_dip)
 * - 'nautical_twilight': [-12.0° - d_dip, -6.0° - d_dip)
 * - 'astronomical_twilight': [-18.0° - d_dip, -12.0° - d_dip)
 * - 'night': < -18.0° - d_dip
 *
 * Elevation Horizon Dip:
 * When observer orthometric elevation > 0m, the effective horizon threshold is depressed by
 * d_dip = (1.76 / 60) * sqrt(elevationMeters) degrees. For sea level (elevationMeters = 0 or undefined), d_dip = 0.
 */
export type SolarPhase =
  | 'day'
  | 'civil_twilight'
  | 'nautical_twilight'
  | 'astronomical_twilight'
  | 'night';

/**
 * Diurnal polar regime tracking whether the location experiences midnight sun, polar night, or normal diurnal cycle.
 * Evaluated relative to the elevation-adjusted horizon dip threshold theta_eff = -0.8333° - d_dip.
 * Evaluated independently from instantaneous solar illumination phase.
 */
export type PolarRegimeType = 'none' | 'polar_day' | 'polar_night';

/**
 * Condition of solar elevation threshold crossing based on rate of elevation change |dh/dt|:
 * - 'well_conditioned': Rapid or steady crossing (|dh/dt| >= 1e-5°/s, or steady polar equinox seasonal crossings).
 * - 'grazing': Near-tangential crossing where the solar elevation reaches a diurnal/seasonal extremum near the threshold.
 * - 'ill_conditioned': Extremely flat crossing where rate of elevation change is degenerate (|dh/dt| < 1e-7°/s).
 */
export type CrossingCondition = 'ill_conditioned' | 'grazing' | 'well_conditioned';

/**
 * Granular breakdown of coordinate, atmospheric, time-scale, and dynamic event-time uncertainties.
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
   * Propagated astronomical time-scale provider uncertainty in degrees, derived from provider Delta T and DUT1 uncertainties.
   * Delta T uncertainty affects ephemeris orbital longitude (TT); DUT1 uncertainty affects Earth rotation angle (UT1).
   */
  readonly timeScaleUncertaintyDeg: number;

  /**
   * Combined root-sum-square instantaneous angular uncertainty in degrees:
   * Delta h(t) = sqrt(numericalErrorDeg^2 + atmosphericRefractionUncertaintyDeg^2 + timeScaleUncertaintyDeg^2).
   * Semantics: Instantaneous coordinate error bound.
   */
  readonly combinedCoordinateUncertaintyDeg: number;

  /**
   * Instantaneous threshold crossing sensitivity |dh/dt| in degrees per minute at the evaluated instant,
   * accounting for both diurnal Earth rotation and seasonal solar declination change.
   * Semantics: Rate of solar elevation change with respect to time.
   */
  readonly crossingSensitivityDegPerMin: number;

  /**
   * Dynamic threshold-crossing time uncertainty in minutes: Delta t = Delta h / |dh/dt|.
   * Evaluated dynamically from full-model derivative. For grazing or ill-conditioned crossings,
   * governed by threshold curvature or safe limit bounds.
   * Semantics: Sensitivity of crossing an elevation threshold at the evaluated instant's rate.
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
   * Horizon limitation dip in degrees due to observer orthometric elevation above mean sea level:
   * d_dip = (1.76 / 60) * sqrt(max(0, elevationMeters)).
   * Semantics: Geometric horizon depression for an unobstructed sea-level horizon.
   */
  readonly horizonLimitationDeg: number;

  /**
   * Crossing condition classification for the event or evaluated instant.
   */
  readonly crossingCondition?: CrossingCondition | undefined;
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
   * Current solar phase or twilight classification based on geometric solar elevation,
   * adjusted for observer orthometric elevation horizon dip (-0.8333° - d_dip).
   */
  readonly phase: SolarPhase;

  /**
   * Whether the evaluated instant lies within the verified validity range (1800-01-01 to 2100-12-31 CE).
   */
  readonly isWithinValidityRange: boolean;

  /**
   * True if accuracy is degraded because the instant lies outside the model's verified 1800-2100 CE range
   * (assumed numerical error ±0.01°, empirical accuracy < 0.02°).
   */
  readonly isAccuracyDegraded: boolean;

  /**
   * Whether direct sunlight is present (geometricElevationDeg >= -0.8333° - d_dip).
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
   * Current solar phase or twilight classification based on geometric solar elevation,
   * adjusted for observer orthometric elevation horizon dip (-0.8333° - d_dip).
   */
  readonly phase: SolarPhase;

  /**
   * Whether direct sunlight is present (geometricElevationDeg >= -0.8333° - d_dip).
   */
  readonly isDirectSunlight: boolean;

  /**
   * Independent polar regime classification for this diurnal cycle ('none' | 'polar_day' | 'polar_night'),
   * evaluated relative to the elevation-adjusted threshold theta_eff = -0.8333° - d_dip.
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
   * True if accuracy is degraded because the instant lies outside the model's verified 1800-2100 CE range
   * (assumed numerical error ±0.01°, empirical accuracy < 0.02°).
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
  readonly crossingCondition?: CrossingCondition | undefined;

  constructor(
    epochNanoseconds: bigint,
    metadata: {
      event: SolarEventName;
      isWithinValidityRange: boolean;
      isAccuracyDegraded: boolean;
      uncertaintyDeg: number;
      uncertaintyMinutes: number;
      uncertainty: SolarUncertaintyDetails;
      crossingCondition?: CrossingCondition | undefined;
    }
  ) {
    super(epochNanoseconds);
    this.event = metadata.event;
    this.isWithinValidityRange = metadata.isWithinValidityRange;
    this.isAccuracyDegraded = metadata.isAccuracyDegraded;
    this.uncertaintyDeg = metadata.uncertaintyDeg;
    this.uncertainty = metadata.uncertainty;
    this.uncertaintyMinutes =
      metadata.uncertainty !== undefined
        ? metadata.uncertainty.eventTimeUncertaintyMinutes
        : metadata.uncertaintyMinutes;
    this.crossingCondition = metadata.crossingCondition ?? metadata.uncertainty.crossingCondition;
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
  readonly crossingCondition?: CrossingCondition | undefined;

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
      crossingCondition?: CrossingCondition | undefined;
    }
  ) {
    super(epochNanoseconds);
    this.thresholdDeg = metadata.thresholdDeg;
    this.direction = metadata.direction;
    this.isWithinValidityRange = metadata.isWithinValidityRange;
    this.isAccuracyDegraded = metadata.isAccuracyDegraded;
    this.uncertaintyDeg = metadata.uncertaintyDeg;
    this.uncertainty = metadata.uncertainty;
    this.uncertaintyMinutes =
      metadata.uncertainty !== undefined
        ? metadata.uncertainty.eventTimeUncertaintyMinutes
        : metadata.uncertaintyMinutes;
    this.crossingCondition = metadata.crossingCondition ?? metadata.uncertainty.crossingCondition;
    Object.freeze(this);
  }
}

