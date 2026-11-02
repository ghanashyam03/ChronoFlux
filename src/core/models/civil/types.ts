/**
 * @file types.ts
 * Type definitions for the civil time model and DST disambiguation.
 */

import { Duration } from '../../primitives/duration.js';

/**
 * Disambiguation policy for resolving civil wall-clock timestamps to physical Instants
 * during Daylight Saving Time (DST) transitions.
 *
 * - 'compatible': (Default) In a skipped hour (spring-forward), advances by the gap duration (later).
 *                 In a repeated hour (fall-back), selects the earlier instance (pre-transition / daylight).
 * - 'earlier':    In a skipped hour, moves before the gap.
 *                 In a repeated hour, selects the earlier instance.
 * - 'later':      In a skipped hour, advances past the gap.
 *                 In a repeated hour, selects the later instance.
 * - 'reject':     Strict mode; throws RangeError on any ambiguous or nonexistent wall-clock time.
 */
export type DisambiguationPolicy = 'compatible' | 'earlier' | 'later' | 'reject';

/**
 * Input fields for resolving a local civil date/time into a physical Instant.
 */
export interface CivilDateTimeInput {
  readonly year: number;
  readonly month: number; // 1 - 12
  readonly day: number; // 1 - 31
  readonly hour?: number; // 0 - 23 (default: 0)
  readonly minute?: number; // 0 - 59 (default: 0)
  readonly second?: number; // 0 - 59 (default: 0)
  readonly millisecond?: number; // 0 - 999 (default: 0)
  readonly nanosecond?: number; // 0 - 999999 (sub-millisecond nanoseconds, default: 0)
  readonly timeZoneId: string; // IANA time zone identifier (e.g. 'America/New_York', 'UTC')
  readonly disambiguation?: DisambiguationPolicy; // (default: 'compatible')
}

/**
 * Diagnostic transition status for the local civil date/time.
 */
export interface CivilTransitionInfo {
  /**
   * True if this local wall-clock time occurred twice due to a fall-back transition.
   */
  readonly isAmbiguous: boolean;

  /**
   * True if this local wall-clock time was skipped due to a spring-forward transition.
   */
  readonly isNonExistent: boolean;
}

/**
 * Comprehensive civil time representation for a given Instant and IANA Time Zone.
 */
export interface CivilState {
  readonly year: number;
  readonly month: number; // 1 - 12
  readonly day: number; // 1 - 31
  readonly hour: number; // 0 - 23
  readonly minute: number; // 0 - 59
  readonly second: number; // 0 - 59
  readonly millisecond: number; // 0 - 999
  readonly nanosecond: number; // 0 - 999999 (sub-millisecond nanoseconds)
  readonly timeZoneId: string;
  readonly utcOffset: Duration;
  readonly utcOffsetMinutes: number;
  readonly isDaylightSaving: boolean;
  readonly transition?: CivilTransitionInfo;
}

/**
 * Pluggable provider interface for geographic coordinate to IANA time zone resolution.
 */
export interface TimeZoneLookupProvider {
  /**
   * Resolves an IANA time zone identifier from geographic coordinates.
   *
   * @param latitude Latitude in degrees [-90, +90]
   * @param longitude Longitude in degrees [-180, +180]
   * @returns IANA time zone identifier string (e.g. 'America/New_York') or null if unmapped.
   */
  lookup(latitude: number, longitude: number): string | null;
}

/**
 * Provenance of the underlying civil-time database and runtime environment.
 */
export interface CivilTimeProvenance {
  readonly runtime: string;
  readonly tzVersion: string;
  readonly icuVersion: string;
  readonly cldrVersion: string;
  readonly unicodeVersion: string;
}
