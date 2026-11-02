/**
 * @file instant.ts
 * High-resolution physical UTC Instant stored canonically as BigInt nanoseconds from Unix Epoch.
 */

import { Duration } from './duration.js';
import {
  InstantJSON,
  MAX_EPOCH_NANOSECONDS,
  MIN_EPOCH_NANOSECONDS,
  NANOSECONDS_PER_DAY,
  NANOSECONDS_PER_HOUR,
  NANOSECONDS_PER_MICROSECOND,
  NANOSECONDS_PER_MILLISECOND,
  NANOSECONDS_PER_MINUTE,
  NANOSECONDS_PER_SECOND,
  RoundingMode,
} from './types.js';

/**
 * Euclidean affine Gregorian calendar algorithms for arbitrary-precision days since 1970-01-01.
 * Based on Howard Hinnant's algorithm implemented in pure BigInt arithmetic.
 */
function daysToCivil(z: bigint): { year: bigint; month: number; day: number } {
  z += 719468n;
  const era = (z >= 0n ? z : z - 146096n) / 146097n;
  const doe = z - era * 146097n;
  const yoe = (doe - doe / 1460n + doe / 36524n - doe / 146096n) / 365n;
  const y = yoe + era * 400n;
  const doy = doe - (365n * yoe + yoe / 4n - yoe / 100n);
  const mp = (5n * doy + 2n) / 153n;
  const d = Number(doy - (153n * mp + 2n) / 5n + 1n);
  const m = Number(mp < 10n ? mp + 3n : mp - 9n);
  return { year: y + (m <= 2 ? 1n : 0n), month: m, day: d };
}

function civilToDays(y: bigint, m: number, d: number): bigint {
  y -= m <= 2 ? 1n : 0n;
  const era = (y >= 0n ? y : y - 399n) / 400n;
  const yoe = y - era * 400n;
  const mBig = BigInt(m > 2 ? m - 3 : m + 9);
  const doy = (153n * mBig + 2n) / 5n + BigInt(d) - 1n;
  const doe = yoe * 365n + yoe / 4n - yoe / 100n + doy;
  return era * 146097n + doe - 719468n;
}

/**
 * Temporal Instant interface representing an exact point on the universal timeline.
 */
export interface Instant {
  readonly epochNanoseconds: bigint;
}

/**
 * Instant represents an unambiguous, immutable point on the global timeline, anchored
 * to the Unix Epoch (1970-01-01T00:00:00Z) as a 64-bit+ BigInt count of nanoseconds.
 *
 * Semantic Guarantees & Clarifications:
 * 1. Wall-Clock Epoch Anchor vs. Monotonic Clock:
 *    An Instant represents an epoch-based UTC wall-clock time. It is NOT a monotonic elapsed-time source
 *    (such as Node.js `process.hrtime` or browser `performance.now`), and does not represent an internal
 *    hardware counter.
 * 2. Leap Seconds:
 *    Following standard POSIX, RFC 3339, and TC39 Temporal conventions, the canonical Unix scale ignores
 *    leap seconds (treating every UTC day as consisting of exactly 86,400 SI seconds).
 * 3. High Resolution vs. Measurement Accuracy:
 *    The canonical nanosecond representation guarantees zero loss of numerical precision during instant
 *    arithmetic, differentiation, and interval set operations. It does not imply that the underlying system
 *    clock possesses nanosecond physical measurement accuracy.
 * 4. Supported Range:
 *    Covers ±100,000,000 days (±8.64 × 10^21 nanoseconds) relative to Unix Epoch, spanning approximately
 *    ±273,790 years (from ~271,821 BCE to ~275,760 CE).
 */
export class Instant {
  constructor(readonly epochNanoseconds: bigint) {
    if (typeof epochNanoseconds !== 'bigint') {
      throw new TypeError(`epochNanoseconds must be a bigint, received: ${typeof epochNanoseconds}`);
    }
    if (epochNanoseconds < MIN_EPOCH_NANOSECONDS || epochNanoseconds > MAX_EPOCH_NANOSECONDS) {
      throw new RangeError(
        `epochNanoseconds ${epochNanoseconds} exceeds supported range [${MIN_EPOCH_NANOSECONDS}, ${MAX_EPOCH_NANOSECONDS}]`
      );
    }
  }

  // --- Static Sentinel Constants ---

  static readonly EPOCH: Instant = new Instant(0n);
  static readonly MIN: Instant = new Instant(MIN_EPOCH_NANOSECONDS);
  static readonly MAX: Instant = new Instant(MAX_EPOCH_NANOSECONDS);

  // --- Factories ---

  static fromEpochNanoseconds(epochNanoseconds: bigint): Instant {
    return new Instant(epochNanoseconds);
  }

  static fromEpochMicroseconds(epochMicroseconds: bigint | number): Instant {
    const us = typeof epochMicroseconds === 'bigint' ? epochMicroseconds : BigInt(Math.trunc(epochMicroseconds));
    return new Instant(us * NANOSECONDS_PER_MICROSECOND);
  }

  static fromEpochMilliseconds(epochMilliseconds: number | bigint): Instant {
    const ms = typeof epochMilliseconds === 'bigint' ? epochMilliseconds : BigInt(Math.trunc(epochMilliseconds));
    return new Instant(ms * NANOSECONDS_PER_MILLISECOND);
  }

  static fromEpochSeconds(epochSeconds: number | bigint): Instant {
    const s = typeof epochSeconds === 'bigint' ? epochSeconds : BigInt(Math.trunc(epochSeconds));
    return new Instant(s * NANOSECONDS_PER_SECOND);
  }

  static fromDate(date: Date): Instant {
    if (Number.isNaN(date.getTime())) {
      throw new RangeError('Cannot construct Instant from an invalid Date');
    }
    return Instant.fromEpochMilliseconds(BigInt(date.getTime()));
  }

  /**
   * Constructs an Instant from a TC39 Temporal.Instant or compatible object.
   */
  static fromTemporalInstant(temporalInstant: { readonly epochNanoseconds: bigint }): Instant {
    if (!temporalInstant || typeof temporalInstant.epochNanoseconds !== 'bigint') {
      throw new TypeError('Expected an object with an epochNanoseconds bigint property');
    }
    return new Instant(temporalInstant.epochNanoseconds);
  }

  static now(): Instant {
    // Uses Date.now() for wall-clock milliseconds, scaled exactly to nanoseconds.
    return Instant.fromEpochMilliseconds(BigInt(Date.now()));
  }

  // --- Conversion & Rounding ---

  /**
   * Converts the instant to integer epoch milliseconds using the specified rounding mode.
   *
   * Rounding Behavior:
   * - `trunc` (default): Truncates sub-millisecond nanoseconds towards zero (standard integer division).
   * - `floor`: Mathematical floor (rounds towards negative infinity).
   * - `ceil`: Mathematical ceiling (rounds towards positive infinity).
   * - `halfExpand`: Rounds to nearest integer millisecond; ties round away from zero.
   */
  toEpochMillisecondsBigInt(roundingMode: RoundingMode = 'trunc'): bigint {
    const validModes: Record<RoundingMode, true> = {
      trunc: true,
      floor: true,
      ceil: true,
      halfExpand: true,
    };
    if (!validModes[roundingMode]) {
      throw new RangeError(`Unknown rounding mode: ${roundingMode}`);
    }

    const q = this.epochNanoseconds / NANOSECONDS_PER_MILLISECOND;
    const r = this.epochNanoseconds % NANOSECONDS_PER_MILLISECOND;

    if (r === 0n) {
      return q;
    }

    switch (roundingMode) {
      case 'trunc':
        return q;
      case 'floor':
        return this.epochNanoseconds < 0n ? q - 1n : q;
      case 'ceil':
        return this.epochNanoseconds > 0n ? q + 1n : q;
      case 'halfExpand': {
        const half = NANOSECONDS_PER_MILLISECOND / 2n;
        if (r > 0n) {
          return r >= half ? q + 1n : q;
        } else {
          return r <= -half ? q - 1n : q;
        }
      }
    }
  }

  /**
   * Converts the instant to a JavaScript number of epoch milliseconds.
   * Note: For timestamps within ±285,000 years, this value is safely within Number.MAX_SAFE_INTEGER.
   */
  toEpochMilliseconds(roundingMode: RoundingMode = 'trunc'): number {
    return Number(this.toEpochMillisecondsBigInt(roundingMode));
  }

  /**
   * Adapter: Converts this Instant to a JavaScript Date.
   * Uses floor rounding to align with POSIX / TC39 millisecond conversion semantics.
   */
  toDate(): Date {
    const ms = this.toEpochMilliseconds('floor');
    return new Date(ms);
  }

  /**
   * Adapter: Converts this Instant to a TC39 Temporal.Instant if supported in the runtime.
   */
  toTemporalInstant(): any {
    const globalTemporal = (globalThis as any).Temporal;
    if (globalTemporal && typeof globalTemporal.Instant?.fromEpochNanoseconds === 'function') {
      return globalTemporal.Instant.fromEpochNanoseconds(this.epochNanoseconds);
    }
    throw new Error('TC39 Temporal.Instant is not available in this JavaScript runtime environment.');
  }

  // --- Exact Arithmetic ---

  add(duration: Duration): Instant {
    return new Instant(this.epochNanoseconds + duration.nanoseconds);
  }

  subtract(duration: Duration): Instant {
    return new Instant(this.epochNanoseconds - duration.nanoseconds);
  }

  diff(other: Instant): Duration {
    return new Duration(this.epochNanoseconds - other.epochNanoseconds);
  }

  since(other: Instant): Duration {
    return this.diff(other);
  }

  until(other: Instant): Duration {
    return other.diff(this);
  }

  // --- Comparisons ---

  compareTo(other: Instant): number {
    if (this.epochNanoseconds < other.epochNanoseconds) return -1;
    if (this.epochNanoseconds > other.epochNanoseconds) return 1;
    return 0;
  }

  equals(other: Instant): boolean {
    return this.epochNanoseconds === other.epochNanoseconds;
  }

  isBefore(other: Instant): boolean {
    return this.epochNanoseconds < other.epochNanoseconds;
  }

  isAfter(other: Instant): boolean {
    return this.epochNanoseconds > other.epochNanoseconds;
  }

  isBeforeOrEqual(other: Instant): boolean {
    return this.epochNanoseconds <= other.epochNanoseconds;
  }

  isAfterOrEqual(other: Instant): boolean {
    return this.epochNanoseconds >= other.epochNanoseconds;
  }

  // --- Serialization & Formatting ---

  /**
   * Returns a canonical ISO-8601 UTC string (e.g. "2026-11-02T12:00:00.123456789Z").
   * Sub-second precision is included up to nanoseconds, omitting unneeded trailing zeroes beyond milliseconds.
   */
  toISOString(): string {
    const ns = this.epochNanoseconds;

    // Compute day number and sub-day nanoseconds
    let days = ns / NANOSECONDS_PER_DAY;
    let remNs = ns % NANOSECONDS_PER_DAY;
    if (remNs < 0n) {
      days -= 1n;
      remNs += NANOSECONDS_PER_DAY;
    }

    const { year, month, day } = daysToCivil(days);

    const hours = Number(remNs / NANOSECONDS_PER_HOUR);
    remNs = remNs % NANOSECONDS_PER_HOUR;

    const minutes = Number(remNs / NANOSECONDS_PER_MINUTE);
    remNs = remNs % NANOSECONDS_PER_MINUTE;

    const seconds = Number(remNs / NANOSECONDS_PER_SECOND);
    const subSecNs = remNs % NANOSECONDS_PER_SECOND;

    // Format Year: 4 digits if between 0 and 9999, otherwise 6 digits with explicit sign (+YYYYYY or -YYYYYY)
    let yearStr: string;
    if (year >= 0n && year <= 9999n) {
      yearStr = year.toString().padStart(4, '0');
    } else if (year < 0n) {
      const absYear = -year;
      yearStr = `-${absYear.toString().padStart(6, '0')}`;
    } else {
      yearStr = `+${year.toString().padStart(6, '0')}`;
    }

    const monthStr = month.toString().padStart(2, '0');
    const dayStr = day.toString().padStart(2, '0');
    const hourStr = hours.toString().padStart(2, '0');
    const minStr = minutes.toString().padStart(2, '0');
    const secStr = seconds.toString().padStart(2, '0');

    // Fractional seconds: 3 to 9 digits
    let fracStr = subSecNs.toString().padStart(9, '0');
    // Trim trailing zeroes, but keep at least 3 digits (e.g., .123, .123456789)
    fracStr = fracStr.replace(/0+$/, '');
    if (fracStr.length < 3) {
      fracStr = fracStr.padEnd(3, '0');
    }

    return `${yearStr}-${monthStr}-${dayStr}T${hourStr}:${minStr}:${secStr}.${fracStr}Z`;
  }

  toString(): string {
    return this.toISOString();
  }

  toEpochNanosecondsString(): string {
    return this.epochNanoseconds.toString();
  }

  toJSON(): InstantJSON {
    return {
      epochNanoseconds: this.epochNanoseconds.toString(),
    };
  }

  static fromJSON(json: InstantJSON | string): Instant {
    if (typeof json === 'string') {
      // Check if it's an ISO-8601 string or decimal nanoseconds
      if (json.includes('T') || json.includes('-') || json.endsWith('Z')) {
        return Instant.fromISOString(json);
      }
      return new Instant(BigInt(json));
    }
    if (typeof json === 'object' && json !== null && 'epochNanoseconds' in json) {
      return new Instant(BigInt(json.epochNanoseconds));
    }
    throw new TypeError('Invalid JSON representation for Instant');
  }

  /**
   * Parses an ISO-8601 extended timestamp into an Instant.
   * Supports UTC ('Z') as well as arbitrary offset representations ('+05:30', '-08:00').
   */
  static fromISOString(isoString: string): Instant {
    const trimmed = isoString.trim();
    const regex = /^([+-]?\d{4,6})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(?:([zZ])|([+-])(\d{2}):?(\d{2})?)?$/;
    const match = regex.exec(trimmed);

    if (!match) {
      throw new RangeError(`Invalid ISO-8601 instant string: "${isoString}"`);
    }

    const year = BigInt(match[1]!);
    const month = parseInt(match[2]!, 10);
    const day = parseInt(match[3]!, 10);
    const hours = BigInt(match[4]!);
    const minutes = BigInt(match[5]!);
    const seconds = BigInt(match[6]!);
    const subSecRaw = match[7];

    if (month < 1 || month > 12 || day < 1 || day > 31 || hours > 23n || minutes > 59n || seconds > 60n) {
      throw new RangeError(`Out-of-range calendar field in ISO string: "${isoString}"`);
    }

    let subSecNs = 0n;
    if (subSecRaw !== undefined) {
      const padded = subSecRaw.padEnd(9, '0').slice(0, 9);
      subSecNs = BigInt(padded);
    }

    const days = civilToDays(year, month, day);
    const localNs =
      days * NANOSECONDS_PER_DAY +
      hours * NANOSECONDS_PER_HOUR +
      minutes * NANOSECONDS_PER_MINUTE +
      seconds * NANOSECONDS_PER_SECOND +
      subSecNs;

    // Timezone offset
    let offsetNs = 0n;
    if (match[8] === undefined) {
      // Has offset
      const sign = match[9] === '-' ? -1n : 1n;
      const offH = match[10] ? BigInt(match[10]) : 0n;
      const offM = match[11] ? BigInt(match[11]) : 0n;
      offsetNs = sign * (offH * NANOSECONDS_PER_HOUR + offM * NANOSECONDS_PER_MINUTE);
    }

    const utcNs = localNs - offsetNs;
    return new Instant(utcNs);
  }
}
