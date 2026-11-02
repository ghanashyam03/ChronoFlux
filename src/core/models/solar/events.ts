/**
 * @file events.ts
 * High-precision event finder for solar transitions (sunrise, sunset, noon, midnight, twilight).
 */

import { Duration } from '../../primitives/duration.js';
import { Instant } from '../../primitives/instant.js';
import {
  ASTRONOMICAL_TWILIGHT_ELEVATION_DEG,
  calcSolarMidnight,
  calcSolarNoon,
  CIVIL_TWILIGHT_ELEVATION_DEG,
  findSolarCrossing,
  NAUTICAL_TWILIGHT_ELEVATION_DEG,
  NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG,
} from './math.js';
import { SolarEventOptions } from './types.js';

const ONE_DAY_NS = 86_400_000_000_000n;

/**
 * Finds the next occurrence of a solar event strictly after the specified instant.
 *
 * @param options Query options specifying event name, location, anchor instant, and search limit.
 * @returns The Instant of the next event, or null if the event does not occur within searchLimitDays.
 */
export function findNextSolarEvent(options: SolarEventOptions): Instant | null {
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
    return noon.isBefore(maxInstant) || noon.equals(maxInstant) ? noon : null;
  }

  // 2. Solar Midnight: occurs every diurnal cycle
  if (event === 'solarMidnight') {
    let midnight = calcSolarMidnight(after, place.longitude);
    if (!midnight.isAfter(after)) {
      const nextDay = Instant.fromEpochNanoseconds(after.epochNanoseconds + ONE_DAY_NS);
      midnight = calcSolarMidnight(nextDay, place.longitude);
    }
    return midnight.isBefore(maxInstant) || midnight.equals(maxInstant) ? midnight : null;
  }

  // 3. Elevation crossings: sunrise, sunset, civilDawn, civilDusk, nauticalDawn, nauticalDusk, astronomicalDawn, astronomicalDusk
  let targetAngleDeg: number;
  let direction: 'rising' | 'setting';

  switch (event) {
    case 'sunrise':
      targetAngleDeg = NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG;
      direction = 'rising';
      break;
    case 'sunset':
      targetAngleDeg = NOMINAL_SUNRISE_SUNSET_ELEVATION_DEG;
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
        return crossing;
      }
      return null;
    }
  }

  return null;
}
