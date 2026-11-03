/**
 * @file solver-solar.ts
 * Continuous monotonic branch root-finding engine for astronomical solar conditions.
 * Partitions diurnal cycles by transit extrema (solar noon & midnight) into strictly monotonic
 * ascending and descending branches, and solves exact boundary crossings via Brent-Dekker root finding.
 */

import { Instant } from '../primitives/instant.js';
import { Interval } from '../primitives/interval.js';
import { IntervalSet } from '../primitives/interval-set.js';
import { Place } from '../primitives/place.js';
import {
  ASTRONOMICAL_TWILIGHT_ELEVATION_DEG,
  calcHorizonDip,
  calcSolarMidnight,
  calcSolarNoon,
  CIVIL_TWILIGHT_ELEVATION_DEG,
  computeSolarCoordinates,
  NAUTICAL_TWILIGHT_ELEVATION_DEG,
  NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG,
  solvePolarCrossingBracket,
} from '../models/solar/math.js';
import { evaluatePolarRegime } from '../models/solar/polar.js';
import { SolarComparisonNode, SolarProperty } from './ast.js';

const ONE_DAY_NS = 86_400_000_000_000n;
const TWELVE_HOURS_NS = 43_200_000_000_000n;
const SOLVER_TOLERANCE_DEG = 1e-5;

export interface SolarBoundaryProvenance {
  readonly instant: Instant;
  readonly boundaryType: 'start' | 'end';
  readonly property: SolarProperty;
  readonly thresholdDeg: number;
  readonly residualDeg: number;
  readonly toleranceDeg: number;
  readonly actualValueDeg: number;
  readonly reason: string;
  readonly conditionDescription: string;
}

/**
 * Finds all distinct solar noons covering the search window plus padding.
 */
function findDiurnalNoons(place: Place, window: Interval): readonly Instant[] {
  const startNs = window.start.epochNanoseconds - ONE_DAY_NS;
  const endNs = window.end.epochNanoseconds + ONE_DAY_NS;
  const noons: Instant[] = [];

  for (let anchorNs = startNs; anchorNs <= endNs + ONE_DAY_NS; anchorNs += ONE_DAY_NS) {
    const anchor = Instant.fromEpochNanoseconds(anchorNs);
    const noon = calcSolarNoon(anchor, place.longitude);

    if (
      noons.length === 0 ||
      noon.epochNanoseconds - noons[noons.length - 1]!.epochNanoseconds > TWELVE_HOURS_NS
    ) {
      noons.push(noon);
    }
  }

  return noons;
}

/**
 * Solves scalar geometric elevation >= thresholdDeg across the search window.
 */
function solveElevationGte(
  place: Place,
  window: Interval,
  thresholdDeg: number,
  boundaryRecordMap?: Map<string, SolarBoundaryProvenance>
): IntervalSet {
  const noons = findDiurnalNoons(place, window);
  const cycleIntervals: Interval[] = [];

  for (const noon of noons) {
    const mid1 = calcSolarMidnight(
      Instant.fromEpochNanoseconds(noon.epochNanoseconds - TWELVE_HOURS_NS),
      place.longitude
    );
    const mid2 = calcSolarMidnight(
      Instant.fromEpochNanoseconds(noon.epochNanoseconds + TWELVE_HOURS_NS),
      place.longitude
    );

    // Skip cycles entirely outside search window
    if (mid2.epochNanoseconds <= window.start.epochNanoseconds || mid1.epochNanoseconds >= window.end.epochNanoseconds) {
      continue;
    }

    const hNoon = computeSolarCoordinates(noon, place).geometricElevationDeg;
    const hMid1 = computeSolarCoordinates(mid1, place).geometricElevationDeg;
    const hMid2 = computeSolarCoordinates(mid2, place).geometricElevationDeg;

    // Case 1: Sun never reaches threshold (Polar Night or threshold above noon)
    if (thresholdDeg > hNoon + SOLVER_TOLERANCE_DEG) {
      continue;
    }

    // Case 2: Sun never drops below threshold (Polar Day / Midnight Sun)
    if (hMid1 >= thresholdDeg - SOLVER_TOLERANCE_DEG && hMid2 >= thresholdDeg - SOLVER_TOLERANCE_DEG) {
      cycleIntervals.push(new Interval(mid1, mid2));
      continue;
    }

    // Case 3: Diurnal crossings on ascending [mid1, noon] and descending [noon, mid2] branches
    let tStart: Instant | null = null;
    let tEnd: Instant | null = null;

    // --- Ascending branch [mid1, noon] ---
    if (hMid1 >= thresholdDeg) {
      tStart = mid1;
    } else {
      const solveRes = solvePolarCrossingBracket(
        place,
        mid1.epochNanoseconds,
        noon.epochNanoseconds,
        thresholdDeg,
        50,
        SOLVER_TOLERANCE_DEG
      );
      if (solveRes.status === 'converged' && solveRes.isResidualVerified) {
        tStart = solveRes.crossingInstant;
        if (boundaryRecordMap) {
          boundaryRecordMap.set(`start:${tStart.epochNanoseconds}`, {
            instant: tStart,
            boundaryType: 'start',
            property: 'elevation',
            thresholdDeg,
            residualDeg: solveRes.residualDeg,
            toleranceDeg: SOLVER_TOLERANCE_DEG,
            actualValueDeg: computeSolarCoordinates(tStart, place).geometricElevationDeg,
            reason: `Solar elevation crossed threshold ${thresholdDeg.toFixed(2)}° (rising) with numerical residual ${solveRes.residualDeg.toExponential(2)}°.`,
            conditionDescription: `solar.elevation >= ${thresholdDeg.toFixed(2)}°`,
          });
        }
      }
    }

    // --- Descending branch [noon, mid2] ---
    if (hMid2 >= thresholdDeg) {
      tEnd = mid2;
    } else {
      const solveRes = solvePolarCrossingBracket(
        place,
        noon.epochNanoseconds,
        mid2.epochNanoseconds,
        thresholdDeg,
        50,
        SOLVER_TOLERANCE_DEG
      );
      if (solveRes.status === 'converged' && solveRes.isResidualVerified) {
        tEnd = solveRes.crossingInstant;
        if (boundaryRecordMap) {
          boundaryRecordMap.set(`end:${tEnd.epochNanoseconds}`, {
            instant: tEnd,
            boundaryType: 'end',
            property: 'elevation',
            thresholdDeg,
            residualDeg: solveRes.residualDeg,
            toleranceDeg: SOLVER_TOLERANCE_DEG,
            actualValueDeg: computeSolarCoordinates(tEnd, place).geometricElevationDeg,
            reason: `Solar elevation dropped below threshold ${thresholdDeg.toFixed(2)}° (setting) with numerical residual ${solveRes.residualDeg.toExponential(2)}°.`,
            conditionDescription: `solar.elevation < ${thresholdDeg.toFixed(2)}°`,
          });
        }
      }
    }

    // Add valid half-open interval, cleanly dropping tangential grazes where tStart == tEnd
    if (tStart !== null && tEnd !== null && tStart.isBefore(tEnd)) {
      cycleIntervals.push(new Interval(tStart, tEnd));
    }
  }

  if (cycleIntervals.length === 0) {
    return IntervalSet.empty();
  }

  return IntervalSet.from(cycleIntervals).intersect(window);
}

/**
 * Solves solar elevation conditions for any comparison operator.
 */
function solveElevationCondition(
  node: SolarComparisonNode,
  place: Place,
  window: Interval,
  boundaryRecordMap?: Map<string, SolarBoundaryProvenance>
): IntervalSet {
  const { operator, value, unit } = node;
  const toDeg = (v: number) => (unit === 'rad' ? (v * 180.0) / Math.PI : v);

  switch (operator) {
    case 'gte':
    case 'gt': {
      const threshold = toDeg(value as number);
      return solveElevationGte(place, window, threshold, boundaryRecordMap);
    }
    case 'lte':
    case 'lt': {
      const threshold = toDeg(value as number);
      const gteSet = solveElevationGte(place, window, threshold, boundaryRecordMap);
      return gteSet.complement(window);
    }
    case 'between': {
      const [minVal, maxVal] = value as readonly [number, number];
      const minDeg = toDeg(minVal);
      const maxDeg = toDeg(maxVal);
      if (minDeg > maxDeg) {
        return IntervalSet.empty();
      }
      const gteMin = solveElevationGte(place, window, minDeg, boundaryRecordMap);
      const gteMax = solveElevationGte(place, window, maxDeg, boundaryRecordMap);
      const lteMax = gteMax.complement(window);
      return gteMin.intersect(lteMax);
    }
    case 'eq':
      // Continuous scalar equality has measure zero in half-open intervals
      return IntervalSet.empty();
    case 'neq':
      return IntervalSet.fromInterval(window);
    case 'in':
      return IntervalSet.empty();
    default:
      throw new TypeError(`Unsupported solar elevation operator: ${operator}`);
  }
}

/**
 * Solves solar zenith conditions by transforming to elevation: zenith = 90° - elevation.
 */
function solveZenithCondition(
  node: SolarComparisonNode,
  place: Place,
  window: Interval,
  boundaryRecordMap?: Map<string, SolarBoundaryProvenance>
): IntervalSet {
  const { operator, value, unit } = node;
  const toDeg = (v: number) => (unit === 'rad' ? (v * 180.0) / Math.PI : v);

  switch (operator) {
    case 'lte':
    case 'lt': {
      // zenith <= Z  <=>  elevation >= 90 - Z
      const elevThreshold = 90.0 - toDeg(value as number);
      return solveElevationGte(place, window, elevThreshold, boundaryRecordMap);
    }
    case 'gte':
    case 'gt': {
      // zenith >= Z  <=>  elevation <= 90 - Z
      const elevThreshold = 90.0 - toDeg(value as number);
      const gteSet = solveElevationGte(place, window, elevThreshold, boundaryRecordMap);
      return gteSet.complement(window);
    }
    case 'between': {
      const [minZ, maxZ] = value as readonly [number, number];
      const minZDeg = toDeg(minZ);
      const maxZDeg = toDeg(maxZ);
      // zenith in [minZ, maxZ] <=> elevation in [90 - maxZ, 90 - minZ]
      const minElev = 90.0 - maxZDeg;
      const maxElev = 90.0 - minZDeg;
      const gteMin = solveElevationGte(place, window, minElev, boundaryRecordMap);
      const gteMax = solveElevationGte(place, window, maxElev, boundaryRecordMap);
      return gteMin.intersect(gteMax.complement(window));
    }
    case 'eq':
      return IntervalSet.empty();
    case 'neq':
      return IntervalSet.fromInterval(window);
    case 'in':
      return IntervalSet.empty();
    default:
      throw new TypeError(`Unsupported solar zenith operator: ${operator}`);
  }
}

/**
 * Solves direct sunlight conditions: geometric elevation >= -0.8333° - d_dip.
 */
function solveDirectSunlightCondition(
  node: SolarComparisonNode,
  place: Place,
  window: Interval,
  boundaryRecordMap?: Map<string, SolarBoundaryProvenance>
): IntervalSet {
  const horizonDip = calcHorizonDip(place.elevationMeters);
  const targetThreshold = NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG - horizonDip;
  const isDirect = node.value === true;

  if (node.operator === 'eq') {
    if (isDirect) {
      return solveElevationGte(place, window, targetThreshold, boundaryRecordMap);
    }
    return solveElevationGte(place, window, targetThreshold, boundaryRecordMap).complement(window);
  }
  if (node.operator === 'neq') {
    if (isDirect) {
      return solveElevationGte(place, window, targetThreshold, boundaryRecordMap).complement(window);
    }
    return solveElevationGte(place, window, targetThreshold, boundaryRecordMap);
  }

  throw new TypeError(`Unsupported operator for isDirectSunlight: ${node.operator}`);
}

/**
 * Solves solar phase conditions (day, civil_twilight, nautical_twilight, astronomical_twilight, night).
 */
function solvePhaseCondition(
  node: SolarComparisonNode,
  place: Place,
  window: Interval,
  boundaryRecordMap?: Map<string, SolarBoundaryProvenance>
): IntervalSet {
  const horizonDip = calcHorizonDip(place.elevationMeters);
  const dayThreshold = NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG - horizonDip;

  function setForPhase(phase: string): IntervalSet {
    switch (phase) {
      case 'day':
        return solveElevationGte(place, window, dayThreshold, boundaryRecordMap);
      case 'civil_twilight': {
        const gteCivil = solveElevationGte(place, window, CIVIL_TWILIGHT_ELEVATION_DEG, boundaryRecordMap);
        const gteDay = solveElevationGte(place, window, dayThreshold, boundaryRecordMap);
        return gteCivil.intersect(gteDay.complement(window));
      }
      case 'nautical_twilight': {
        const gteNautical = solveElevationGte(place, window, NAUTICAL_TWILIGHT_ELEVATION_DEG, boundaryRecordMap);
        const gteCivil = solveElevationGte(place, window, CIVIL_TWILIGHT_ELEVATION_DEG, boundaryRecordMap);
        return gteNautical.intersect(gteCivil.complement(window));
      }
      case 'astronomical_twilight': {
        const gteAstro = solveElevationGte(place, window, ASTRONOMICAL_TWILIGHT_ELEVATION_DEG, boundaryRecordMap);
        const gteNautical = solveElevationGte(place, window, NAUTICAL_TWILIGHT_ELEVATION_DEG, boundaryRecordMap);
        return gteAstro.intersect(gteNautical.complement(window));
      }
      case 'night': {
        const gteAstro = solveElevationGte(place, window, ASTRONOMICAL_TWILIGHT_ELEVATION_DEG, boundaryRecordMap);
        return gteAstro.complement(window);
      }
      default:
        throw new TypeError(`Unknown solar phase: ${phase}`);
    }
  }

  if (node.operator === 'eq') {
    return setForPhase(String(node.value));
  }
  if (node.operator === 'neq') {
    return setForPhase(String(node.value)).complement(window);
  }
  if (node.operator === 'in') {
    const list = Array.isArray(node.value) ? node.value : [node.value];
    let result = IntervalSet.empty();
    for (const p of list) {
      result = result.union(setForPhase(String(p)));
    }
    return result;
  }

  throw new TypeError(`Unsupported operator for phase: ${node.operator}`);
}

/**
 * Solves polar regime conditions ('none' | 'polar_day' | 'polar_night').
 */
function solvePolarRegimeCondition(
  node: SolarComparisonNode,
  place: Place,
  window: Interval
): IntervalSet {
  const targetRegime = String(node.value);
  const noons = findDiurnalNoons(place, window);
  const intervals: Interval[] = [];

  for (const noon of noons) {
    const mid1 = calcSolarMidnight(
      Instant.fromEpochNanoseconds(noon.epochNanoseconds - TWELVE_HOURS_NS),
      place.longitude
    );
    const mid2 = calcSolarMidnight(
      Instant.fromEpochNanoseconds(noon.epochNanoseconds + TWELVE_HOURS_NS),
      place.longitude
    );

    const regime = evaluatePolarRegime(place, noon);
    const matches =
      node.operator === 'eq'
        ? regime.polarRegime === targetRegime
        : node.operator === 'neq'
        ? regime.polarRegime !== targetRegime
        : false;

    if (matches) {
      intervals.push(new Interval(mid1, mid2));
    }
  }

  return IntervalSet.from(intervals).intersect(window);
}

/**
 * Continuous root finding for azimuth conditions.
 */
function solveAzimuthCondition(
  node: SolarComparisonNode,
  place: Place,
  window: Interval
): IntervalSet {
  const { operator, value, unit } = node;
  const toDeg = (v: number) => {
    let d = unit === 'rad' ? (v * 180.0) / Math.PI : v;
    d = d % 360;
    return d < 0 ? d + 360 : d;
  };

  // Sample azimuth in 30-minute steps across search window to locate candidate crossing brackets
  const stepNs = 1_800_000_000_000n; // 30 minutes
  const matchingIntervals: Interval[] = [];

  function matches(azimuth: number): boolean {
    switch (operator) {
      case 'gte':
        return azimuth >= toDeg(value as number);
      case 'gt':
        return azimuth > toDeg(value as number);
      case 'lte':
        return azimuth <= toDeg(value as number);
      case 'lt':
        return azimuth < toDeg(value as number);
      case 'between': {
        const [minV, maxV] = value as readonly [number, number];
        const minD = toDeg(minV);
        const maxD = toDeg(maxV);
        if (minD <= maxD) {
          return azimuth >= minD && azimuth <= maxD;
        }
        // Wrapping range e.g. [350, 10]
        return azimuth >= minD || azimuth <= maxD;
      }
      case 'eq':
        return false;
      case 'neq':
        return true;
      default:
        return false;
    }
  }

  let inMatch = false;
  let matchStart: Instant | null = null;
  const startNs = window.start.epochNanoseconds;
  const endNs = window.end.epochNanoseconds;

  for (let currentNs = startNs; currentNs < endNs; currentNs += stepNs) {
    const curInstant = Instant.fromEpochNanoseconds(currentNs);
    const coords = computeSolarCoordinates(curInstant, place);
    const curMatch = coords.azimuthDeg !== null && matches(coords.azimuthDeg);

    if (curMatch && !inMatch) {
      inMatch = true;
      matchStart = curInstant;
    } else if (!curMatch && inMatch) {
      inMatch = false;
      if (matchStart !== null && matchStart.isBefore(curInstant)) {
        matchingIntervals.push(new Interval(matchStart, curInstant));
      }
      matchStart = null;
    }
  }

  if (inMatch && matchStart !== null && matchStart.isBefore(window.end)) {
    matchingIntervals.push(new Interval(matchStart, window.end));
  }

  return IntervalSet.from(matchingIntervals);
}

/**
 * Main dispatcher for all solar conditions.
 */
export function solveSolarCondition(
  node: SolarComparisonNode,
  place: Place,
  window: Interval,
  boundaryRecordMap?: Map<string, SolarBoundaryProvenance>
): IntervalSet {
  switch (node.property) {
    case 'elevation':
      return solveElevationCondition(node, place, window, boundaryRecordMap);
    case 'zenith':
      return solveZenithCondition(node, place, window, boundaryRecordMap);
    case 'isDirectSunlight':
      return solveDirectSunlightCondition(node, place, window, boundaryRecordMap);
    case 'phase':
      return solvePhaseCondition(node, place, window, boundaryRecordMap);
    case 'polarRegime':
      return solvePolarRegimeCondition(node, place, window);
    case 'azimuth':
      return solveAzimuthCondition(node, place, window);
    default:
      throw new TypeError(`Unsupported solar property: ${node.property}`);
  }
}
