/**
 * @file math.ts
 * Astronomical algorithms for high-precision solar coordinates based on
 * Jean Meeus (Astronomical Algorithms, 2nd ed.) and NOAA Solar Calculator formulations.
 */

import { Instant } from '../../primitives/instant.js';
import { Interval } from '../../primitives/interval.js';
import { Place } from '../../primitives/place.js';
import { AstronomicalTimeScale, getAstronomicalTimeScale } from './timescale.js';

export const SOLAR_MODEL_VALIDITY_RANGE = new Interval(
  Instant.fromEpochMilliseconds(-5364662400000), // 1800-01-01T00:00:00Z
  Instant.fromEpochMilliseconds(4133980800000)  // 2101-01-01T00:00:00Z
);

export const DEG_TO_RAD = Math.PI / 180.0;
export const RAD_TO_DEG = 180.0 / Math.PI;

/**
 * Nominal horizon dip in degrees representing the center of the solar disk
 * at geometric sunrise/sunset (-0.8333°, combining 34' refraction + 16' semidiameter).
 */
export const NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG = -0.8333333333333334;

/**
 * Civil twilight boundary in degrees (-6.0°).
 */
export const CIVIL_TWILIGHT_ELEVATION_DEG = -6.0;

/**
 * Nautical twilight boundary in degrees (-12.0°).
 */
export const NAUTICAL_TWILIGHT_ELEVATION_DEG = -12.0;

/**
 * Astronomical twilight boundary in degrees (-18.0°).
 */
export const ASTRONOMICAL_TWILIGHT_ELEVATION_DEG = -18.0;

/**
 * Calculates geometric horizon dip in degrees for an observer at height h meters
 * above the unobstructed sea-level horizon:
 * d_dip = (1.76 / 60) * sqrt(max(0, h_meters)) degrees.
 *
 * Explicit Assumption: Assumes unobstructed sea-level horizon dip.
 * Does NOT model local topographical features, mountain ridges, or architectural/building obstruction.
 */
export function calcHorizonDip(elevationMeters: number = 0): number {
  return elevationMeters > 0 ? (1.76 / 60.0) * Math.sqrt(elevationMeters) : 0.0;
}

export function degToRad(degrees: number): number {
  return degrees * DEG_TO_RAD;
}

export function radToDeg(radians: number): number {
  return radians * RAD_TO_DEG;
}

/**
 * Converts a ChronoFlux Instant to a fractional Julian Day (UT).
 * Epoch 1970-01-01T00:00:00Z corresponds to JD 2440587.5.
 */
export function instantToJulianDay(instant: Instant): number {
  const epochNs = instant.epochNanoseconds;
  const epochMs = Number(epochNs / 1_000_000n) + Number(epochNs % 1_000_000n) / 1_000_000;
  return 2440587.5 + epochMs / 86400000.0;
}

/**
 * Converts a Julian Day to Julian Century (T) relative to J2000.0 (JD 2451545.0).
 */
export function julianDayToJulianCentury(jd: number): number {
  return (jd - 2451545.0) / 36525.0;
}

/**
 * Converts a ChronoFlux Instant to Julian Century (T_TT) on the Terrestrial Time scale
 * using the active astronomical timescale provider:
 * T_TT = (JD_UTC + (Delta T + DUT1) / 86400.0 - 2451545.0) / 36525.0.
 */
export function instantToJulianCentury(
  instant: Instant,
  timeScale: AstronomicalTimeScale = getAstronomicalTimeScale()
): number {
  return timeScale.toTerrestrialJulianCentury(instant);
}

/**
 * Geometric Mean Longitude of the Sun (L0) in degrees [0, 360).
 * Meeus formula 25.2 / NOAA.
 */
export function calcGeomMeanLongSun(t: number): number {
  let l0 = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360.0;
  if (l0 < 0) {
    l0 += 360.0;
  }
  return l0;
}

/**
 * Geometric Mean Anomaly of the Sun (M) in degrees.
 * Meeus formula 25.3 / NOAA.
 */
export function calcGeomMeanAnomalySun(t: number): number {
  return 357.52911 + t * (35999.05029 - 0.0001537 * t);
}

/**
 * Eccentricity of Earth's orbit (e).
 * Meeus formula 25.4 / NOAA.
 */
export function calcEccentricityEarthOrbit(t: number): number {
  return 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
}

/**
 * Sun's Equation of Center (C) in degrees.
 * Meeus page 164 / NOAA.
 */
export function calcSunEqOfCenter(t: number, mDeg: number): number {
  const mRad = degToRad(mDeg);
  return (
    Math.sin(mRad) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(2.0 * mRad) * (0.019993 - 0.000101 * t) +
    Math.sin(3.0 * mRad) * 0.000289
  );
}

/**
 * Sun's True Longitude (sunTrueLong) in degrees.
 */
export function calcSunTrueLong(l0Deg: number, cDeg: number): number {
  return l0Deg + cDeg;
}

/**
 * Sun's True Anomaly (sunTrueAnom) in degrees.
 */
export function calcSunTrueAnomaly(mDeg: number, cDeg: number): number {
  return mDeg + cDeg;
}

/**
 * Sun's Apparent Longitude (lambda) in degrees, corrected for aberration and nutation.
 * Meeus formula 25.8 / NOAA.
 */
export function calcSunApparentLong(t: number, trueLongDeg: number): number {
  const omega = 125.04 - 1934.136 * t;
  return trueLongDeg - 0.00569 - 0.00478 * Math.sin(degToRad(omega));
}

/**
 * Mean Obliquity of the Ecliptic (eps0) in degrees.
 * Meeus formula 22.2 / NOAA.
 */
export function calcMeanObliquityOfEcliptic(t: number): number {
  const seconds = 21.448 - t * (46.815 + t * (0.00059 - t * 0.001813));
  return 23.0 + (26.0 + seconds / 60.0) / 60.0;
}

/**
 * Corrected Obliquity of the Ecliptic (eps) in degrees, corrected for nutation.
 * Meeus page 165 / NOAA.
 */
export function calcObliquityCorrection(t: number, meanObliqDeg: number): number {
  const omega = 125.04 - 1934.136 * t;
  return meanObliqDeg + 0.00256 * Math.cos(degToRad(omega));
}

/**
 * Sun's Right Ascension (alpha) in degrees [0, 360).
 * Meeus formula 25.6 / NOAA.
 */
export function calcSunRightAscension(appLongDeg: number, obliqCorrDeg: number): number {
  const epsRad = degToRad(obliqCorrDeg);
  const lamRad = degToRad(appLongDeg);
  let alpha = radToDeg(Math.atan2(Math.cos(epsRad) * Math.sin(lamRad), Math.cos(lamRad)));
  if (alpha < 0) {
    alpha += 360.0;
  }
  return alpha % 360.0;
}

/**
 * Sun's Declination (delta) in degrees [-23.45°, +23.45°].
 * Meeus formula 25.7 / NOAA.
 */
export function calcSunDeclination(appLongDeg: number, obliqCorrDeg: number): number {
  const epsRad = degToRad(obliqCorrDeg);
  const lamRad = degToRad(appLongDeg);
  return radToDeg(Math.asin(Math.sin(epsRad) * Math.sin(lamRad)));
}

/**
 * Equation of Time (EoT) in minutes.
 * Meeus Chapter 28 / NOAA.
 */
export function calcEquationOfTime(
  l0Deg: number,
  mDeg: number,
  e: number,
  obliqCorrDeg: number
): number {
  const epsRad = degToRad(obliqCorrDeg);
  const y = Math.pow(Math.tan(epsRad / 2.0), 2);
  const l0Rad = degToRad(l0Deg);
  const mRad = degToRad(mDeg);
  const sin2l0 = Math.sin(2.0 * l0Rad);
  const sinm = Math.sin(mRad);
  const cos2l0 = Math.cos(2.0 * l0Rad);
  const sin4l0 = Math.sin(4.0 * l0Rad);
  const sin2m = Math.sin(2.0 * mRad);
  const eTime =
    y * sin2l0 -
    2.0 * e * sinm +
    4.0 * e * y * sinm * cos2l0 -
    0.5 * y * y * sin4l0 -
    1.25 * e * e * sin2m;
  return radToDeg(eTime) * 4.0;
}

/**
 * Calculates True Solar Time (TST) in minutes of day [0, 1440) using Earth rotation (UT1):
 * UT1 = UTC + DUT1.
 * TST = UT1_minutes + EoT + 4 * longitude.
 */
export function calcTrueSolarTime(
  instant: Instant,
  equationOfTimeMinutes: number,
  longitudeDeg: number,
  timeScale: AstronomicalTimeScale = getAstronomicalTimeScale()
): number {
  const dut1Sec = timeScale.getDut1
    ? timeScale.getDut1(instant)
    : (timeScale.toUt1JulianDay(instant) - instantToJulianDay(instant)) * 86400.0;
  const dut1Minutes = dut1Sec / 60.0;
  const dayNs = instant.epochNanoseconds % 86_400_000_000_000n;
  const positiveDayNs = dayNs >= 0n ? dayNs : 86_400_000_000_000n + dayNs;
  const utcMinutesOfDay = Number(positiveDayNs) / 60_000_000_000;
  const ut1MinutesOfDay = utcMinutesOfDay + dut1Minutes;
  let tst = (ut1MinutesOfDay + equationOfTimeMinutes + 4.0 * longitudeDeg) % 1440.0;
  if (tst < 0) {
    tst += 1440.0;
  }
  return tst;
}

/**
 * Calculates Solar Hour Angle (H) in degrees [-180°, +180°].
 * 0° at True Solar Noon, negative in morning, positive in afternoon.
 */
export function calcHourAngle(trueSolarTimeMinutes: number): number {
  let ha = trueSolarTimeMinutes / 4.0 - 180.0;
  if (ha < -180.0) {
    ha += 360.0;
  }
  if (ha > 180.0) {
    ha -= 360.0;
  }
  return ha;
}

/**
 * Atmospheric refraction correction in degrees (Saemundsson / Bennett / NOAA formulation).
 */
export function calcAtmosphericRefraction(geometricElevationDeg: number): number {
  if (geometricElevationDeg > 85.0) {
    return 0.0;
  }
  const te = Math.tan(degToRad(geometricElevationDeg));
  let rArcsec: number;
  if (geometricElevationDeg > 5.0) {
    rArcsec = 58.1 / te - 0.07 / (te * te * te) + 0.000086 / (te * te * te * te * te);
  } else if (geometricElevationDeg > -0.575) {
    rArcsec =
      1735.0 +
      geometricElevationDeg *
        (-518.2 +
          geometricElevationDeg *
            (103.4 + geometricElevationDeg * (-12.79 + geometricElevationDeg * 0.711)));
  } else {
    rArcsec = -20.774 / te;
  }
  return rArcsec / 3600.0;
}

/**
 * Calculates geometric and apparent solar elevation and zenith angles.
 */
export function calcSolarElevationAndZenith(
  latitudeDeg: number,
  declinationDeg: number,
  hourAngleDeg: number
): {
  geometricElevationDeg: number;
  apparentElevationDeg: number;
  geometricZenithDeg: number;
  apparentZenithDeg: number;
  atmosphericRefractionDeg: number;
} {
  const phiRad = degToRad(latitudeDeg);
  const deltaRad = degToRad(declinationDeg);
  const hRad = degToRad(hourAngleDeg);

  let cosZenith =
    Math.sin(phiRad) * Math.sin(deltaRad) + Math.cos(phiRad) * Math.cos(deltaRad) * Math.cos(hRad);
  cosZenith = Math.max(-1.0, Math.min(1.0, cosZenith));

  const geometricZenithDeg = radToDeg(Math.acos(cosZenith));
  const geometricElevationDeg = 90.0 - geometricZenithDeg;
  const atmosphericRefractionDeg = calcAtmosphericRefraction(geometricElevationDeg);
  const apparentElevationDeg = Math.max(
    -90.0,
    Math.min(90.0, geometricElevationDeg + atmosphericRefractionDeg)
  );
  const apparentZenithDeg = 90.0 - apparentElevationDeg;

  return {
    geometricElevationDeg,
    apparentElevationDeg,
    geometricZenithDeg,
    apparentZenithDeg,
    atmosphericRefractionDeg,
  };
}

/**
 * Solar Azimuth Angle in degrees [0, 360) clockwise from true North.
 * NOAA Solar Calculator formulation.
 */
/**
 * Solar Azimuth Angle in degrees [0, 360) clockwise from true North.
 * NOAA Solar Calculator formulation with explicit indeterminate handling at zenith/nadir and poles.
 */
export function calcSolarAzimuth(
  latitudeDeg: number,
  declinationDeg: number,
  geometricZenithDeg: number,
  hourAngleDeg: number
): { azimuthDeg: number | null; isAzimuthIndeterminate: boolean } {
  // Polar singularity: at geographic North or South Pole (|latitude| >= 89.9999°), all directions are South/North; azimuth is indeterminate.
  if (Math.abs(latitudeDeg) >= 89.9999) {
    return { azimuthDeg: null, isAzimuthIndeterminate: true };
  }

  // Zenith / nadir singularity: when zenith is <= 1e-5° (or >= 179.99999°), azimuth is indeterminate.
  if (geometricZenithDeg <= 1e-5 || geometricZenithDeg >= 179.99999) {
    return { azimuthDeg: null, isAzimuthIndeterminate: true };
  }

  const phiRad = degToRad(latitudeDeg);
  const deltaRad = degToRad(declinationDeg);
  const zRad = degToRad(geometricZenithDeg);
  const azDenom = Math.cos(phiRad) * Math.sin(zRad);

  if (Math.abs(azDenom) > 1e-6) {
    let cosAz = (Math.sin(phiRad) * Math.cos(zRad) - Math.sin(deltaRad)) / azDenom;
    cosAz = Math.max(-1.0, Math.min(1.0, cosAz));
    const azDeg = radToDeg(Math.acos(cosAz));
    const azimuthDeg = hourAngleDeg > 0 ? (azDeg + 180.0) % 360.0 : (540.0 - azDeg) % 360.0;
    return { azimuthDeg, isAzimuthIndeterminate: false };
  }

  return { azimuthDeg: null, isAzimuthIndeterminate: true };
}

/**
 * Calculates dynamic coordinate, sensitivity, and event-time uncertainties.
 * Separates:
 * 1. Ephemeris numerical approximation error (assumed ±0.01° for 1800-2100 CE; expanding when extrapolated)
 * 2. Atmospheric refraction model uncertainty (~12% of refraction at nominal 1010 mbar, 10°C)
 * 3. Combined instantaneous coordinate error: Delta h(t) = sqrt(num^2 + refr^2)
 * 4. Instantaneous threshold-crossing sensitivity: |dh/dt| in deg/min
 * 5. Dynamic event-time uncertainty: Delta t = Delta h / |dh/dt|
 * 6. Observer horizon limitation dip from elevation above sea level
 */
export function calcSolarUncertainty(
  latitudeDeg: number,
  declinationDeg: number,
  geometricElevationDeg: number,
  hourAngleDeg: number,
  refractionDeg: number,
  elevationMeters: number = 0,
  tJulianCentury?: number
) {
  // Truncated ephemeris error is ±0.01° within 1800-2100 CE (T in [-2.0, +1.0] relative to J2000.0).
  // Degrades quadratically for centuries outside this validity range.
  let numericalErrorDeg = 0.01;
  if (tJulianCentury !== undefined) {
    let centuryExcess = 0;
    if (tJulianCentury < -2.0) {
      centuryExcess = -2.0 - tJulianCentury;
    } else if (tJulianCentury > 1.0) {
      centuryExcess = tJulianCentury - 1.0;
    }
    if (centuryExcess > 0) {
      numericalErrorDeg = 0.01 + 0.05 * centuryExcess * centuryExcess;
    }
  }

  const atmosphericRefractionUncertaintyDeg = Math.max(0.001, refractionDeg * 0.12);
  const combinedCoordinateUncertaintyDeg = Math.sqrt(
    numericalErrorDeg * numericalErrorDeg +
      atmosphericRefractionUncertaintyDeg * atmosphericRefractionUncertaintyDeg
  );

  // Rate of change dh/dt in degrees per minute
  // dh/dt = -cos(phi)*cos(delta)*sin(H) * (0.25 deg/min) / cos(h)
  const phiRad = degToRad(latitudeDeg);
  const deltaRad = degToRad(declinationDeg);
  const hRad = degToRad(hourAngleDeg);
  const cosH = Math.max(0.01, Math.cos(degToRad(geometricElevationDeg)));
  const dhDtPerMin = Math.abs(
    (-Math.cos(phiRad) * Math.cos(deltaRad) * Math.sin(hRad) * 0.25) / cosH
  );

  let eventTimeUncertaintyMinutes: number;
  if (dhDtPerMin > 1e-5) {
    eventTimeUncertaintyMinutes = combinedCoordinateUncertaintyDeg / dhDtPerMin;
  } else {
    // Near transit (dh/dt = 0), curvature d2h/dt2 governs transit time uncertainty
    const omegaMin = degToRad(0.25); // radians per minute
    const d2hDt2 = Math.abs(Math.cos(phiRad) * Math.cos(deltaRad)) * omegaMin * omegaMin;
    if (d2hDt2 > 1e-8) {
      eventTimeUncertaintyMinutes = Math.sqrt((2 * degToRad(combinedCoordinateUncertaintyDeg)) / d2hDt2);
    } else {
      eventTimeUncertaintyMinutes = 60.0; // high-latitude flat diurnal curve
    }
  }

  const horizonLimitationDeg = calcHorizonDip(elevationMeters);

  return {
    numericalErrorDeg,
    atmosphericRefractionUncertaintyDeg,
    combinedCoordinateUncertaintyDeg,
    crossingSensitivityDegPerMin: dhDtPerMin,
    eventTimeUncertaintyMinutes,
    sunriseUncertaintyMinutes: null as number | null,
    sunsetUncertaintyMinutes: null as number | null,
    horizonLimitationDeg,
  };
}

/**
 * Calculates event-crossing time uncertainty evaluated at the actual event instant (e.g. sunrise or sunset).
 * Delta t = Delta h_horizon / |dh/dt|_{event}
 */
export function calcSolarCrossingUncertainty(
  place: Place,
  eventInstant: Instant,
  _targetElevationDeg: number = NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG
): number {
  const coords = computeSolarCoordinates(eventInstant, place);
  const deltaH = coords.uncertainty.combinedCoordinateUncertaintyDeg;
  const dhDtPerMin = coords.uncertainty.crossingSensitivityDegPerMin;

  if (dhDtPerMin > 1e-5) {
    return deltaH / dhDtPerMin;
  }
  // Tangential / grazing crossing: curvature d2h/dt2 governs transit uncertainty
  const phiRad = degToRad(place.latitude);
  const deltaRad = degToRad(coords.declinationDeg);
  const omegaMin = degToRad(0.25);
  const d2hDt2 = Math.abs(Math.cos(phiRad) * Math.cos(deltaRad)) * omegaMin * omegaMin;
  if (d2hDt2 > 1e-8) {
    return Math.sqrt((2 * degToRad(deltaH)) / d2hDt2);
  }
  return 60.0;
}

/**
 * Computes the solar coordinates bundle at a given instant and place using the active
 * astronomical time-scale provider (TT for ephemeris, UT1 for diurnal rotation).
 */
export function computeSolarCoordinates(
  instant: Instant,
  place: Place,
  timeScale: AstronomicalTimeScale = getAstronomicalTimeScale()
) {
  const t = instantToJulianCentury(instant, timeScale);
  const l0 = calcGeomMeanLongSun(t);
  const m = calcGeomMeanAnomalySun(t);
  const e = calcEccentricityEarthOrbit(t);
  const c = calcSunEqOfCenter(t, m);
  const trueLong = calcSunTrueLong(l0, c);
  const appLong = calcSunApparentLong(t, trueLong);
  const meanObliq = calcMeanObliquityOfEcliptic(t);
  const obliqCorr = calcObliquityCorrection(t, meanObliq);
  const rightAscensionDeg = calcSunRightAscension(appLong, obliqCorr);
  const declinationDeg = calcSunDeclination(appLong, obliqCorr);
  const equationOfTimeMinutes = calcEquationOfTime(l0, m, e, obliqCorr);
  const trueSolarTimeMinutes = calcTrueSolarTime(instant, equationOfTimeMinutes, place.longitude, timeScale);
  const hourAngleDeg = calcHourAngle(trueSolarTimeMinutes);

  const angles = calcSolarElevationAndZenith(place.latitude, declinationDeg, hourAngleDeg);
  const { azimuthDeg, isAzimuthIndeterminate } = calcSolarAzimuth(
    place.latitude,
    declinationDeg,
    angles.geometricZenithDeg,
    hourAngleDeg
  );
  const uncertainty = calcSolarUncertainty(
    place.latitude,
    declinationDeg,
    angles.geometricElevationDeg,
    hourAngleDeg,
    angles.atmosphericRefractionDeg,
    place.elevationMeters ?? 0,
    t
  );


  return {
    t,
    l0,
    m,
    e,
    c,
    trueLong,
    appLong,
    meanObliq,
    obliqCorr,
    rightAscensionDeg,
    declinationDeg,
    equationOfTimeMinutes,
    trueSolarTimeMinutes,
    hourAngleDeg,
    azimuthDeg,
    isAzimuthIndeterminate,
    uncertainty,
    ...angles,
  };
}

/**
 * Finds the solar transit (solar noon) for the diurnal cycle nearest to the given instant.
 */
export function calcSolarNoon(instant: Instant, longitudeDeg: number): Instant {
  const initialCoords = computeSolarCoordinates(
    instant,
    new Place({ latitude: 0, longitude: longitudeDeg })
  );
  let deltaTMin = 720.0 - initialCoords.trueSolarTimeMinutes;
  if (deltaTMin < -720.0) {
    deltaTMin += 1440.0;
  }
  if (deltaTMin > 720.0) {
    deltaTMin -= 1440.0;
  }

  let currentNs = instant.epochNanoseconds + BigInt(Math.round(deltaTMin * 60_000_000_000));

  // 2 Newton-Raphson refinement iterations on hour angle H = 0
  for (let iter = 0; iter < 2; iter++) {
    const curInstant = Instant.fromEpochNanoseconds(currentNs);
    const coords = computeSolarCoordinates(
      curInstant,
      new Place({ latitude: 0, longitude: longitudeDeg })
    );
    const correctionSec = -coords.hourAngleDeg * 240.0;
    currentNs += BigInt(Math.round(correctionSec * 1_000_000_000));
  }

  return Instant.fromEpochNanoseconds(currentNs);
}

/**
 * Finds the solar nadir (solar midnight) for the diurnal cycle nearest to the given instant.
 */
export function calcSolarMidnight(instant: Instant, longitudeDeg: number): Instant {
  const initialCoords = computeSolarCoordinates(
    instant,
    new Place({ latitude: 0, longitude: longitudeDeg })
  );
  let deltaTMin = -initialCoords.trueSolarTimeMinutes;
  if (deltaTMin < -720.0) {
    deltaTMin += 1440.0;
  }
  if (deltaTMin > 720.0) {
    deltaTMin -= 1440.0;
  }

  let currentNs = instant.epochNanoseconds + BigInt(Math.round(deltaTMin * 60_000_000_000));

  // 2 Newton-Raphson refinement iterations on True Solar Time = 0 / 1440
  for (let iter = 0; iter < 2; iter++) {
    const curInstant = Instant.fromEpochNanoseconds(currentNs);
    const coords = computeSolarCoordinates(
      curInstant,
      new Place({ latitude: 0, longitude: longitudeDeg })
    );
    let errorMin = coords.trueSolarTimeMinutes;
    if (errorMin > 720.0) {
      errorMin -= 1440.0;
    }
    const correctionSec = -errorMin * 60.0;
    currentNs += BigInt(Math.round(correctionSec * 1_000_000_000));
  }

  return Instant.fromEpochNanoseconds(currentNs);
}

/**
 * Maximum safe bracket width in nanoseconds for relative nanosecond Number conversion.
 * Stays well within Number.MAX_SAFE_INTEGER (~9e15 ns ≈ 104.2 days).
 */
export const MAX_SAFE_POLAR_BRACKET_WIDTH_NS = 9_000_000_000_000_000n;

/**
 * Diagnostic result of genuine bracketed root-finding for polar solar crossings.
 */
export interface PolarCrossingResult {
  readonly crossingInstant: Instant;
  readonly status: 'converged' | 'max_iterations' | 'not_bracketed';
  readonly iterations: number;
  readonly residualDeg: number;
  readonly isResidualVerified: boolean;
}

/**
 * Solves a bracketed solar elevation crossing at polar singularity latitudes (|lat| >= 89.99°)
 * using the Brent-Dekker algorithm with guaranteed bracket contraction, explicit convergence status,
 * and residual verification (|h(t) - theta| <= toleranceDeg).
 *
 * All interpolation calculations operate on relative nanosecond differences to avoid
 * catastrophic floating-point cancellation on absolute epoch nanoseconds (~1.7e18).
 */
export function solvePolarCrossingBracket(
  place: Place,
  aNs: bigint,
  bNs: bigint,
  targetElevationDeg: number,
  maxIterations: number = 50,
  toleranceDeg: number = 1e-5
): PolarCrossingResult {
  if (typeof toleranceDeg !== 'number' || !Number.isFinite(toleranceDeg) || toleranceDeg <= 0) {
    throw new RangeError(`toleranceDeg must be a positive finite number, received: ${toleranceDeg}`);
  }
  if (typeof maxIterations !== 'number' || !Number.isInteger(maxIterations) || maxIterations < 1) {
    throw new RangeError(`maxIterations must be an integer >= 1, received: ${maxIterations}`);
  }
  if (typeof targetElevationDeg !== 'number' || !Number.isFinite(targetElevationDeg)) {
    throw new TypeError(`targetElevationDeg must be a finite number, received: ${targetElevationDeg}`);
  }
  if (typeof aNs !== 'bigint' || typeof bNs !== 'bigint') {
    throw new TypeError('aNs and bNs must be bigints');
  }

  // Support reversed brackets by ordering endpoints chronologically
  let startNs = aNs;
  let endNs = bNs;
  if (startNs > endNs) {
    startNs = bNs;
    endNs = aNs;
  }

  const bracketWidthNs = endNs - startNs;
  if (bracketWidthNs > MAX_SAFE_POLAR_BRACKET_WIDTH_NS) {
    throw new RangeError(
      `Bracket width (${bracketWidthNs} ns) exceeds maximum safe bracket width (${MAX_SAFE_POLAR_BRACKET_WIDTH_NS} ns) for relative nanosecond arithmetic.`
    );
  }

  let fA = computeSolarCoordinates(Instant.fromEpochNanoseconds(startNs), place).geometricElevationDeg - targetElevationDeg;
  let fB = computeSolarCoordinates(Instant.fromEpochNanoseconds(endNs), place).geometricElevationDeg - targetElevationDeg;

  // Tangential touch checks at endpoints respecting toleranceDeg
  if (Math.abs(fA) <= toleranceDeg) {
    return {
      crossingInstant: Instant.fromEpochNanoseconds(startNs),
      status: 'converged',
      iterations: 0,
      residualDeg: Math.abs(fA),
      isResidualVerified: true,
    };
  }
  if (Math.abs(fB) <= toleranceDeg) {
    return {
      crossingInstant: Instant.fromEpochNanoseconds(endNs),
      status: 'converged',
      iterations: 0,
      residualDeg: Math.abs(fB),
      isResidualVerified: true,
    };
  }

  // Crossing must lie strictly within [startNs, endNs]
  if (fA * fB > 0 || startNs === endNs) {
    const bestNs = Math.abs(fA) <= Math.abs(fB) ? startNs : endNs;
    const bestResidual = Math.min(Math.abs(fA), Math.abs(fB));
    return {
      crossingInstant: Instant.fromEpochNanoseconds(bestNs),
      status: 'not_bracketed',
      iterations: 0,
      residualDeg: bestResidual,
      isResidualVerified: false,
    };
  }

  let a = startNs;
  let b = endNs;
  // Ensure |f(b)| <= |f(a)| so that b is the best estimate
  if (Math.abs(fA) < Math.abs(fB)) {
    const tmp = a;
    a = b;
    b = tmp;
    const tmpF = fA;
    fA = fB;
    fB = tmpF;
  }

  let c = a;
  let fc = fA;
  let d = 0n;
  let mflag = true;

  for (let iter = 1; iter <= maxIterations; iter++) {
    const intervalNs = b > a ? b - a : a - b;
    if (Math.abs(fB) <= toleranceDeg) {
      const residual = Math.abs(
        computeSolarCoordinates(Instant.fromEpochNanoseconds(b), place).geometricElevationDeg - targetElevationDeg
      );
      if (residual <= toleranceDeg) {
        return {
          crossingInstant: Instant.fromEpochNanoseconds(b),
          status: 'converged',
          iterations: iter - 1,
          residualDeg: residual,
          isResidualVerified: true,
        };
      }
    }

    if (intervalNs <= 1_000_000n) {
      const residual = Math.abs(
        computeSolarCoordinates(Instant.fromEpochNanoseconds(b), place).geometricElevationDeg - targetElevationDeg
      );
      const isVerified = residual <= toleranceDeg;
      return {
        crossingInstant: Instant.fromEpochNanoseconds(b),
        status: isVerified ? 'converged' : 'max_iterations',
        iterations: iter - 1,
        residualDeg: residual,
        isResidualVerified: isVerified,
      };
    }

    // Relative interpolation offsets relative to b (avoids floating point loss on 1.7e18 epoch nanoseconds)
    const deltaA = Number(a - b);
    const deltaC = Number(c - b);
    let deltaS: number;

    if (Math.abs(fA - fc) > 1e-9 && Math.abs(fB - fc) > 1e-9) {
      // Inverse quadratic interpolation
      const termA = deltaA * (fB * fc) / ((fA - fB) * (fA - fc));
      const termC = deltaC * (fA * fB) / ((fc - fA) * (fc - fB));
      deltaS = termA + termC;
    } else {
      // Secant method
      deltaS = -fB * deltaA / (fA - fB);
    }

    let s = b + BigInt(Math.round(deltaS));

    // Check conditions for bisection safeguard
    const minBound = (3n * a + b) / 4n;
    const condition1 = (minBound < b && (s < minBound || s > b)) || (minBound > b && (s > minBound || s < b));
    const bMinusC = b > c ? b - c : c - b;
    const bMinusS = b > s ? b - s : s - b;
    const cMinusD = c > d ? c - d : d - c;
    const condition2 = mflag && (bMinusS >= bMinusC / 2n);
    const condition3 = !mflag && (bMinusS >= cMinusD / 2n);
    const condition4 = mflag && (bMinusC < 1_000_000n);
    const condition5 = !mflag && (cMinusD < 1_000_000n);

    if (condition1 || condition2 || condition3 || condition4 || condition5) {
      s = (a + b) / 2n;
      mflag = true;
    } else {
      mflag = false;
    }

    const fs = computeSolarCoordinates(Instant.fromEpochNanoseconds(s), place).geometricElevationDeg - targetElevationDeg;
    d = c;
    c = b;
    fc = fB;

    if (fA * fs < 0) {
      b = s;
      fB = fs;
    } else {
      a = s;
      fA = fs;
    }

    if (Math.abs(fA) < Math.abs(fB)) {
      const temp = a;
      a = b;
      b = temp;
      const tempF = fA;
      fA = fB;
      fB = tempF;
    }
  }

  const finalResidual = Math.abs(
    computeSolarCoordinates(Instant.fromEpochNanoseconds(b), place).geometricElevationDeg - targetElevationDeg
  );
  const isFinalVerified = finalResidual <= toleranceDeg;
  return {
    crossingInstant: Instant.fromEpochNanoseconds(b),
    status: isFinalVerified ? 'converged' : 'max_iterations',
    iterations: maxIterations,
    residualDeg: finalResidual,
    isResidualVerified: isFinalVerified,
  };
}

/**
 * Solves the crossing time for a target geometric elevation angle on a given branch
 * using safeguarded hybrid Newton-Raphson / bisection root-finding with explicit elevation verification.
 *
 * @param place Geographic location
 * @param noon Instant of solar noon for the diurnal cycle
 * @param targetElevationDeg Target geometric elevation in degrees (e.g. -0.8333° for sunrise/sunset, -6° for civil dawn/dusk)
 * @param direction 'rising' (morning branch [noon - 12h, noon]) or 'setting' (afternoon branch [noon, noon + 12h])
 */
export function findSolarCrossing(
  place: Place,
  noon: Instant,
  targetElevationDeg: number,
  direction: 'rising' | 'setting'
): Instant | null {
  const phiRad = degToRad(place.latitude);
  const cosPhi = Math.cos(phiRad);

  // Polar singularity (|latitude| >= 89.99°): elevation is purely governed by seasonal declination delta(t).
  if (Math.abs(cosPhi) < 1e-4) {
    const TWELVE_HOURS_NS = 43_200_000_000_000n;
    const aNs = noon.epochNanoseconds - TWELVE_HOURS_NS;
    const bNs = noon.epochNanoseconds + TWELVE_HOURS_NS;
    const fA = computeSolarCoordinates(Instant.fromEpochNanoseconds(aNs), place).geometricElevationDeg - targetElevationDeg;
    const fB = computeSolarCoordinates(Instant.fromEpochNanoseconds(bNs), place).geometricElevationDeg - targetElevationDeg;

    const dElevPerDay = fB - fA;
    if (Math.abs(dElevPerDay) < 1e-6) {
      return null;
    }

    const isRising = dElevPerDay > 0;
    if ((direction === 'rising' && !isRising) || (direction === 'setting' && isRising)) {
      return null;
    }

    const solveResult = solvePolarCrossingBracket(place, aNs, bNs, targetElevationDeg);
    if (solveResult.status === 'converged' && solveResult.isResidualVerified) {
      return solveResult.crossingInstant;
    }
    return null;
  }


  // Non-polar: define exact 12-hour search bracket for this diurnal branch
  // Rising branch: [noon - 12h, noon]
  // Setting branch: [noon, noon + 12h]
  const TWELVE_HOURS_NS = 43_200_000_000_000n;
  const startNs = direction === 'rising' ? noon.epochNanoseconds - TWELVE_HOURS_NS : noon.epochNanoseconds;
  const endNs = direction === 'rising' ? noon.epochNanoseconds : noon.epochNanoseconds + TWELVE_HOURS_NS;

  const instantA = Instant.fromEpochNanoseconds(startNs);
  const instantB = Instant.fromEpochNanoseconds(endNs);
  let fA = computeSolarCoordinates(instantA, place).geometricElevationDeg - targetElevationDeg;
  let fB = computeSolarCoordinates(instantB, place).geometricElevationDeg - targetElevationDeg;

  // Tangential touch checks at endpoints
  if (Math.abs(fA) < 1e-5) {
    return instantA;
  }
  if (Math.abs(fB) < 1e-5) {
    return instantB;
  }

  // If endpoints have identical signs, check if crossing is impossible or tangential
  if (fA * fB > 0) {
    return null;
  }

  // Crossing is strictly bracketed: compute initial guess via spherical trigonometry
  const coordsNoon = computeSolarCoordinates(noon, place);
  const deltaRad = degToRad(coordsNoon.declinationDeg);
  const hTargetRad = degToRad(targetElevationDeg);
  const cosH0 = (Math.sin(hTargetRad) - Math.sin(phiRad) * Math.sin(deltaRad)) / (cosPhi * Math.cos(deltaRad));

  let currentNs: bigint;
  if (cosH0 >= -1.0 && cosH0 <= 1.0) {
    const h0Deg = radToDeg(Math.acos(cosH0));
    const halfDaySec = h0Deg * 240.0;
    const sign = direction === 'rising' ? -1 : 1;
    currentNs = noon.epochNanoseconds + BigInt(Math.round(sign * halfDaySec * 1_000_000_000));
    if (currentNs < startNs || currentNs > endNs) {
      currentNs = (startNs + endNs) / 2n;
    }
  } else {
    currentNs = (startNs + endNs) / 2n;
  }

  let bracketANs = startNs;
  let bracketBNs = endNs;

  // Safeguarded hybrid Newton-Raphson / Bisection solver
  for (let iter = 0; iter < 25; iter++) {
    const curInstant = Instant.fromEpochNanoseconds(currentNs);
    const coords = computeSolarCoordinates(curInstant, place);
    const errorDeg = coords.geometricElevationDeg - targetElevationDeg;

    if (Math.abs(errorDeg) < 1e-6 || bracketBNs - bracketANs <= 1_000_000n) {
      break;
    }

    // Update bracket
    if ((fA > 0 && errorDeg > 0) || (fA < 0 && errorDeg < 0)) {
      bracketANs = currentNs;
      fA = errorDeg;
    } else {
      bracketBNs = currentNs;
      fB = errorDeg;
    }

    // Rate of change dh/dt = -cos(phi)*cos(delta)*sin(H) / (cos(h) * 240 deg/sec)
    const curPhiRad = degToRad(place.latitude);
    const curDeltaRad = degToRad(coords.declinationDeg);
    const curHRad = degToRad(coords.hourAngleDeg);
    const cosH = Math.max(0.01, Math.cos(degToRad(coords.geometricElevationDeg)));
    const dhDt = (-Math.cos(curPhiRad) * Math.cos(curDeltaRad) * Math.sin(curHRad)) / (cosH * 240.0);

    let nextNs: bigint = (bracketANs + bracketBNs) / 2n;

    if (Math.abs(dhDt) > 1e-6) {
      const stepSec = -errorDeg / dhDt;
      const candidateNs = currentNs + BigInt(Math.round(stepSec * 1_000_000_000));
      // Safeguard: candidate must lie strictly inside bracket with 5% safety margin
      const margin = (bracketBNs - bracketANs) / 20n;
      if (candidateNs >= bracketANs + margin && candidateNs <= bracketBNs - margin) {
        nextNs = candidateNs;
      }
    }

    currentNs = nextNs;
  }

  const resultInstant = Instant.fromEpochNanoseconds(currentNs);

  // Explicit verification against calculated elevation
  const verifyCoords = computeSolarCoordinates(resultInstant, place);
  const finalErrorDeg = Math.abs(verifyCoords.geometricElevationDeg - targetElevationDeg);
  if (finalErrorDeg > 0.005) {
    return null;
  }

  return resultInstant;
}
