/**
 * @file civil-model.ts
 * IANA Time Zone and Civil Calendar temporal model implementing TemporalModel<CivilState>.
 */

import { Duration } from '../../primitives/duration.js';
import { Instant } from '../../primitives/instant.js';
import { Place } from '../../primitives/place.js';
import { ModelMetadata, TemporalModel } from '../model.js';
import { resolveCivilDateTimeToInstant } from './disambiguation.js';
import { CivilDateTimeInput, CivilState } from './types.js';

export const CIVIL_MODEL_METADATA: ModelMetadata = Object.freeze({
  name: 'Civil Calendar & IANA Time Zone Model',
  version: '1.0.0',
  accuracy: Object.freeze({
    timeResolution: Duration.fromNanoseconds(1),
    marginOfError: 'Exact integer representation (0 numerical error)',
  }),
  assumptions: Object.freeze([
    'IANA Time Zone Database rules evaluated via ECMAScript Intl / TC39 Temporal engine',
    'Standard Gregorian calendar conventions',
    'Contextual separation of geographic coordinates from political time zone definitions',
  ]),
});

interface LocalParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  readonly millisecond: number;
  readonly offsetMs: number;
}

function extractLocalParts(epochMs: number, timeZoneId: string): LocalParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timeZoneId,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    fractionalSecondDigits: 3,
    hourCycle: 'h23',
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(epochMs)).map((p) => [p.type, p.value])
  );

  const year = Number(parts['year']);
  const month = Number(parts['month']);
  const day = Number(parts['day']);
  const hour = Number(parts['hour']);
  const minute = Number(parts['minute']);
  const second = Number(parts['second']);
  const millisecond = Number(parts['fractionalSecond']);

  const utcForCivil = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const offsetMs = utcForCivil - epochMs;

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    millisecond,
    offsetMs,
  };
}

/**
 * Evaluates whether Daylight Saving Time is actively in effect by comparing the current offset
 * against the minimum (standard) offset across seasonal solstices (Jan 15 and Jul 15) for that year.
 */
function isDstActive(currentOffsetMs: number, timeZoneId: string, year: number): boolean {
  const janOffset = extractLocalParts(Date.UTC(year, 0, 15, 12, 0, 0), timeZoneId).offsetMs;
  const julOffset = extractLocalParts(Date.UTC(year, 6, 15, 12, 0, 0), timeZoneId).offsetMs;
  const standardOffsetMs = Math.min(janOffset, julOffset);
  return currentOffsetMs > standardOffsetMs;
}

/**
 * Checks if the current instant falls inside an ambiguous repeated hour (fall-back transition).
 */
function checkIsAmbiguous(
  epochMs: number,
  current: LocalParts,
  timeZoneId: string
): boolean {
  // Probe offsets 2 hours before and 2 hours after
  const beforeProbe = extractLocalParts(epochMs - 7_200_000, timeZoneId);
  if (beforeProbe.offsetMs !== current.offsetMs) {
    const diffMs = beforeProbe.offsetMs - current.offsetMs;
    const alt = extractLocalParts(epochMs - diffMs, timeZoneId);
    if (
      alt.year === current.year &&
      alt.month === current.month &&
      alt.day === current.day &&
      alt.hour === current.hour &&
      alt.minute === current.minute &&
      alt.second === current.second
    ) {
      return true;
    }
  }

  const afterProbe = extractLocalParts(epochMs + 7_200_000, timeZoneId);
  if (afterProbe.offsetMs !== current.offsetMs) {
    const diffMs = afterProbe.offsetMs - current.offsetMs;
    const alt = extractLocalParts(epochMs - diffMs, timeZoneId);
    if (
      alt.year === current.year &&
      alt.month === current.month &&
      alt.day === current.day &&
      alt.hour === current.hour &&
      alt.minute === current.minute &&
      alt.second === current.second
    ) {
      return true;
    }
  }

  return false;
}

/**
 * CivilModel provides IANA time zone evaluation, calendar conversions,
 * and DST transition disambiguation.
 */
export class CivilModel implements TemporalModel<CivilState> {
  readonly metadata: ModelMetadata = CIVIL_MODEL_METADATA;

  /**
   * Evaluates local civil calendar state for a given Instant and Place (or time zone identifier).
   */
  evaluate(instant: Instant, placeOrTimeZone: Place | string): CivilState {
    let timeZoneId: string;
    if (typeof placeOrTimeZone === 'string') {
      timeZoneId = placeOrTimeZone.trim();
    } else if (placeOrTimeZone instanceof Place) {
      timeZoneId = placeOrTimeZone.timeZoneId ?? 'UTC';
    } else {
      throw new TypeError(
        'placeOrTimeZone must be a valid Place instance or IANA timeZoneId string'
      );
    }

    return this.evaluateTimeZone(instant, timeZoneId);
  }

  /**
   * Evaluates local civil calendar state for a given Instant in an explicit IANA time zone.
   */
  evaluateTimeZone(instant: Instant, timeZoneId: string): CivilState {
    if (typeof timeZoneId !== 'string' || timeZoneId.trim().length === 0) {
      throw new TypeError(`timeZoneId must be a non-empty string, received: ${timeZoneId}`);
    }
    const cleanTz = timeZoneId.trim();

    // Validate IANA timezone
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: cleanTz });
    } catch {
      throw new RangeError(`Unknown or invalid IANA time zone identifier: '${cleanTz}'`);
    }

    const epochNs = instant.epochNanoseconds;
    const epochMs = Number(epochNs / 1_000_000n);
    const subMsNs = Number(epochNs % 1_000_000n);
    const nanosecond = subMsNs >= 0 ? subMsNs : 1_000_000 + subMsNs;

    const local = extractLocalParts(epochMs, cleanTz);
    const isDaylightSaving = isDstActive(local.offsetMs, cleanTz, local.year);
    const isAmbiguous = checkIsAmbiguous(epochMs, local, cleanTz);

    const state: CivilState = Object.freeze({
      year: local.year,
      month: local.month,
      day: local.day,
      hour: local.hour,
      minute: local.minute,
      second: local.second,
      millisecond: local.millisecond,
      nanosecond,
      timeZoneId: cleanTz,
      utcOffset: Duration.fromMilliseconds(local.offsetMs),
      utcOffsetMinutes: local.offsetMs / 60000,
      isDaylightSaving,
      transition: Object.freeze({
        isAmbiguous,
        isNonExistent: false, // Evaluated physical instants always exist
      }),
    });

    return state;
  }

  /**
   * Resolves a civil calendar date/time into an unambiguous physical Instant
   * using DST disambiguation rules ('compatible', 'earlier', 'later', 'reject').
   */
  resolve(input: CivilDateTimeInput): Instant {
    return resolveCivilDateTimeToInstant(input);
  }
}

/**
 * Frozen singleton instance of CivilModel.
 */
export const civilModel = Object.freeze(new CivilModel());
