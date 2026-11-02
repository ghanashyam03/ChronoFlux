/**
 * @file math.ts
 * Astronomical algorithms for high-precision solar coordinates based on
 * Jean Meeus (Astronomical Algorithms, 2nd ed.) and NOAA Solar Calculator formulations.
 */

import { Instant } from '../../primitives/instant.js';
import { Place } from '../../primitives/place.js';

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
 * Converts a ChronoFlux Instant directly to Julian Century (T).
 */
export function instantToJulianCentury(instant: Instant): number {
  return julianDayToJulianCentury(instantToJulianDay(instant));
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
 * Calculates True Solar Time (TST) in minutes of day [0, 1440).
 */
export function calcTrueSolarTime(
  instant: Instant,
  equationOfTimeMinutes: number,
  longitudeDeg: number
): number {
  const dayNs = instant.epochNanoseconds % 86_400_000_000_000n;
  const positiveDayNs = dayNs >= 0n ? dayNs : 86_400_000_000_000n + dayNs;
  const utcMinutesOfDay = Number(positiveDayNs) / 60_000_000_000;
  let tst = (utcMinutesOfDay + equationOfTimeMinutes + 4.0 * longitudeDeg) % 1440.0;
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
export function calcSolarAzimuth(
  latitudeDeg: number,
  declinationDeg: number,
  geometricZenithDeg: number,
  hourAngleDeg: number
): number {
  const phiRad = degToRad(latitudeDeg);
  const deltaRad = degToRad(declinationDeg);
  const zRad = degToRad(geometricZenithDeg);
  const azDenom = Math.cos(phiRad) * Math.sin(zRad);

  if (Math.abs(azDenom) > 1e-6) {
    let cosAz = (Math.sin(phiRad) * Math.cos(zRad) - Math.sin(deltaRad)) / azDenom;
    cosAz = Math.max(-1.0, Math.min(1.0, cosAz));
    const azDeg = radToDeg(Math.acos(cosAz));
    if (hourAngleDeg > 0) {
      return (azDeg + 180.0) % 360.0;
    } else {
      return (540.0 - azDeg) % 360.0;
    }
  }

  // Directly overhead / underfoot: default toward equator
  return latitudeDeg >= 0 ? 180.0 : 0.0;
}

/**
 * Computes the solar coordinates bundle at a given instant and place.
 */
export function computeSolarCoordinates(instant: Instant, place: Place) {
  const t = instantToJulianCentury(instant);
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
  const trueSolarTimeMinutes = calcTrueSolarTime(instant, equationOfTimeMinutes, place.longitude);
  const hourAngleDeg = calcHourAngle(trueSolarTimeMinutes);

  const angles = calcSolarElevationAndZenith(place.latitude, declinationDeg, hourAngleDeg);
  const azimuthDeg = calcSolarAzimuth(
    place.latitude,
    declinationDeg,
    angles.geometricZenithDeg,
    hourAngleDeg
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
 * Solves the crossing time for a target geometric elevation angle on a given branch.
 *
 * @param place Geographic location
 * @param noon Instant of solar noon for the diurnal cycle
 * @param targetElevationDeg Target geometric elevation in degrees (e.g. -0.833° for sunrise/sunset, -6° for civil dawn/dusk)
 * @param direction 'rising' (morning branch [noon - 12h, noon]) or 'setting' (afternoon branch [noon, noon + 12h])
 */
export function findSolarCrossing(
  place: Place,
  noon: Instant,
  targetElevationDeg: number,
  direction: 'rising' | 'setting'
): Instant | null {
  const coordsNoon = computeSolarCoordinates(noon, place);
  const deltaRad = degToRad(coordsNoon.declinationDeg);
  const phiRad = degToRad(place.latitude);
  const hTargetRad = degToRad(targetElevationDeg);

  const cosH0 = (Math.sin(hTargetRad) - Math.sin(phiRad) * Math.sin(deltaRad)) / (Math.cos(phiRad) * Math.cos(deltaRad));

  // Check if crossing is geometrically impossible
  if (cosH0 > 1.0 || cosH0 < -1.0) {
    return null;
  }

  const h0Deg = radToDeg(Math.acos(Math.max(-1.0, Math.min(1.0, cosH0))));
  const halfDaySec = h0Deg * 240.0;

  const sign = direction === 'rising' ? -1 : 1;
  let currentNs = noon.epochNanoseconds + BigInt(Math.round(sign * halfDaySec * 1_000_000_000));

  // Refine crossing using bisection / secant root-finding
  for (let iter = 0; iter < 4; iter++) {
    const curInstant = Instant.fromEpochNanoseconds(currentNs);
    const coords = computeSolarCoordinates(curInstant, place);
    const errorDeg = coords.geometricElevationDeg - targetElevationDeg;
    if (Math.abs(errorDeg) < 1e-5) {
      break;
    }
    // Rate of change dh/dt ≈ cos(phi)*cos(delta)*sin(H) * (1/240 deg/sec)
    const curPhiRad = degToRad(place.latitude);
    const curDeltaRad = degToRad(coords.declinationDeg);
    const curHRad = degToRad(coords.hourAngleDeg);
    let dhDt = -Math.cos(curPhiRad) * Math.cos(curDeltaRad) * Math.sin(curHRad) / 240.0;
    if (Math.abs(dhDt) < 1e-6) {
      dhDt = direction === 'rising' ? 1.0 / 240.0 : -1.0 / 240.0;
    }
    const correctionSec = -errorDeg / dhDt;
    currentNs += BigInt(Math.round(correctionSec * 1_000_000_000));
  }

  return Instant.fromEpochNanoseconds(currentNs);
}
