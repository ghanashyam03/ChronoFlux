/**
 * @file disambiguation.ts
 * Daylight Saving Time (DST) disambiguation engine for resolving civil wall-clock timestamps
 * into unambiguous physical Instants.
 */

import { Instant } from '../../primitives/instant.js';
import { CivilDateTimeInput, DisambiguationPolicy } from './types.js';

function validateIntRange(name: string, val: number, min: number, max: number): void {
  if (typeof val !== 'number' || !Number.isSafeInteger(val)) {
    throw new TypeError(`${name} must be a safe integer, received: ${val}`);
  }
  if (val < min || val > max) {
    throw new RangeError(`${name} must be between ${min} and ${max}, received: ${val}`);
  }
}

function daysInMonth(year: number, month: number): number {
  switch (month) {
    case 2:
      return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    default:
      return 31;
  }
}

interface OffsetProbe {
  readonly localMs: number;
  readonly offsetMs: number;
}

function getIntlOffsetProbe(date: Date, timeZoneId: string): OffsetProbe {
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

  const parts = Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]));
  const localMs = Date.UTC(
    Number(parts['year']),
    Number(parts['month']) - 1,
    Number(parts['day']),
    Number(parts['hour']),
    Number(parts['minute']),
    Number(parts['second']),
    Number(parts['fractionalSecond'])
  );

  return {
    localMs,
    offsetMs: localMs - date.getTime(),
  };
}

/**
 * Pure Intl-based disambiguation resolution algorithm.
 */
function resolveWithIntl(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
  nanosecond: number,
  timeZoneId: string,
  policy: DisambiguationPolicy
): Instant {
  const targetLocalMs = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);

  // Probe potential offsets in the vicinity
  const est0 = getIntlOffsetProbe(new Date(targetLocalMs), timeZoneId).offsetMs;
  const c1 = targetLocalMs - est0;
  const o1 = getIntlOffsetProbe(new Date(c1), timeZoneId).offsetMs;
  const c2 = targetLocalMs - o1;
  const o2 = getIntlOffsetProbe(new Date(c2), timeZoneId).offsetMs;
  const oBefore = getIntlOffsetProbe(new Date(c1 - 86_400_000), timeZoneId).offsetMs;
  const oAfter = getIntlOffsetProbe(new Date(c1 + 86_400_000), timeZoneId).offsetMs;

  const candidateOffsets = Array.from(new Set([est0, o1, o2, oBefore, oAfter])).sort(
    (a, b) => a - b
  );

  const validInstants: number[] = [];
  for (const off of candidateOffsets) {
    const candidateUtcMs = targetLocalMs - off;
    const probe = getIntlOffsetProbe(new Date(candidateUtcMs), timeZoneId);
    if (probe.localMs === targetLocalMs) {
      if (!validInstants.includes(candidateUtcMs)) {
        validInstants.push(candidateUtcMs);
      }
    }
  }

  validInstants.sort((a, b) => a - b);

  // Case 1: Exactly 1 unambiguous instant
  if (validInstants.length === 1) {
    const epochNs = BigInt(validInstants[0]!) * 1_000_000n + BigInt(nanosecond);
    return Instant.fromEpochNanoseconds(epochNs);
  }

  // Case 2: Ambiguous (repeated hour during fall-back)
  if (validInstants.length >= 2) {
    if (policy === 'reject') {
      throw new RangeError(
        `Civil wall-clock time ${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ` +
          `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')} ` +
          `is ambiguous in time zone '${timeZoneId}' due to Daylight Saving Time fall-back.`
      );
    }
    const chosenMs = policy === 'later' ? validInstants[validInstants.length - 1]! : validInstants[0]!;
    const epochNs = BigInt(chosenMs) * 1_000_000n + BigInt(nanosecond);
    return Instant.fromEpochNanoseconds(epochNs);
  }

  // Case 3: Nonexistent (skipped hour during spring-forward)
  if (policy === 'reject') {
    throw new RangeError(
      `Civil wall-clock time ${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ` +
        `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')} ` +
        `does not exist in time zone '${timeZoneId}' due to Daylight Saving Time spring-forward.`
    );
  }

  // Find the earlier and later offsets that flank the gap
  const earlierOffset = candidateOffsets[0]!;
  const laterOffset = candidateOffsets[candidateOffsets.length - 1]!;
  const gapMs = Math.abs(laterOffset - earlierOffset);

  let chosenMs: number;
  if (policy === 'earlier') {
    // Move before the gap
    chosenMs = targetLocalMs - gapMs - earlierOffset;
  } else {
    // 'compatible' or 'later': advance past the gap
    chosenMs = targetLocalMs + gapMs - laterOffset;
  }

  const epochNs = BigInt(chosenMs) * 1_000_000n + BigInt(nanosecond);
  return Instant.fromEpochNanoseconds(epochNs);
}

/**
 * Resolves a local civil calendar date/time in an IANA time zone to a physical Instant,
 * handling DST transitions according to the specified disambiguation policy.
 */
export function resolveCivilDateTimeToInstant(input: CivilDateTimeInput): Instant {
  const {
    year,
    month,
    day,
    hour = 0,
    minute = 0,
    second = 0,
    millisecond = 0,
    nanosecond = 0,
    timeZoneId,
    disambiguation = 'compatible',
  } = input;

  // Validate fields
  validateIntRange('year', year, -270000, 270000);
  validateIntRange('month', month, 1, 12);
  const maxDay = daysInMonth(year, month);
  validateIntRange('day', day, 1, maxDay);
  validateIntRange('hour', hour, 0, 23);
  validateIntRange('minute', minute, 0, 59);
  validateIntRange('second', second, 0, 59);
  validateIntRange('millisecond', millisecond, 0, 999);
  validateIntRange('nanosecond', nanosecond, 0, 999999);

  if (typeof timeZoneId !== 'string' || timeZoneId.trim().length === 0) {
    throw new TypeError(`timeZoneId must be a non-empty string, received: ${timeZoneId}`);
  }

  const validPolicies = new Set(['compatible', 'earlier', 'later', 'reject']);
  if (!validPolicies.has(disambiguation)) {
    throw new TypeError(
      `Invalid disambiguation policy: '${disambiguation}'. Allowed: 'compatible' | 'earlier' | 'later' | 'reject'`
    );
  }

  // Validate IANA timezone
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timeZoneId });
  } catch {
    throw new RangeError(`Unknown or invalid IANA time zone identifier: '${timeZoneId}'`);
  }

  // 1. If global Temporal is available, utilize native TC39 ICU engine
  const temporal = (globalThis as unknown as { Temporal?: Record<string, unknown> }).Temporal;
  if (
    temporal &&
    typeof temporal['PlainDateTime'] === 'function' &&
    typeof temporal['ZonedDateTime'] === 'function'
  ) {
    try {
      const PlainDateTimeCtor = temporal['PlainDateTime'] as new (
        y: number,
        m: number,
        d: number,
        h: number,
        min: number,
        s: number,
        ms: number,
        us: number,
        ns: number
      ) => {
        toZonedDateTime: (
          tz: string,
          options?: { disambiguation?: string }
        ) => { epochNanoseconds: bigint };
      };

      const microsecond = Math.floor(nanosecond / 1000);
      const subMicroNs = nanosecond % 1000;
      const pdt = new PlainDateTimeCtor(
        year,
        month,
        day,
        hour,
        minute,
        second,
        millisecond,
        microsecond,
        subMicroNs
      );
      const zdt = pdt.toZonedDateTime(timeZoneId, { disambiguation });
      return Instant.fromEpochNanoseconds(zdt.epochNanoseconds);
    } catch (err) {
      if (err instanceof RangeError) {
        throw err;
      }
      // If native Temporal throws unexpected error, fall through to Intl implementation
    }
  }

  // 2. Pure Intl reference implementation
  return resolveWithIntl(
    year,
    month,
    day,
    hour,
    minute,
    second,
    millisecond,
    nanosecond,
    timeZoneId,
    disambiguation
  );
}
