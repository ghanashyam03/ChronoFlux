/**
 * @file interval.ts
 * Half-open continuous temporal interval [start, end) on the global timeline.
 */

import { AllenRelation } from './allen.js';
import { Duration } from './duration.js';
import { Instant } from './instant.js';
import { IntervalJSON } from './types.js';

/**
 * Interval represents a non-empty, immutable, half-open continuous subset of the timeline:
 * [start, end) = { t in Instant | start <= t < end }
 *
 * Invariants:
 * - start < end strictly. Zero-length or reversed intervals are forbidden by contract.
 * - Empty interval sets are represented using IntervalSet.empty(), not zero-length intervals.
 */
export class Interval {
  readonly start: Instant;
  readonly end: Instant;
  readonly duration: Duration;

  constructor(start: Instant, end: Instant) {
    if (!(start instanceof Instant) || !(end instanceof Instant)) {
      throw new TypeError('Interval start and end must both be valid Instant instances');
    }
    if (!start.isBefore(end)) {
      throw new RangeError(
        `Interval start must be strictly before end (start < end). ` +
          `Received start=${start.toISOString()} (ns=${start.epochNanoseconds}), ` +
          `end=${end.toISOString()} (ns=${end.epochNanoseconds}). ` +
          `Empty intervals should be represented using IntervalSet.empty().`
      );
    }
    this.start = start;
    this.end = end;
    this.duration = end.diff(start);
  }

  static of(start: Instant, end: Instant): Interval {
    return new Interval(start, end);
  }

  static fromDuration(start: Instant, duration: Duration): Interval {
    if (duration.nanoseconds <= 0n) {
      throw new RangeError(`Interval duration must be strictly positive, received: ${duration.nanoseconds}ns`);
    }
    return new Interval(start, start.add(duration));
  }

  // --- Basic Operations ---

  /**
   * Evaluates whether an instant falls within this half-open interval: start <= t < end.
   */
  contains(instant: Instant): boolean {
    return this.start.isBeforeOrEqual(instant) && instant.isBefore(this.end);
  }

  /**
   * Evaluates whether another interval is entirely enclosed by this interval:
   * this.start <= other.start && other.end <= this.end.
   */
  encloses(other: Interval): boolean {
    return this.start.isBeforeOrEqual(other.start) && other.end.isBeforeOrEqual(this.end);
  }

  /**
   * Evaluates whether two intervals meet at an exact boundary point with no gap:
   * this.end === other.start || other.end === this.start.
   */
  isAdjacent(other: Interval): boolean {
    return this.end.equals(other.start) || other.end.equals(this.start);
  }

  /**
   * Evaluates whether this interval shares a non-empty intersection with another interval:
   * max(start_A, start_B) < min(end_A, end_B).
   */
  overlaps(other: Interval): boolean {
    const maxStart = this.start.isAfter(other.start) ? this.start : other.start;
    const minEnd = this.end.isBefore(other.end) ? this.end : other.end;
    return maxStart.isBefore(minEnd);
  }

  /**
   * Returns the intersection of this interval with another, or null if disjoint or adjacent.
   */
  intersect(other: Interval): Interval | null {
    const maxStart = this.start.isAfter(other.start) ? this.start : other.start;
    const minEnd = this.end.isBefore(other.end) ? this.end : other.end;
    if (maxStart.isBefore(minEnd)) {
      return new Interval(maxStart, minEnd);
    }
    return null;
  }

  /**
   * Returns the minimal continuous interval that encompasses both intervals.
   */
  span(other: Interval): Interval {
    const minStart = this.start.isBefore(other.start) ? this.start : other.start;
    const maxEnd = this.end.isAfter(other.end) ? this.end : other.end;
    return new Interval(minStart, maxEnd);
  }

  equals(other: Interval): boolean {
    if (!(other instanceof Interval)) return false;
    return this.start.equals(other.start) && this.end.equals(other.end);
  }

  // --- Allen's 13 Interval Relationships ---

  /**
   * Computes which of the 13 mutually exclusive Allen interval relationships holds between this interval (A)
   * and the other interval (B).
   */
  relationTo(other: Interval): AllenRelation {
    const sA = this.start.epochNanoseconds;
    const eA = this.end.epochNanoseconds;
    const sB = other.start.epochNanoseconds;
    const eB = other.end.epochNanoseconds;

    if (sA === sB) {
      if (eA === eB) return 'equals';
      if (eA < eB) return 'starts';
      return 'startedBy';
    }

    if (sA < sB) {
      if (eA < sB) return 'before';
      if (eA === sB) return 'meets';
      if (eA < eB) return 'overlaps';
      if (eA === eB) return 'finishedBy';
      return 'contains';
    }

    // Here sA > sB
    if (sA > eB) return 'after';
    if (sA === eB) return 'metBy';
    if (eB < eA) return 'overlappedBy';
    if (eA === eB) return 'finishes';
    return 'during';
  }

  isBefore(other: Interval): boolean {
    return this.end.isBefore(other.start);
  }

  isAfter(other: Interval): boolean {
    return this.start.isAfter(other.end);
  }

  meets(other: Interval): boolean {
    return this.end.equals(other.start);
  }

  isMetBy(other: Interval): boolean {
    return this.start.equals(other.end);
  }

  overlapsRelation(other: Interval): boolean {
    return this.relationTo(other) === 'overlaps';
  }

  isOverlappedBy(other: Interval): boolean {
    return this.relationTo(other) === 'overlappedBy';
  }

  starts(other: Interval): boolean {
    return this.relationTo(other) === 'starts';
  }

  isStartedBy(other: Interval): boolean {
    return this.relationTo(other) === 'startedBy';
  }

  during(other: Interval): boolean {
    return this.relationTo(other) === 'during';
  }

  containsInterval(other: Interval): boolean {
    return this.relationTo(other) === 'contains';
  }

  finishes(other: Interval): boolean {
    return this.relationTo(other) === 'finishes';
  }

  isFinishedBy(other: Interval): boolean {
    return this.relationTo(other) === 'finishedBy';
  }

  // --- Serialization ---

  toJSON(): IntervalJSON {
    return {
      start: this.start.toJSON(),
      end: this.end.toJSON(),
    };
  }

  static fromJSON(json: IntervalJSON): Interval {
    if (typeof json !== 'object' || json === null || !('start' in json) || !('end' in json)) {
      throw new TypeError('Invalid JSON representation for Interval');
    }
    return new Interval(Instant.fromJSON(json.start), Instant.fromJSON(json.end));
  }

  toString(): string {
    return `[${this.start.toISOString()}, ${this.end.toISOString()})`;
  }
}
