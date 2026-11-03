/**
 * @file timescale.ts
 * Astronomical Time-Scale Specifications and Conversions.
 *
 * Defines the relationship between:
 * 1. ChronoFlux Instant: POSIX / Unix epoch elapsed SI nanoseconds since 1970-01-01T00:00:00Z.
 *    Assumes exactly 86,400 SI seconds per civil calendar day (leap-second free).
 * 2. UTC (Coordinated Universal Time): Civil broadcast time scale based on SI seconds,
 *    periodically synchronized to Earth's rotation via leap seconds (|UTC - UT1| < 0.9s).
 * 3. UT1 (Universal Time 1): Non-uniform time scale directly proportional to the Earth's
 *    rotation angle (ERA). Governs local diurnal solar timing (solar noon, hour angle, azimuth).
 * 4. TAI (International Atomic Time): Continuous atomic time scale since 1958.
 * 5. TT (Terrestrial Time): Uniform dynamical ephemeris time scale used for planetary orbital
 *    ephemerides (Meeus solar tables): TT = TAI + 32.184s.
 * 6. Delta T (ΔT = TT - UT1): The slowly varying accumulated difference caused by tidal
 *    friction braking of Earth's rotation and core-mantle angular momentum transfer.
 *
 * Present Model Assumptions & Limitations:
 * In practical civil and low-to-medium accuracy solar calculations (Jean Meeus / NOAA),
 * Julian Centuries relative to J2000.0 (T) are evaluated directly from Unix time (UTC proxy).
 * The resulting angular discrepancy Δθ ≈ ΔT * (15 arcsec/sec) is ~0.0003° (1.05 arcsec)
 * for ΔT ~ 70s, which is well below the model's ±0.01° declared ephemeris precision bound.
 *
 * This module provides an extensible conversion interface for future sub-arcsecond
 * high-accuracy astronomical models (e.g. VSOP87, JPL DE440).
 */

import { Instant } from '../../primitives/instant.js';
import { instantToJulianDay, julianDayToJulianCentury } from './math.js';

/**
 * Pluggable interface for astronomical time-scale conversions.
 */
export interface AstronomicalTimeScale {
  /**
   * Calculates or approximates Delta T (ΔT = TT - UT1) in seconds for the given instant.
   */
  getDeltaT(instant: Instant): number;

  /**
   * Converts an Instant to Terrestrial Time (TT) expressed as a fractional Julian Day.
   */
  toTerrestrialJulianDay(instant: Instant): number;

  /**
   * Converts an Instant to Universal Time (UT1) expressed as a fractional Julian Day.
   */
  toUt1JulianDay(instant: Instant): number;

  /**
   * Converts an Instant to Julian Century (T_TT) relative to J2000.0 on the Terrestrial Time scale.
   */
  toTerrestrialJulianCentury(instant: Instant): number;
}

/**
 * Standard polynomial implementation of Delta T based on Espenak & Meeus (NASA TP-2006-214141).
 * Valid across historical and modern eras (-500 to +2150 CE).
 */
export class StandardAstronomicalTimeScale implements AstronomicalTimeScale {
  /**
   * Computes Delta T in seconds using piecewise polynomial approximations
   * (Espenak & Meeus 2006).
   */
  getDeltaT(instant: Instant): number {
    const epochMs = Number(instant.epochNanoseconds / 1_000_000n);
    const date = new Date(epochMs);
    const year = date.getUTCFullYear() + (date.getUTCMonth() + date.getUTCDate() / 30.0) / 12.0;

    if (year < 948) {
      const u = (year - 2000) / 100.0;
      return 2177 + 497 * u + 44.1 * u * u;
    } else if (year < 1600) {
      const u = (year - 1000) / 100.0;
      return (
        1574.2 -
        564.4 * u -
        879.848 * u * u +
        231.4424 * Math.pow(u, 3) +
        71.0735 * Math.pow(u, 4) -
        3.5623 * Math.pow(u, 5) -
        0.8387 * Math.pow(u, 6)
      );
    } else if (year < 1700) {
      const t = year - 1600;
      return 120 - 0.9808 * t - 0.01532 * t * t + Math.pow(t, 3) / 7129.0;
    } else if (year < 1800) {
      const t = year - 1700;
      return (
        8.83 +
        0.1603 * t -
        0.0059285 * t * t +
        0.00013336 * Math.pow(t, 3) -
        Math.pow(t, 4) / 1_174_000.0
      );
    } else if (year < 1860) {
      const t = year - 1800;
      return (
        13.72 -
        0.332447 * t +
        0.0068612 * t * t +
        0.0041116 * Math.pow(t, 3) -
        0.00037436 * Math.pow(t, 4) +
        0.0000121272 * Math.pow(t, 5) -
        0.0000001699 * Math.pow(t, 6) +
        0.000000000875 * Math.pow(t, 7)
      );
    } else if (year < 1900) {
      const t = year - 1860;
      return (
        7.62 +
        0.5737 * t -
        0.251754 * t * t +
        0.01680668 * Math.pow(t, 3) -
        0.0004473624 * Math.pow(t, 4) +
        Math.pow(t, 5) / 233174.0
      );
    } else if (year < 1920) {
      const t = year - 1900;
      return -2.79 + 1.494119 * t - 0.0598939 * t * t + 0.0061966 * Math.pow(t, 3) - 0.000197 * Math.pow(t, 4);
    } else if (year < 1941) {
      const t = year - 1920;
      return 21.2 + 0.84493 * t - 0.076100 * t * t + 0.0020936 * Math.pow(t, 3);
    } else if (year < 1961) {
      const t = year - 1950;
      return 29.07 + 0.407 * t - Math.pow(t, 2) / 233.0 + Math.pow(t, 3) / 2547.0;
    } else if (year < 1986) {
      const t = year - 1975;
      return 45.45 + 1.067 * t - Math.pow(t, 2) / 260.0 - Math.pow(t, 3) / 718.0;
    } else if (year < 2005) {
      const t = year - 2000;
      return (
        63.86 +
        0.3345 * t -
        0.060374 * t * t +
        0.0017275 * Math.pow(t, 3) +
        0.000651814 * Math.pow(t, 4) +
        0.00002373599 * Math.pow(t, 5)
      );
    } else if (year < 2050) {
      const t = year - 2000;
      return 62.92 + 0.32217 * t + 0.005589 * t * t;
    } else if (year < 2150) {
      return (
        -20 +
        32 * Math.pow((year - 1820) / 100.0, 2) -
        0.5628 * (2150 - year)
      );
    } else {
      const u = (year - 1820) / 100.0;
      return -20 + 32 * u * u;
    }
  }

  /**
   * Converts an Instant to Terrestrial Time (TT) Julian Day.
   */
  toTerrestrialJulianDay(instant: Instant): number {
    const jdUt = instantToJulianDay(instant);
    const deltaTSec = this.getDeltaT(instant);
    return jdUt + deltaTSec / 86400.0;
  }

  /**
   * Converts an Instant to Universal Time (UT1) Julian Day.
   * Under standard civil approximation, UT1 ≈ UTC.
   */
  toUt1JulianDay(instant: Instant): number {
    return instantToJulianDay(instant);
  }

  /**
   * Converts an Instant to Julian Century (T_TT) relative to J2000.0 on the Terrestrial Time scale.
   */
  toTerrestrialJulianCentury(instant: Instant): number {
    return julianDayToJulianCentury(this.toTerrestrialJulianDay(instant));
  }
}

export const standardAstronomicalTimeScale = Object.freeze(new StandardAstronomicalTimeScale());

let registeredTimeScale: AstronomicalTimeScale = standardAstronomicalTimeScale;

/**
 * Registers an active astronomical time scale provider.
 */
export function registerAstronomicalTimeScale(provider: AstronomicalTimeScale | null): void {
  registeredTimeScale = provider ?? standardAstronomicalTimeScale;
}

/**
 * Gets the current active astronomical time scale provider.
 */
export function getAstronomicalTimeScale(): AstronomicalTimeScale {
  return registeredTimeScale;
}
