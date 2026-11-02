/**
 * @file interval-set.ts
 * Discrete set of sorted, non-overlapping, non-adjacent half-open intervals on the timeline.
 */

import { Duration } from './duration.js';
import { Instant } from './instant.js';
import { Interval } from './interval.js';
import { IntervalSetJSON } from './types.js';

/**
 * IntervalSet represents a finite union of half-open intervals:
 * S = \bigcup_{i=0}^{n-1} [s_i, e_i)
 *
 * Canonical Representation Invariants:
 * 1. Strictly Sorted: For all i < n - 1: intervals[i].start < intervals[i+1].start.
 * 2. Non-Overlapping & Non-Adjacent: For all i < n - 1: intervals[i].end < intervals[i+1].start.
 *    Any adjacent intervals [a, b) and [b, c) are automatically normalized and merged into [a, c).
 * 3. Empty Representation: Represented canonically as an empty array of intervals.
 */
export class IntervalSet implements Iterable<Interval> {
  readonly intervals: readonly Interval[];

  private constructor(intervals: readonly Interval[]) {
    this.intervals = Object.freeze(intervals.slice());
    Object.freeze(this);
  }

  // --- Static Factories ---

  /**
   * The canonical empty interval set.
   */
  static empty(): IntervalSet {
    return new IntervalSet([]);
  }

  /**
   * Constructs an IntervalSet containing a single interval.
   */
  static fromInterval(interval: Interval): IntervalSet {
    if (!(interval instanceof Interval)) {
      throw new TypeError('Expected an Interval instance');
    }
    return new IntervalSet([interval]);
  }

  /**
   * Constructs a canonical IntervalSet from any arbitrary collection of intervals,
   * performing sorting, overlapping interval merging, and adjacent interval consolidation.
   */
  static from(intervals: Iterable<Interval>): IntervalSet {
    const list = Array.from(intervals);
    if (list.length === 0) {
      return IntervalSet.empty();
    }

    for (const item of list) {
      if (!(item instanceof Interval)) {
        throw new TypeError('All items in Iterable must be valid Interval instances');
      }
    }

    const normalized = IntervalSet.normalize(list);
    return new IntervalSet(normalized);
  }

  /**
   * Fast-path factory when caller provides intervals that are already sorted, non-overlapping, and non-adjacent.
   * Validates canonical invariants to guarantee set integrity.
   */
  static fromSortedDisjoint(intervals: readonly Interval[]): IntervalSet {
    if (!Array.isArray(intervals)) {
      throw new TypeError('Expected an array of intervals in fromSortedDisjoint');
    }
    for (let i = 0; i < intervals.length; i++) {
      const current = intervals[i];
      if (!(current instanceof Interval)) {
        throw new TypeError('All items in intervals must be valid Interval instances');
      }
      if (i > 0) {
        const prev = intervals[i - 1]!;
        if (!prev.end.isBefore(current.start)) {
          throw new RangeError(
            `Intervals in fromSortedDisjoint must be strictly sorted and non-adjacent: ` +
              `previous end=${prev.end.toISOString()} is not before current start=${current.start.toISOString()}`
          );
        }
      }
    }
    return new IntervalSet(intervals.slice());
  }

  // --- Normalization Algorithm ---

  /**
   * Sorts and merges an arbitrary list of intervals into canonical form.
   * Adjacent intervals [a, b) and [b, c) are merged into [a, c).
   */
  private static normalize(raw: Interval[]): Interval[] {
    if (raw.length <= 1) {
      return raw.slice();
    }

    // Sort primarily by start instant, secondarily by end instant
    const sorted = raw.slice().sort((a, b) => {
      const cmp = a.start.compareTo(b.start);
      if (cmp !== 0) return cmp;
      return a.end.compareTo(b.end);
    });

    const merged: Interval[] = [];
    let current = sorted[0]!;

    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i]!;

      // Check if current and next overlap OR are adjacent:
      // Half-open intervals [s_1, e_1) and [s_2, e_2) touch or overlap iff s_2 <= e_1.
      if (next.start.isBeforeOrEqual(current.end)) {
        // Merge: new end is max(current.end, next.end)
        const maxEnd = current.end.isAfter(next.end) ? current.end : next.end;
        current = new Interval(current.start, maxEnd);
      } else {
        merged.push(current);
        current = next;
      }
    }

    merged.push(current);
    return merged;
  }

  // --- Invariant Checks & Introspection ---

  isEmpty(): boolean {
    return this.intervals.length === 0;
  }

  count(): number {
    return this.intervals.length;
  }

  /**
   * Computes the total physical duration encompassed by all intervals in this set.
   */
  totalDuration(): Duration {
    let totalNs = 0n;
    for (const interval of this.intervals) {
      totalNs += interval.duration.nanoseconds;
    }
    return new Duration(totalNs);
  }

  /**
   * Returns the minimal continuous Interval spanning from the start of the first interval
   * to the end of the last interval, or null if the set is empty.
   */
  span(): Interval | null {
    if (this.intervals.length === 0) {
      return null;
    }
    const first = this.intervals[0]!;
    const last = this.intervals[this.intervals.length - 1]!;
    return new Interval(first.start, last.end);
  }

  /**
   * Checks whether a specific Instant is contained within any interval of this set:
   * exists I in this: I.start <= instant < I.end.
   * Executes via binary search in O(log N) time.
   */
  contains(instant: Instant): boolean {
    if (!(instant instanceof Instant)) {
      throw new TypeError('Expected an Instant instance in IntervalSet.contains');
    }
    if (this.intervals.length === 0) return false;

    let low = 0;
    let high = this.intervals.length - 1;

    while (low <= high) {
      const mid = (low + high) >> 1;
      const interval = this.intervals[mid]!;

      if (interval.contains(instant)) {
        return true;
      }

      if (instant.isBefore(interval.start)) {
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    return false;
  }

  /**
   * Checks whether an entire interval is completely enclosed by this set.
   * Because intervals in canonical form are pairwise disjoint, an interval can be enclosed
   * by this set if and only if some single component interval encloses it.
   */
  encloses(interval: Interval): boolean {
    if (!(interval instanceof Interval)) {
      throw new TypeError('Expected an Interval instance in IntervalSet.encloses');
    }
    if (this.intervals.length === 0) return false;

    let low = 0;
    let high = this.intervals.length - 1;

    while (low <= high) {
      const mid = (low + high) >> 1;
      const candidate = this.intervals[mid]!;

      if (candidate.encloses(interval)) {
        return true;
      }

      if (interval.start.isBefore(candidate.start)) {
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    return false;
  }

  // --- Set Algebra Operations ---

  /**
   * Computes the mathematical union: this \cup other.
   */
  union(other: IntervalSet | Interval): IntervalSet {
    const otherSet = other instanceof IntervalSet ? other : IntervalSet.fromInterval(other);

    if (this.isEmpty()) return otherSet;
    if (otherSet.isEmpty()) return this;

    const combined: Interval[] = [];
    let i = 0;
    let j = 0;

    // Merge two sorted lists into one before normalization
    while (i < this.intervals.length && j < otherSet.intervals.length) {
      const a = this.intervals[i]!;
      const b = otherSet.intervals[j]!;
      if (a.start.isBefore(b.start)) {
        combined.push(a);
        i++;
      } else {
        combined.push(b);
        j++;
      }
    }
    while (i < this.intervals.length) {
      combined.push(this.intervals[i]!);
      i++;
    }
    while (j < otherSet.intervals.length) {
      combined.push(otherSet.intervals[j]!);
      j++;
    }

    return new IntervalSet(IntervalSet.normalize(combined));
  }

  /**
   * Computes the mathematical intersection: this \cap other.
   * Runs in O(N + M) time via a two-pointer interval sweep.
   */
  intersect(other: IntervalSet | Interval): IntervalSet {
    const otherSet = other instanceof IntervalSet ? other : IntervalSet.fromInterval(other);

    if (this.isEmpty() || otherSet.isEmpty()) {
      return IntervalSet.empty();
    }

    const result: Interval[] = [];
    let i = 0;
    let j = 0;

    while (i < this.intervals.length && j < otherSet.intervals.length) {
      const a = this.intervals[i]!;
      const b = otherSet.intervals[j]!;

      const maxStart = a.start.isAfter(b.start) ? a.start : b.start;
      const minEnd = a.end.isBefore(b.end) ? a.end : b.end;

      if (maxStart.isBefore(minEnd)) {
        result.push(new Interval(maxStart, minEnd));
      }

      if (a.end.isBefore(b.end)) {
        i++;
      } else if (b.end.isBefore(a.end)) {
        j++;
      } else {
        i++;
        j++;
      }
    }

    // Intersections of canonical sets are automatically canonical (sorted, disjoint, non-adjacent).
    return new IntervalSet(result);
  }

  /**
   * Computes the set difference: this \setminus other.
   * Returns all points in this that do not belong to other.
   */
  difference(other: IntervalSet | Interval): IntervalSet {
    const otherSet = other instanceof IntervalSet ? other : IntervalSet.fromInterval(other);

    if (this.isEmpty()) return IntervalSet.empty();
    if (otherSet.isEmpty()) return this;

    const result: Interval[] = [];

    for (const a of this.intervals) {
      let currentStart = a.start;

      for (const b of otherSet.intervals) {
        if (b.end.isBeforeOrEqual(currentStart)) {
          // b is strictly before current remainder
          continue;
        }
        if (b.start.isAfterOrEqual(a.end)) {
          // b is strictly after a; since otherSet is sorted, no subsequent b can touch a
          break;
        }

        // b overlaps or touches current piece
        if (b.start.isAfter(currentStart)) {
          // Keep left slice: [currentStart, b.start)
          result.push(new Interval(currentStart, b.start));
        }

        // Advance currentStart past b.end
        if (b.end.isAfter(currentStart)) {
          currentStart = b.end;
        }

        if (currentStart.isAfterOrEqual(a.end)) {
          // Interval a completely subtracted
          break;
        }
      }

      if (currentStart.isBefore(a.end)) {
        // Remaining tail slice: [currentStart, a.end)
        result.push(new Interval(currentStart, a.end));
      }
    }

    return new IntervalSet(result);
  }

  /**
   * Computes the bounded complement within an explicit bounding Interval:
   * complement(within) = within \setminus this.
   */
  complement(within: Interval): IntervalSet {
    if (!(within instanceof Interval)) {
      throw new TypeError('Expected an Interval instance as boundary in IntervalSet.complement');
    }
    return IntervalSet.fromInterval(within).difference(this);
  }

  equals(other: unknown): boolean {
    if (!(other instanceof IntervalSet)) return false;
    if (this.intervals.length !== other.intervals.length) return false;

    for (let i = 0; i < this.intervals.length; i++) {
      if (!this.intervals[i]!.equals(other.intervals[i]!)) {
        return false;
      }
    }
    return true;
  }

  [Symbol.iterator](): Iterator<Interval> {
    return this.intervals[Symbol.iterator]();
  }

  // --- Serialization ---

  toJSON(): IntervalSetJSON {
    return {
      intervals: this.intervals.map((iv) => iv.toJSON()),
    };
  }

  static fromJSON(json: IntervalSetJSON): IntervalSet {
    if (typeof json !== 'object' || json === null || !Array.isArray(json.intervals)) {
      throw new TypeError('Invalid JSON representation for IntervalSet');
    }
    const parsed = json.intervals.map((iv) => Interval.fromJSON(iv));
    return IntervalSet.from(parsed);
  }

  toString(): string {
    return `{ ${this.intervals.map((iv) => iv.toString()).join(', ')} }`;
  }
}
