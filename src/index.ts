/**
 * @file index.ts
 * Main entry point for @chronoflux/core.
 */

import { Duration, DurationFields } from './core/primitives/duration.js';
import { Instant } from './core/primitives/instant.js';
import { Interval } from './core/primitives/interval.js';
import { IntervalSet } from './core/primitives/interval-set.js';
import { Place, PlaceOptions } from './core/primitives/place.js';
import { RoundingMode } from './core/primitives/types.js';

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
  instant(source: bigint | number | Date | string, roundingMode?: RoundingMode): Instant {
    if (typeof source === 'bigint') {
      return Instant.fromEpochNanoseconds(source, roundingMode);
    }
    if (typeof source === 'number') {
      return Instant.fromEpochMilliseconds(source, roundingMode);
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
    nanoseconds(ns: bigint | number | string, roundingMode?: RoundingMode): Duration {
      return Duration.fromNanoseconds(ns, roundingMode);
    },
    microseconds(us: bigint | number | string, roundingMode?: RoundingMode): Duration {
      return Duration.fromMicroseconds(us, roundingMode);
    },
    milliseconds(ms: bigint | number | string, roundingMode?: RoundingMode): Duration {
      return Duration.fromMilliseconds(ms, roundingMode);
    },
    seconds(s: bigint | number | string, roundingMode?: RoundingMode): Duration {
      return Duration.fromSeconds(s, roundingMode);
    },
    minutes(m: bigint | number | string, roundingMode?: RoundingMode): Duration {
      return Duration.fromMinutes(m, roundingMode);
    },
    hours(h: bigint | number | string, roundingMode?: RoundingMode): Duration {
      return Duration.fromHours(h, roundingMode);
    },
    days(d: bigint | number | string, roundingMode?: RoundingMode): Duration {
      return Duration.fromDays(d, roundingMode);
    },
    of(fields: DurationFields, roundingMode?: RoundingMode): Duration {
      return Duration.of(fields, roundingMode);
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
