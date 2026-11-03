/**
 * @file events.ts
 * High-precision event finder for solar transitions (sunrise, sunset, noon, midnight, twilight).
 */

import { Duration } from '../../primitives/duration.js';
import { Instant } from '../../primitives/instant.js';
import { Place } from '../../primitives/place.js';
import {
  ASTRONOMICAL_TWILIGHT_ELEVATION_DEG,
  calcHorizonDip,
  calcSolarCrossingDetails,
  calcSolarMidnight,
  calcSolarNoon,
  CIVIL_TWILIGHT_ELEVATION_DEG,
  computeSolarCoordinates,
  findSolarCrossing,
  NAUTICAL_TWILIGHT_ELEVATION_DEG,
  NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG,
  SOLAR_MODEL_VALIDITY_RANGE,
} from './math.js';
import { SolarEventInstant, SolarEventName, SolarEventOptions, SolarUncertaintyDetails } from './types.js';

const ONE_DAY_NS = 86_400_000_000_000n;

function createEventInstant(
  instant: Instant,
  event: SolarEventName,
  place: Place
): SolarEventInstant {
  const coords = computeSolarCoordinates(instant, place);
  const isWithinValidityRange = SOLAR_MODEL_VALIDITY_RANGE.contains(instant);
  const isAccuracyDegraded = !isWithinValidityRange;

  let eventUncertainty: SolarUncertaintyDetails = coords.uncertainty;
  let crossingCondition = coords.uncertainty.crossingCondition;
  let eventTimeUncertaintyMinutes = coords.uncertainty.eventTimeUncertaintyMinutes;

  if (event !== 'solarNoon' && event !== 'solarMidnight') {
    const horizonDip = calcHorizonDip(place.elevationMeters);
    let targetElev: number;
    switch (event) {
      case 'sunrise':
      case 'sunset':
        targetElev = NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG - horizonDip;
        break;
      case 'civilDawn':
      case 'civilDusk':
        targetElev = CIVIL_TWILIGHT_ELEVATION_DEG;
        break;
      case 'nauticalDawn':
      case 'nauticalDusk':
        targetElev = NAUTICAL_TWILIGHT_ELEVATION_DEG;
        break;
      case 'astronomicalDawn':
      case 'astronomicalDusk':
        targetElev = ASTRONOMICAL_TWILIGHT_ELEVATION_DEG;
        break;
      default:
        targetElev = NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG;
    }
    const crossingDetails = calcSolarCrossingDetails(place, instant, targetElev);
    eventTimeUncertaintyMinutes = crossingDetails.uncertaintyMinutes;
    crossingCondition = crossingDetails.crossingCondition;
    eventUncertainty = Object.freeze({
      ...coords.uncertainty,
      eventTimeUncertaintyMinutes: crossingDetails.uncertaintyMinutes,
      crossingCondition: crossingDetails.crossingCondition,
      sunriseUncertaintyMinutes: event === 'sunrise' ? crossingDetails.uncertaintyMinutes : null,
      sunsetUncertaintyMinutes: event === 'sunset' ? crossingDetails.uncertaintyMinutes : null,
    });
  } else {
    eventUncertainty = Object.freeze({
      ...coords.uncertainty,
      eventTimeUncertaintyMinutes: coords.uncertainty.eventTimeUncertaintyMinutes,
    });
  }

  return new SolarEventInstant(instant.epochNanoseconds, {
    event,
    isWithinValidityRange,
    isAccuracyDegraded,
    uncertaintyDeg: coords.uncertainty.combinedCoordinateUncertaintyDeg,
    uncertaintyMinutes: eventTimeUncertaintyMinutes,
    uncertainty: eventUncertainty,
    crossingCondition,
  });
}

/**
 * Finds the next occurrence of a solar event strictly after the specified instant.
 *
 * @param options Query options specifying event name, location, anchor instant, and search limit.
 * @returns The SolarEventInstant of the next event, or null if the event does not occur within searchLimitDays.
 */
export function findNextSolarEvent(options: SolarEventOptions): SolarEventInstant | null {
  const { event, place, after, searchLimitDays = 365 } = options;

  if (typeof searchLimitDays !== 'number' || !Number.isFinite(searchLimitDays) || searchLimitDays <= 0) {
    return null;
  }

  // Phase 1.1 numeric hardening: fractional searchLimitDays requires explicit RoundingMode
  const maxDuration = Duration.fromDays(searchLimitDays, 'ceil');
  const maxInstant = after.add(maxDuration);

  // 1. Solar Noon: occurs every diurnal cycle
  if (event === 'solarNoon') {
    let noon = calcSolarNoon(after, place.longitude);
    if (!noon.isAfter(after)) {
      const nextDay = Instant.fromEpochNanoseconds(after.epochNanoseconds + ONE_DAY_NS);
      noon = calcSolarNoon(nextDay, place.longitude);
    }
    if (noon.isBefore(maxInstant) || noon.equals(maxInstant)) {
      return createEventInstant(noon, 'solarNoon', place);
    }
    return null;
  }

  // 2. Solar Midnight: occurs every diurnal cycle
  if (event === 'solarMidnight') {
    let midnight = calcSolarMidnight(after, place.longitude);
    if (!midnight.isAfter(after)) {
      const nextDay = Instant.fromEpochNanoseconds(after.epochNanoseconds + ONE_DAY_NS);
      midnight = calcSolarMidnight(nextDay, place.longitude);
    }
    if (midnight.isBefore(maxInstant) || midnight.equals(maxInstant)) {
      return createEventInstant(midnight, 'solarMidnight', place);
    }
    return null;
  }

  // 3. Elevation crossings: sunrise, sunset, civilDawn, civilDusk, nauticalDawn, nauticalDusk, astronomicalDawn, astronomicalDusk
  let targetAngleDeg: number;
  let direction: 'rising' | 'setting';

  switch (event) {
    case 'sunrise':
      targetAngleDeg = NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG - calcHorizonDip(place.elevationMeters);
      direction = 'rising';
      break;
    case 'sunset':
      targetAngleDeg = NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG - calcHorizonDip(place.elevationMeters);
      direction = 'setting';
      break;
    case 'civilDawn':
      targetAngleDeg = CIVIL_TWILIGHT_ELEVATION_DEG;
      direction = 'rising';
      break;
    case 'civilDusk':
      targetAngleDeg = CIVIL_TWILIGHT_ELEVATION_DEG;
      direction = 'setting';
      break;
    case 'nauticalDawn':
      targetAngleDeg = NAUTICAL_TWILIGHT_ELEVATION_DEG;
      direction = 'rising';
      break;
    case 'nauticalDusk':
      targetAngleDeg = NAUTICAL_TWILIGHT_ELEVATION_DEG;
      direction = 'setting';
      break;
    case 'astronomicalDawn':
      targetAngleDeg = ASTRONOMICAL_TWILIGHT_ELEVATION_DEG;
      direction = 'rising';
      break;
    case 'astronomicalDusk':
      targetAngleDeg = ASTRONOMICAL_TWILIGHT_ELEVATION_DEG;
      direction = 'setting';
      break;
    default:
      return null;
  }

  const limitDaysInt = Math.ceil(searchLimitDays);

  for (let day = 0; day <= limitDaysInt; day++) {
    const dayAnchorNs = after.epochNanoseconds + BigInt(day) * ONE_DAY_NS;
    const dayAnchor = Instant.fromEpochNanoseconds(dayAnchorNs);
    const noon = calcSolarNoon(dayAnchor, place.longitude);

    const crossing = findSolarCrossing(place, noon, targetAngleDeg, direction);
    if (crossing !== null && crossing.isAfter(after)) {
      if (crossing.isBefore(maxInstant) || crossing.equals(maxInstant)) {
        return createEventInstant(crossing, event, place);
      }
      return null;
    }
  }

  return null;
}
