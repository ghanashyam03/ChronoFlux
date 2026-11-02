/**
 * @file duration.ts
 * Directional physical time displacement stored as signed integer nanoseconds.
 */

import {
  DurationJSON,
  NANOSECONDS_PER_DAY,
  NANOSECONDS_PER_HOUR,
  NANOSECONDS_PER_MICROSECOND,
  NANOSECONDS_PER_MILLISECOND,
  NANOSECONDS_PER_MINUTE,
  NANOSECONDS_PER_SECOND,
} from './types.js';

export interface DurationParts {
  readonly sign: -1 | 0 | 1;
  readonly days: bigint;
  readonly hours: number;
  readonly minutes: number;
  readonly seconds: number;
  readonly milliseconds: number;
  readonly microseconds: number;
  readonly nanoseconds: number;
}

export interface DurationFields {
  readonly days?: number | bigint;
  readonly hours?: number | bigint;
  readonly minutes?: number | bigint;
  readonly seconds?: number | bigint;
  readonly milliseconds?: number | bigint;
  readonly microseconds?: number | bigint;
  readonly nanoseconds?: number | bigint;
}

function toBigIntValue(val: bigint | number, name: string): bigint {
  if (typeof val === 'bigint') return val;
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) {
      throw new TypeError(`${name} must be a finite number or bigint, received: ${val}`);
    }
    return BigInt(Math.trunc(val));
  }
  throw new TypeError(`${name} must be a number or bigint, received: ${typeof val}`);
}

/**
 * Duration represents a signed, physical elapsed time displacement in SI seconds/nanoseconds.
 *
 * Semantic Guarantees:
 * - Canonical storage is an exact signed `bigint` count of nanoseconds.
 * - Free from calendar ambiguities (months, years) and timezone daylight-saving shifts.
 *   Calendar units such as months or years have variable durations depending on the Gregorian
 *   calendar date and local civil rules, and are intentionally excluded from this physical duration primitive.
 * - All core arithmetic is exact and does not use floating-point math.
 */
export class Duration {
  readonly nanoseconds: bigint;

  constructor(nanoseconds: bigint) {
    if (typeof nanoseconds !== 'bigint') {
      throw new TypeError(`Duration nanoseconds must be a bigint, received: ${typeof nanoseconds}`);
    }
    this.nanoseconds = nanoseconds;
  }

  // --- Factories ---

  static zero(): Duration {
    return new Duration(0n);
  }

  static fromNanoseconds(ns: bigint | number): Duration {
    return new Duration(toBigIntValue(ns, 'nanoseconds'));
  }

  static fromMicroseconds(us: bigint | number): Duration {
    return new Duration(toBigIntValue(us, 'microseconds') * NANOSECONDS_PER_MICROSECOND);
  }

  static fromMilliseconds(ms: bigint | number): Duration {
    return new Duration(toBigIntValue(ms, 'milliseconds') * NANOSECONDS_PER_MILLISECOND);
  }

  static fromSeconds(s: bigint | number): Duration {
    return new Duration(toBigIntValue(s, 'seconds') * NANOSECONDS_PER_SECOND);
  }

  static fromMinutes(m: bigint | number): Duration {
    return new Duration(toBigIntValue(m, 'minutes') * NANOSECONDS_PER_MINUTE);
  }

  static fromHours(h: bigint | number): Duration {
    return new Duration(toBigIntValue(h, 'hours') * NANOSECONDS_PER_HOUR);
  }

  static fromDays(d: bigint | number): Duration {
    return new Duration(toBigIntValue(d, 'days') * NANOSECONDS_PER_DAY);
  }

  static of(fields: DurationFields): Duration {
    if (typeof fields !== 'object' || fields === null) {
      throw new TypeError('Duration.of requires a valid non-null fields object');
    }
    let total = 0n;
    if (fields.days !== undefined) {
      total += toBigIntValue(fields.days, 'days') * NANOSECONDS_PER_DAY;
    }
    if (fields.hours !== undefined) {
      total += toBigIntValue(fields.hours, 'hours') * NANOSECONDS_PER_HOUR;
    }
    if (fields.minutes !== undefined) {
      total += toBigIntValue(fields.minutes, 'minutes') * NANOSECONDS_PER_MINUTE;
    }
    if (fields.seconds !== undefined) {
      total += toBigIntValue(fields.seconds, 'seconds') * NANOSECONDS_PER_SECOND;
    }
    if (fields.milliseconds !== undefined) {
      total += toBigIntValue(fields.milliseconds, 'milliseconds') * NANOSECONDS_PER_MILLISECOND;
    }
    if (fields.microseconds !== undefined) {
      total += toBigIntValue(fields.microseconds, 'microseconds') * NANOSECONDS_PER_MICROSECOND;
    }
    if (fields.nanoseconds !== undefined) {
      total += toBigIntValue(fields.nanoseconds, 'nanoseconds');
    }
    return new Duration(total);
  }

  // --- Exact Arithmetic ---

  add(other: Duration): Duration {
    if (!(other instanceof Duration)) {
      throw new TypeError('Expected a Duration instance in Duration.add');
    }
    return new Duration(this.nanoseconds + other.nanoseconds);
  }

  subtract(other: Duration): Duration {
    if (!(other instanceof Duration)) {
      throw new TypeError('Expected a Duration instance in Duration.subtract');
    }
    return new Duration(this.nanoseconds - other.nanoseconds);
  }

  negate(): Duration {
    return new Duration(-this.nanoseconds);
  }

  abs(): Duration {
    return this.nanoseconds < 0n ? new Duration(-this.nanoseconds) : this;
  }

  multiply(factor: bigint | number): Duration {
    const factorBig = toBigIntValue(factor, 'factor');
    return new Duration(this.nanoseconds * factorBig);
  }

  divide(divisor: bigint | number): { quotient: bigint; remainder: Duration } {
    const divBig = toBigIntValue(divisor, 'divisor');
    if (divBig === 0n) {
      throw new RangeError('Division by zero in Duration.divide');
    }
    const q = this.nanoseconds / divBig;
    const r = this.nanoseconds % divBig;
    return {
      quotient: q,
      remainder: new Duration(r),
    };
  }

  // --- Comparisons ---

  compareTo(other: Duration): number {
    if (!(other instanceof Duration)) {
      throw new TypeError('Expected a Duration instance for comparison');
    }
    if (this.nanoseconds < other.nanoseconds) return -1;
    if (this.nanoseconds > other.nanoseconds) return 1;
    return 0;
  }

  equals(other: unknown): boolean {
    if (!(other instanceof Duration)) {
      return false;
    }
    return this.nanoseconds === other.nanoseconds;
  }

  isZero(): boolean {
    return this.nanoseconds === 0n;
  }

  isPositive(): boolean {
    return this.nanoseconds > 0n;
  }

  isNegative(): boolean {
    return this.nanoseconds < 0n;
  }

  isGreaterThan(other: Duration): boolean {
    if (!(other instanceof Duration)) throw new TypeError('Expected a Duration instance');
    return this.nanoseconds > other.nanoseconds;
  }

  isLessThan(other: Duration): boolean {
    if (!(other instanceof Duration)) throw new TypeError('Expected a Duration instance');
    return this.nanoseconds < other.nanoseconds;
  }

  isGreaterThanOrEqual(other: Duration): boolean {
    if (!(other instanceof Duration)) throw new TypeError('Expected a Duration instance');
    return this.nanoseconds >= other.nanoseconds;
  }

  isLessThanOrEqual(other: Duration): boolean {
    if (!(other instanceof Duration)) throw new TypeError('Expected a Duration instance');
    return this.nanoseconds <= other.nanoseconds;
  }

  // --- Informational Unit Conversions (Floating-Point) ---

  get totalNanoseconds(): bigint {
    return this.nanoseconds;
  }

  get totalMicroseconds(): number {
    return Number(this.nanoseconds) / Number(NANOSECONDS_PER_MICROSECOND);
  }

  get totalMilliseconds(): number {
    return Number(this.nanoseconds) / Number(NANOSECONDS_PER_MILLISECOND);
  }

  get totalSeconds(): number {
    return Number(this.nanoseconds) / Number(NANOSECONDS_PER_SECOND);
  }

  get totalMinutes(): number {
    return Number(this.nanoseconds) / Number(NANOSECONDS_PER_MINUTE);
  }

  get totalHours(): number {
    return Number(this.nanoseconds) / Number(NANOSECONDS_PER_HOUR);
  }

  get totalDays(): number {
    return Number(this.nanoseconds) / Number(NANOSECONDS_PER_DAY);
  }

  /**
   * Deconstructs this duration into non-overlapping positive unit parts alongside a sign flag.
   */
  toParts(): DurationParts {
    const sign: -1 | 0 | 1 = this.nanoseconds < 0n ? -1 : this.nanoseconds > 0n ? 1 : 0;
    const absNs = this.nanoseconds < 0n ? -this.nanoseconds : this.nanoseconds;

    const days = absNs / NANOSECONDS_PER_DAY;
    let rem = absNs % NANOSECONDS_PER_DAY;

    const hours = Number(rem / NANOSECONDS_PER_HOUR);
    rem = rem % NANOSECONDS_PER_HOUR;

    const minutes = Number(rem / NANOSECONDS_PER_MINUTE);
    rem = rem % NANOSECONDS_PER_MINUTE;

    const seconds = Number(rem / NANOSECONDS_PER_SECOND);
    rem = rem % NANOSECONDS_PER_SECOND;

    const milliseconds = Number(rem / NANOSECONDS_PER_MILLISECOND);
    rem = rem % NANOSECONDS_PER_MILLISECOND;

    const microseconds = Number(rem / NANOSECONDS_PER_MICROSECOND);
    const nanoseconds = Number(rem % NANOSECONDS_PER_MICROSECOND);

    return {
      sign,
      days,
      hours,
      minutes,
      seconds,
      milliseconds,
      microseconds,
      nanoseconds,
    };
  }

  // --- Serialization & Formatting ---

  /**
   * Returns an ISO-8601 duration representation (e.g. "PT1H30M", "PT0.000000001S", "-PT5S").
   */
  toISOString(): string {
    if (this.nanoseconds === 0n) {
      return 'PT0S';
    }

    const { sign, days, hours, minutes, seconds, milliseconds, microseconds, nanoseconds } = this.toParts();
    const prefix = sign === -1 ? '-P' : 'P';
    const datePart = days > 0n ? `${days}D` : '';

    const subSecondNs = BigInt(milliseconds) * 1_000_000n + BigInt(microseconds) * 1_000n + BigInt(nanoseconds);
    let secStr = '';
    if (seconds > 0 || subSecondNs > 0n || (datePart === '' && hours === 0 && minutes === 0)) {
      if (subSecondNs === 0n) {
        secStr = `${seconds}S`;
      } else {
        const fracStr = subSecondNs.toString().padStart(9, '0').replace(/0+$/, '');
        secStr = `${seconds}.${fracStr}S`;
      }
    }

    const hourStr = hours > 0 ? `${hours}H` : '';
    const minStr = minutes > 0 ? `${minutes}M` : '';

    const timePart = (hourStr || minStr || secStr) ? `T${hourStr}${minStr}${secStr}` : '';
    return `${prefix}${datePart}${timePart}`;
  }

  toString(): string {
    return this.toISOString();
  }

  toJSON(): DurationJSON {
    return {
      nanoseconds: this.nanoseconds.toString(),
    };
  }

  static fromJSON(json: DurationJSON | string): Duration {
    if (typeof json === 'string') {
      // If it looks like an ISO duration string, parse it; otherwise parse as decimal nanoseconds
      if (json.startsWith('P') || json.startsWith('-P') || json.startsWith('+P')) {
        return Duration.parseISO(json);
      }
      return new Duration(BigInt(json));
    }
    if (typeof json === 'object' && json !== null && 'nanoseconds' in json) {
      return new Duration(BigInt(json.nanoseconds));
    }
    throw new TypeError('Invalid JSON representation for Duration');
  }

  /**
   * Parses an ISO-8601 duration string into a Duration.
   * Supports standard form: [-+]P[nD][T[nH][nM][n[.fraction]S]]
   */
  static parseISO(isoString: string): Duration {
    const trimmed = isoString.trim();
    const match = /^([+-])?P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(trimmed);
    if (!match) {
      throw new RangeError(`Invalid ISO-8601 duration string: "${isoString}"`);
    }

    const hasDays = match[2] !== undefined;
    const hasHours = match[3] !== undefined;
    const hasMinutes = match[4] !== undefined;
    const hasSeconds = match[5] !== undefined;

    // Must have at least one designator component
    if (!hasDays && !hasHours && !hasMinutes && !hasSeconds) {
      throw new RangeError(`Invalid ISO-8601 duration string (no components): "${isoString}"`);
    }

    // If 'T' appears in the string, it must be followed by at least one time component
    if (trimmed.includes('T') && !hasHours && !hasMinutes && !hasSeconds) {
      throw new RangeError(`Invalid ISO-8601 duration string ('T' without time components): "${isoString}"`);
    }

    const sign = match[1] === '-' ? -1n : 1n;
    const days = match[2] ? BigInt(match[2]) : 0n;
    const hours = match[3] ? BigInt(match[3]) : 0n;
    const minutes = match[4] ? BigInt(match[4]) : 0n;
    const secStr = match[5];

    let secNs = 0n;
    if (secStr !== undefined) {
      const dotIndex = secStr.indexOf('.');
      if (dotIndex === -1) {
        secNs = BigInt(secStr) * NANOSECONDS_PER_SECOND;
      } else {
        const wholeSec = BigInt(secStr.slice(0, dotIndex));
        const fracStr = secStr.slice(dotIndex + 1).slice(0, 9).padEnd(9, '0');
        secNs = wholeSec * NANOSECONDS_PER_SECOND + BigInt(fracStr);
      }
    }

    const totalNs = sign * (
      days * NANOSECONDS_PER_DAY +
      hours * NANOSECONDS_PER_HOUR +
      minutes * NANOSECONDS_PER_MINUTE +
      secNs
    );

    return new Duration(totalNs);
  }
}
