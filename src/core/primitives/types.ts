/**
 * @file types.ts
 * Core types, interfaces, and mathematical constants for ChronoFlux temporal foundations.
 */

/**
 * Nanosecond arithmetic constants.
 * All temporal constants are represented as exact BigInt values to prevent precision loss.
 */
export const NANOSECONDS_PER_MICROSECOND = 1_000n;
export const NANOSECONDS_PER_MILLISECOND = 1_000_000n;
export const NANOSECONDS_PER_SECOND = 1_000_000_000n;
export const NANOSECONDS_PER_MINUTE = 60_000_000_000n;
export const NANOSECONDS_PER_HOUR = 3_600_000_000_000n;
export const NANOSECONDS_PER_DAY = 86_400_000_000_000n;

/**
 * Supported Instant Range:
 * Aligned with TC39 Temporal.Instant specification, covering ±100,000,000 days
 * (±8.64 × 10^21 nanoseconds) relative to the Unix Epoch (1970-01-01T00:00:00Z).
 * This spans approximately ±273,790 years (from ~271,821 BCE to ~275,760 CE).
 */
export const MIN_EPOCH_NANOSECONDS = -8_640_000_000_000_000_000_000n;
export const MAX_EPOCH_NANOSECONDS = 8_640_000_000_000_000_000_000n;

/**
 * Rounding modes for millisecond conversion and sub-second truncation.
 *
 * - `trunc`: Truncate towards zero (standard integer division behavior).
 * - `floor`: Mathematical floor (round towards negative infinity).
 * - `ceil`: Mathematical ceiling (round towards positive infinity).
 * - `halfExpand`: Round to nearest integer; ties round away from zero.
 */
export type RoundingMode = 'trunc' | 'floor' | 'ceil' | 'halfExpand';

export type LeapSecondPolicy = 'reject' | 'strict' | 'compatible' | 'clamp';

/**
 * Options for parsing ISO-8601 timestamps in Instant.fromISOString.
 */
export interface InstantParseOptions {
  /**
   * Policy for handling leap seconds (second 60) in ISO-8601 strings.
   *
   * - `compatible` (default): Accepts second 60 ONLY on authentic historical IERS leap second dates
   *   at UTC 23:59:60Z and clamps to 59 per RFC 3339 / POSIX conventions.
   *   Justification: Preserves interoperability with RFC 3339 feeds and backward compatibility with
   *   the existing Phase 1 test suite while strictly eliminating arbitrary/unvalidated second 60 inputs.
   * - `clamp`: Alias for `compatible`.
   * - `reject` / `strict`: Strictly rejects all second 60 timestamps with a RangeError,
   *   strictly enforcing ChronoFlux's leap-second-free Unix epoch Instant model.
   */
  readonly leapSecondPolicy?: LeapSecondPolicy;
}

/**
 * Allen's 13 Elementary Interval Relationships (Allen, 1983).
 *
 * For any two non-empty, half-open intervals A = [s_A, e_A) and B = [s_B, e_B),
 * exactly one of these 13 mutually exclusive relationships holds.
 */
export type AllenRelation =
  | 'before'
  | 'after'
  | 'meets'
  | 'metBy'
  | 'overlaps'
  | 'overlappedBy'
  | 'starts'
  | 'startedBy'
  | 'during'
  | 'contains'
  | 'finishes'
  | 'finishedBy'
  | 'equals';

/**
 * JSON serialization representation for an Instant.
 * Uses a decimal string for `epochNanoseconds` to prevent BigInt serialization failure in JSON.stringify.
 */
export interface InstantJSON {
  readonly epochNanoseconds: string;
}

/**
 * JSON serialization representation for a Duration.
 * Uses a signed decimal string for `nanoseconds`.
 */
export interface DurationJSON {
  readonly nanoseconds: string;
}

/**
 * JSON serialization representation for a Place.
 */
export interface PlaceJSON {
  readonly latitude: number;
  readonly longitude: number;
  readonly elevationMeters?: number;
  readonly timeZoneId?: string;
}

/**
 * JSON serialization representation for an Interval.
 */
export interface IntervalJSON {
  readonly start: InstantJSON;
  readonly end: InstantJSON;
}

/**
 * JSON serialization representation for an IntervalSet.
 */
export interface IntervalSetJSON {
  readonly intervals: readonly IntervalJSON[];
}
