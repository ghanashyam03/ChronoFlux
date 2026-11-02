/**
 * @file index.ts
 * Main entry point for @chronoflux/core.
 */

import { Duration, DurationFields } from './core/primitives/duration.js';
import { Instant } from './core/primitives/instant.js';
import { Interval } from './core/primitives/interval.js';
import { IntervalSet } from './core/primitives/interval-set.js';
import { Place, PlaceOptions } from './core/primitives/place.js';

export * from './core/index.js';

/**
 * ChronoFlux public developer facade.
 * Provides concise and ergonomic factory methods for all Phase 1 temporal foundations.
 */
export const ChronoFlux = {
  /**
   * Captures the current wall-clock instant.
   */
  now(): Instant {
    return Instant.now();
  },

  /**
   * Constructs an Instant from nanoseconds, milliseconds, Date, or ISO string.
   */
  instant(source: bigint | number | Date | string): Instant {
    if (typeof source === 'bigint') {
      return Instant.fromEpochNanoseconds(source);
    }
    if (typeof source === 'number') {
      return Instant.fromEpochMilliseconds(source);
    }
    if (source instanceof Date) {
      return Instant.fromDate(source);
    }
    if (typeof source === 'string') {
      return Instant.fromJSON(source);
    }
    throw new TypeError(`Cannot construct Instant from source: ${source}`);
  },

  /**
   * Duration factory methods and unit helpers.
   */
  duration: {
    nanoseconds(ns: bigint | number): Duration {
      return Duration.fromNanoseconds(ns);
    },
    microseconds(us: bigint | number): Duration {
      return Duration.fromMicroseconds(us);
    },
    milliseconds(ms: bigint | number): Duration {
      return Duration.fromMilliseconds(ms);
    },
    seconds(s: bigint | number): Duration {
      return Duration.fromSeconds(s);
    },
    minutes(m: bigint | number): Duration {
      return Duration.fromMinutes(m);
    },
    hours(h: bigint | number): Duration {
      return Duration.fromHours(h);
    },
    days(d: bigint | number): Duration {
      return Duration.fromDays(d);
    },
    of(fields: DurationFields): Duration {
      return Duration.of(fields);
    },
    zero(): Duration {
      return Duration.zero();
    },
  },

  /**
   * Constructs an immutable Place on the WGS84 ellipsoid.
   */
  place(options: PlaceOptions): Place {
    return new Place(options);
  },

  /**
   * Constructs a half-open temporal interval [start, end).
   */
  interval(start: Instant, end: Instant): Interval {
    return new Interval(start, end);
  },

  /**
   * IntervalSet factory methods.
   */
  intervalSet: {
    empty(): IntervalSet {
      return IntervalSet.empty();
    },
    from(intervals: Iterable<Interval>): IntervalSet {
      return IntervalSet.from(intervals);
    },
    of(...intervals: Interval[]): IntervalSet {
      return IntervalSet.from(intervals);
    },
  },
};
