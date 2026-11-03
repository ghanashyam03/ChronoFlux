/**
 * @file civil-model.ts
 * IANA Time Zone and Civil Calendar temporal model implementing TemporalModel<CivilState>.
 */

import { Duration } from '../../primitives/duration.js';
import { Instant } from '../../primitives/instant.js';
import { Place } from '../../primitives/place.js';
import { ModelMetadata, TemporalModel } from '../model.js';
import { getFormatter, safeDateUtc, resolveCivilDateTimeToInstant } from './disambiguation.js';
import { CivilDateTimeInput, CivilState, CivilTimeProvenance, DstConfidence, TimeZoneLookupProvider } from './types.js';

/**
 * Returns provenance metadata about the runtime environment and IANA tz database.
 */
export function getCivilTimeProvenance(): CivilTimeProvenance {
  const proc = typeof globalThis !== 'undefined' ? (globalThis as any).process : undefined;
  const versions = proc?.versions;
  return Object.freeze({
    runtime: typeof process !== 'undefined' && process.version ? `Node.js ${process.version}` : 'ECMAScript Intl',
    tzVersion: versions?.tz ?? 'system',
    icuVersion: versions?.icu ?? 'system',
    cldrVersion: versions?.cldr ?? 'system',
    unicodeVersion: versions?.unicode ?? 'system',
  });
}

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
    'Explicit IANA time zone requirement (silent UTC fallback disabled)',
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

/**
 * Floor-divides epoch nanoseconds into integer milliseconds and sub-millisecond nanoseconds [0, 999999].
 * Correctly handles negative nanoseconds (pre-1970).
 */
export function splitEpochNanoseconds(epochNs: bigint): { epochMs: number; nanosecond: number } {
  const ONE_MS_NS = 1_000_000n;
  let msBig = epochNs / ONE_MS_NS;
  let rem = epochNs % ONE_MS_NS;
  if (rem < 0n) {
    msBig -= 1n;
    rem += ONE_MS_NS;
  }
  return {
    epochMs: Number(msBig),
    nanosecond: Number(rem),
  };
}

function extractLocalParts(epochMs: number, timeZoneId: string): LocalParts {
  const formatter = getFormatter(timeZoneId);
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(epochMs)).map((p) => [p.type, p.value])
  );

  const year = Number(parts['year']);
  const month = Number(parts['month']);
  const day = Number(parts['day']);
  const hour = Number(parts['hour']);
  const minute = Number(parts['minute']);
  const second = Number(parts['second']);
  const millisecond = parts['fractionalSecond'] ? Number(parts['fractionalSecond']) : 0;

  const utcForCivil = safeDateUtc(year, month - 1, day, hour, minute, second, millisecond);
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

let registeredTimeZoneLookupProvider: TimeZoneLookupProvider | null = null;

/**
 * Registers a global pluggable geographic timezone lookup provider.
 * Pass null to deregister.
 */
export function registerTimeZoneLookupProvider(provider: TimeZoneLookupProvider | null): void {
  registeredTimeZoneLookupProvider = provider;
}

/**
 * Retrieves the currently registered geographic timezone lookup provider.
 */
export function getTimeZoneLookupProvider(): TimeZoneLookupProvider | null {
  return registeredTimeZoneLookupProvider;
}

interface AnnualTzProfile {
  readonly minOffsetMs: number;
  readonly maxOffsetMs: number;
  readonly hasDstTransitions: boolean;
}

const annualTzProfileCache = new Map<string, AnnualTzProfile>();

function getAnnualTzProfile(timeZoneId: string, year: number): AnnualTzProfile {
  const key = `${timeZoneId}:${year}`;
  let profile = annualTzProfileCache.get(key);
  if (profile === undefined) {
    let minOffset = Infinity;
    let maxOffset = -Infinity;

    // Sample mid-month (15th) of each month 0..11 at 12:00 UTC
    for (let month = 0; month < 12; month++) {
      const sampleMs = safeDateUtc(year, month, 15, 12, 0, 0);
      const off = extractLocalParts(sampleMs, timeZoneId).offsetMs;
      if (off < minOffset) minOffset = off;
      if (off > maxOffset) maxOffset = off;
    }

    profile = Object.freeze({
      minOffsetMs: minOffset,
      maxOffsetMs: maxOffset,
      hasDstTransitions: minOffset !== maxOffset,
    });
    annualTzProfileCache.set(key, profile);
  }
  return profile;
}

const tzNameFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getTimeZoneNameFormatter(timeZoneId: string): Intl.DateTimeFormat {
  let fmt = tzNameFormatterCache.get(timeZoneId);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', { timeZone: timeZoneId, timeZoneName: 'long' });
    tzNameFormatterCache.set(timeZoneId, fmt);
  }
  return fmt;
}

interface DstEvaluationResult {
  readonly isDaylightSaving: boolean;
  readonly dstConfidence: DstConfidence;
}

/**
 * Robustly evaluates whether Daylight Saving Time is actively in effect,
 * preserving exact IANA UTC offset and qualifying classification confidence.
 *
 * Distinct from physical UTC offset:
 * 1. Checks annual profile: if minOffset == maxOffset all year (e.g. UTC, Asia/Tokyo,
 *    Asia/Kolkata, America/Phoenix), DST is authoritatively false.
 * 2. Inspects runtime-derived IANA timeZoneName ('Daylight Time' / 'Summer Time' vs 'Standard Time').
 *    - Note: "Irish Standard Time" (Europe/Dublin) is statutory summer daylight saving time (UTC+1 vs winter GMT UTC+0).
 *    If an unambiguous daylight/summer/standard marker is present, returns with 'authoritative' confidence.
 * 3. In jurisdictions with numeric or non-descriptive runtime names (e.g. Morocco Ramadan shifts,
 *    wartime double DST, or administrative offset transitions), falls back to annual offset distribution
 *    and returns with 'heuristic' confidence, clearly documenting runtime limitations.
 */
function evaluateDstStatus(
  epochMs: number,
  currentOffsetMs: number,
  timeZoneId: string,
  year: number
): DstEvaluationResult {
  const profile = getAnnualTzProfile(timeZoneId, year);

  try {
    const formatter = getTimeZoneNameFormatter(timeZoneId);
    const parts = formatter.formatToParts(new Date(epochMs));
    const tzNamePart = parts.find((p) => p.type === 'timeZoneName')?.value;

    if (tzNamePart) {
      if (/daylight|summer/i.test(tzNamePart)) {
        return { isDaylightSaving: true, dstConfidence: 'authoritative' };
      }
      // Note: "Irish Standard Time" (Europe/Dublin) is statutory summer daylight saving time (UTC+1 vs winter GMT UTC+0).
      if (/standard|mean time/i.test(tzNamePart)) {
        if (/irish/i.test(tzNamePart)) {
          return { isDaylightSaving: true, dstConfidence: 'authoritative' };
        }
        return { isDaylightSaving: false, dstConfidence: 'authoritative' };
      }
      if (/coordinated universal time|\butc\b/i.test(tzNamePart)) {
        return { isDaylightSaving: false, dstConfidence: 'authoritative' };
      }
    }
  } catch {
    return { isDaylightSaving: currentOffsetMs > profile.minOffsetMs, dstConfidence: 'unknown' };
  }

  // 12-month identical offset profile without statutory name indicators (e.g. Etc/GMT+3)
  // cannot justify an authoritative no-DST classification and must be marked 'heuristic'.
  if (!profile.hasDstTransitions) {
    return { isDaylightSaving: false, dstConfidence: 'heuristic' };
  }

  // Fall back to annual offset distribution heuristic
  const isGreater = currentOffsetMs > profile.minOffsetMs;
  return { isDaylightSaving: isGreater, dstConfidence: 'heuristic' };
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
   * Registers a global pluggable geographic timezone lookup provider.
   */
  registerTimeZoneLookupProvider(provider: TimeZoneLookupProvider | null): void {
    registerTimeZoneLookupProvider(provider);
  }

  /**
   * Gets the currently registered geographic timezone lookup provider.
   */
  getTimeZoneLookupProvider(): TimeZoneLookupProvider | null {
    return getTimeZoneLookupProvider();
  }

  /**
   * Returns provenance metadata of the underlying civil-time database and runtime.
   */
  getProvenance(): CivilTimeProvenance {
    return getCivilTimeProvenance();
  }

  /**
   * Evaluates local civil calendar state for a given Instant and Place (or time zone identifier).
   *
   * Requirement: Never silently defaults to UTC. If a Place has no timeZoneId, throws a TypeError
   * unless a TimeZoneLookupProvider is registered that successfully resolves it.
   */
  evaluate(instant: Instant, placeOrTimeZone: Place | string): CivilState {
    let timeZoneId: string;
    if (typeof placeOrTimeZone === 'string') {
      timeZoneId = placeOrTimeZone.trim();
    } else if (placeOrTimeZone instanceof Place) {
      if (placeOrTimeZone.timeZoneId && placeOrTimeZone.timeZoneId.trim().length > 0) {
        timeZoneId = placeOrTimeZone.timeZoneId.trim();
      } else if (registeredTimeZoneLookupProvider !== null) {
        const lookedUp = registeredTimeZoneLookupProvider.lookup(
          placeOrTimeZone.latitude,
          placeOrTimeZone.longitude
        );
        if (lookedUp && lookedUp.trim().length > 0) {
          timeZoneId = lookedUp.trim();
        } else {
          throw new TypeError(
            `Place at (${placeOrTimeZone.latitude}, ${placeOrTimeZone.longitude}) does not contain a timeZoneId, and registered TimeZoneLookupProvider returned null. An explicit IANA time zone identifier is required for civil calendar evaluation.`
          );
        }
      } else {
        throw new TypeError(
          `Place at (${placeOrTimeZone.latitude}, ${placeOrTimeZone.longitude}) does not contain a timeZoneId. An explicit IANA time zone identifier is required for civil calendar evaluation (silent UTC fallback is disabled). Specify place.timeZoneId, an explicit IANA string, or register a TimeZoneLookupProvider.`
        );
      }
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

    const { epochMs, nanosecond } = splitEpochNanoseconds(instant.epochNanoseconds);

    const local = extractLocalParts(epochMs, cleanTz);
    const dst = evaluateDstStatus(epochMs, local.offsetMs, cleanTz, local.year);
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
      isDaylightSaving: dst.isDaylightSaving,
      dstConfidence: dst.dstConfidence,
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
