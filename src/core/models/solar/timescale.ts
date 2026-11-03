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
 * 1. Diurnal Earth rotation rate: omega_diurnal = 360° / 86400s = 15 arcsec/s ≈ 0.004167°/s.
 *    Tied to UT1 (Universal Time 1), governing Earth rotation angle, hour angle, solar noon, and azimuth.
 *    DUT1 = UT1 - UTC. Under standard civil broadcast time, |DUT1| < 0.9s via leap seconds.
 * 2. Planetary orbital motion rate: omega_orbit ≈ 360° / (365.25 * 86400s) ≈ 0.041 arcsec/s.
 *    Tied to TT (Terrestrial Time), governing ephemeris orbital longitude, mean anomaly, and solar declination.
 *    Delta T = TT - UT1. Accumulated difference from Earth's tidal braking.
 *    Delta T_(TT-UTC) = TT - UTC = (TT - UT1) + (UT1 - UTC) = Delta T + DUT1.
 * 3. Angular Discrepancy Analysis:
 *    For Delta T ≈ 70s, the orbital ephemeris discrepancy on TT is ~70 * 0.041" ≈ 2.87 arcsec ≈ 0.0008°,
 *    well within the model's ±0.01° declared ephemeris precision bound.
 *    However, a 1-second offset on UT1 (DUT1) produces a full 15 arcsec (0.004167°) diurnal shift.
 *
 * This module provides an active, pluggable time-scale provider interface integrating TT into
 * solar ephemeris calculations and UT1 into diurnal rotation and True Solar Time.
 */

import { Instant } from '../../primitives/instant.js';
import { Interval } from '../../primitives/interval.js';
import { instantToJulianDay, julianDayToJulianCentury } from './math.js';

/**
 * Metadata describing an astronomical time-scale provider's source, validity, and input uncertainties.
 */
export interface TimeScaleMetadata {
  /**
   * Provenance of the astronomical time-scale data (e.g. 'NASA TP-2006-214141', 'IERS Bulletin A').
   */
  readonly source: string;

  /**
   * Explanatory notes or description of the provider.
   */
  readonly description: string;

  /**
   * Validity range of the time-scale model if known.
   */
  readonly validityRange?: Interval | undefined;

  /**
   * Estimated uncertainty of Delta T (TT - UT1) in seconds.
   */
  readonly deltaTUncertaintySeconds: number;

  /**
   * Estimated uncertainty of DUT1 (UT1 - UTC) in seconds.
   * Documented as an approximation when using civil broadcast leap-second bounds (|DUT1| < 0.9s).
   */
  readonly dut1UncertaintySeconds: number;

  /**
   * Whether DUT1 is an approximation (e.g. nominal 0.0s) rather than an observed/measured value.
   */
  readonly isDut1Approximation: boolean;
}

/**
 * Pluggable interface for astronomical time-scale conversions.
 */
export interface AstronomicalTimeScale {
  /**
   * Optional metadata describing provider provenance, validity, and input uncertainty.
   */
  readonly metadata?: TimeScaleMetadata | undefined;

  /**
   * Calculates or approximates Delta T (ΔT = TT - UT1) in seconds for the given instant.
   */
  getDeltaT(instant: Instant): number;

  /**
   * Optional canonical alias for getDeltaT returning seconds.
   */
  getDeltaTSeconds?(instant: Instant): number;

  /**
   * Converts an Instant to Terrestrial Time (TT) expressed as a fractional Julian Day:
   * JD_TT = JD_UTC + (Delta T + DUT1) / 86400.0.
   */
  toTerrestrialJulianDay(instant: Instant): number;

  /**
   * Converts an Instant to Universal Time (UT1) expressed as a fractional Julian Day:
   * JD_UT1 = JD_UTC + DUT1 / 86400.0.
   */
  toUt1JulianDay(instant: Instant): number;

  /**
   * Converts an Instant to Julian Century (T_TT) relative to J2000.0 on the Terrestrial Time scale.
   */
  toTerrestrialJulianCentury(instant: Instant): number;

  /**
   * Returns DUT1 (UT1 - UTC) in seconds.
   * If omitted, derived from toUt1JulianDay(instant) - instantToJulianDay(instant).
   */
  getDut1?(instant: Instant): number;

  /**
   * Optional canonical alias for getDut1 returning seconds.
   */
  getDut1Seconds?(instant: Instant): number;

  /**
   * Optional method returning granular input uncertainties in seconds.
   */
  getUncertainty?(instant: Instant): { deltaTUncertaintySeconds: number; dut1UncertaintySeconds: number };
}

/**
 * Abstract canonical base class for astronomical time scale providers.
 * Eliminates contradictory sources of truth by canonically deriving dependent
 * Julian Day and Century values from getDeltaT and getDut1.
 */
export abstract class BaseAstronomicalTimeScale implements AstronomicalTimeScale {
  abstract readonly metadata?: TimeScaleMetadata | undefined;

  abstract getDeltaT(instant: Instant): number;

  getDeltaTSeconds(instant: Instant): number {
    return this.getDeltaT(instant);
  }

  getDut1(instant: Instant): number {
    if (this.getDut1Seconds) {
      return this.getDut1Seconds(instant);
    }
    return 0.0;
  }

  getDut1Seconds(instant: Instant): number {
    return this.getDut1(instant);
  }

  toTerrestrialJulianDay(instant: Instant): number {
    const jdUt = instantToJulianDay(instant);
    const deltaTSec = this.getDeltaT(instant);
    const dut1Sec = this.getDut1(instant);
    return jdUt + (deltaTSec + dut1Sec) / 86400.0;
  }

  toUt1JulianDay(instant: Instant): number {
    const jdUt = instantToJulianDay(instant);
    const dut1Sec = this.getDut1(instant);
    return jdUt + dut1Sec / 86400.0;
  }

  toTerrestrialJulianCentury(instant: Instant): number {
    return julianDayToJulianCentury(this.toTerrestrialJulianDay(instant));
  }

  getUncertainty(_instant: Instant): { deltaTUncertaintySeconds: number; dut1UncertaintySeconds: number } {
    return {
      deltaTUncertaintySeconds: this.metadata?.deltaTUncertaintySeconds ?? 1.0,
      dut1UncertaintySeconds: this.metadata?.dut1UncertaintySeconds ?? 0.9,
    };
  }
}

/**
 * Standard polynomial implementation of Delta T based on Espenak & Meeus (NASA TP-2006-214141).
 * Valid across historical and modern eras (-500 to +2150 CE).
 *
 * NOTE: Standard civil broadcast DUT1 = 0.0s is an operational approximation (|DUT1| < 0.9s via leap seconds),
 * not an observed astronomical measurement.
 */
export class StandardAstronomicalTimeScale extends BaseAstronomicalTimeScale {
  readonly metadata: TimeScaleMetadata = Object.freeze({
    source: 'Espenak & Meeus (NASA TP-2006-214141)',
    description:
      'Piecewise polynomial approximation of Delta T (TT - UT1). DUT1 is approximated as 0.0s under civil broadcast leap-second tolerance (|DUT1| < 0.9s); this is an approximation, not an observed value.',
    deltaTUncertaintySeconds: 1.0,
    dut1UncertaintySeconds: 0.9,
    isDut1Approximation: true,
  });
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
   * Returns DUT1 (UT1 - UTC) in seconds.
   * Under standard civil approximation without external IERS Bulletin A feed, DUT1 is 0.0 (|DUT1| < 0.9s).
   * NOTE: This is a nominal civil broadcast approximation, not an observed astronomical measurement.
   */
  override getDut1(_instant: Instant): number {
    return 0.0;
  }
}

export const standardAstronomicalTimeScale = Object.freeze(new StandardAstronomicalTimeScale());

let registeredTimeScale: AstronomicalTimeScale = standardAstronomicalTimeScale;

export type AstronomicalTimeScaleChangeListener = (timeScale: AstronomicalTimeScale) => void;
const changeListeners: AstronomicalTimeScaleChangeListener[] = [];

/**
 * Subscribes to changes in the active astronomical time scale provider.
 */
export function onAstronomicalTimeScaleChange(
  listener: AstronomicalTimeScaleChangeListener
): () => void {
  changeListeners.push(listener);
  return () => {
    const idx = changeListeners.indexOf(listener);
    if (idx >= 0) {
      changeListeners.splice(idx, 1);
    }
  };
}

/**
 * Options for creating an astronomical time scale provider with canonical conversions.
 */
export interface AstronomicalTimeScaleOptions {
  readonly metadata?: TimeScaleMetadata | undefined;
  readonly deltaT: number | ((instant: Instant) => number);
  readonly dut1?: number | ((instant: Instant) => number);
}

/**
 * Creates an astronomical time scale provider with canonical Julian Day and Century conversions,
 * preventing contradictory definitions between Delta T, DUT1, TT, and UT1.
 */
export function createAstronomicalTimeScale(options: AstronomicalTimeScaleOptions): AstronomicalTimeScale {
  const deltaTFn = typeof options.deltaT === 'function' ? options.deltaT : () => options.deltaT as number;
  const dut1Fn =
    options.dut1 !== undefined
      ? typeof options.dut1 === 'function'
        ? options.dut1
        : () => options.dut1 as number
      : () => 0.0;

  class CustomTimeScale extends BaseAstronomicalTimeScale {
    readonly metadata = options.metadata;
    getDeltaT(instant: Instant): number {
      return deltaTFn(instant);
    }
    override getDut1(instant: Instant): number {
      return dut1Fn(instant);
    }
  }

  return new CustomTimeScale();
}

/**
 * Validates that an astronomical time scale provider is self-consistent and contains no
 * contradictory conversions between Delta T, DUT1, TT Julian Day, and UT1 Julian Day.
 * Throws RangeError if an inconsistency is detected.
 */
export function validateAstronomicalTimeScale(
  provider: AstronomicalTimeScale,
  testInstant?: Instant
): void {
  const instant = testInstant ?? Instant.fromEpochMilliseconds(1774011600000); // 2026-03-20T13:00:00Z
  const jdUt = instantToJulianDay(instant);
  const deltaT = provider.getDeltaT(instant);
  const dut1 = provider.getDut1
    ? provider.getDut1(instant)
    : (provider.toUt1JulianDay(instant) - jdUt) * 86400.0;

  const jdUt1 = provider.toUt1JulianDay(instant);
  const expectedJdUt1 = jdUt + dut1 / 86400.0;
  if (Math.abs(jdUt1 - expectedJdUt1) > 1e-4) {
    throw new RangeError(
      `AstronomicalTimeScale provider is inconsistent: toUt1JulianDay (${jdUt1.toFixed(8)}) contradicts getDut1 (${dut1}s, expected JD_UT1 ${expectedJdUt1.toFixed(8)}).`
    );
  }

  const jdTt = provider.toTerrestrialJulianDay(instant);
  const expectedJdTt = jdUt + (deltaT + dut1) / 86400.0;
  if (Math.abs(jdTt - expectedJdTt) > 1e-4) {
    throw new RangeError(
      `AstronomicalTimeScale provider is inconsistent: toTerrestrialJulianDay (${jdTt.toFixed(8)}) contradicts getDeltaT (${deltaT}s) and getDut1 (${dut1}s, expected JD_TT ${expectedJdTt.toFixed(8)}).`
    );
  }

  const century = provider.toTerrestrialJulianCentury(instant);
  const expectedCentury = julianDayToJulianCentury(jdTt);
  if (Math.abs(century - expectedCentury) > 1e-6) {
    throw new RangeError(
      `AstronomicalTimeScale provider is inconsistent: toTerrestrialJulianCentury (${century.toFixed(8)}) contradicts toTerrestrialJulianDay (${expectedCentury.toFixed(8)}).`
    );
  }
}

/**
 * Registers an active astronomical time scale provider.
 * When options.validate is true, verifies that the provider has consistent conversions.
 */
export function registerAstronomicalTimeScale(
  provider: AstronomicalTimeScale | null,
  options?: { validate?: boolean }
): void {
  if (provider !== null && options?.validate === true) {
    validateAstronomicalTimeScale(provider);
  }
  registeredTimeScale = provider ?? standardAstronomicalTimeScale;
  for (const listener of changeListeners) {
    listener(registeredTimeScale);
  }
}

/**
 * Gets the current active astronomical time scale provider.
 */
export function getAstronomicalTimeScale(): AstronomicalTimeScale {
  return registeredTimeScale;
}
