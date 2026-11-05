/**
 * @file subsolar-point.ts
 * Geodetic subsolar point calculation consistent with TIME 2.0 Meeus/NOAA equations.
 */

import { Time, Instant, Place } from 'time-2.0';
import type { SubsolarPoint } from '../types.js';

const REFERENCE_EQUATOR = Time.place({
  latitude: 0,
  longitude: 0,
});

/**
 * Normalizes an angle in degrees into [-180, +180).
 */
export function normalizeLongitudeDeg(deg: number): number {
  let lon = deg % 360;
  if (lon >= 180) {
    lon -= 360;
  }
  if (lon < -180) {
    lon += 360;
  }
  // Eliminate -0.0
  return Object.is(lon, -0) ? 0 : lon;
}

/**
 * Calculates the exact geodetic subsolar coordinates (latitude, longitude) at a given Instant.
 *
 * Mathematical derivation from Meeus/NOAA conventions:
 * - Latitude phi_sun = delta (solar declination in degrees)
 * - Greenwich Hour Angle GHA = H - lambda (where H is local hour angle and lambda is observer longitude)
 * - Subsolar Longitude lambda_sun = -GHA = lambda - H
 *
 * This formula is invariant to the observer's longitude lambda.
 */
export function getSubsolarPoint(instant: Instant, observerPlace: Place = REFERENCE_EQUATOR): SubsolarPoint {
  const pos = Time.solar.evaluatePosition(instant, observerPlace);

  const latitudeDeg = pos.declinationDeg;
  const haDeg = pos.hourAngleDeg;
  const observerLon = observerPlace.longitude;

  // Greenwich Hour Angle (GHA) in degrees
  let gha = (haDeg - observerLon) % 360;
  if (gha < 0) {
    gha += 360;
  }

  // Subsolar longitude in [-180, +180)
  const longitudeDeg = normalizeLongitudeDeg(observerLon - haDeg);

  return {
    latitudeDeg,
    longitudeDeg,
    declinationDeg: latitudeDeg,
    greenwichHourAngleDeg: gha,
  };
}
