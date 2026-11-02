/**
 * @file index.ts
 * Main entry point for @chronoflux/core.
 */

import { civilModel, CivilModel, CivilState, CivilDateTimeInput } from './core/models/civil/index.js';
import { solarModel, SolarModel, SolarState, SolarEventOptions } from './core/models/solar/index.js';
import { Duration, DurationFields } from './core/primitives/duration.js';
import { Instant } from './core/primitives/instant.js';
import { Interval } from './core/primitives/interval.js';
import { IntervalSet } from './core/primitives/interval-set.js';
import { Place, PlaceOptions } from './core/primitives/place.js';
import { RoundingMode } from './core/primitives/types.js';

export * from './core/index.js';

/**
 * ChronoFlux public developer facade.
 * Provides concise and ergonomic factory methods for temporal foundations,
 * astronomical solar calculations, and civil time evaluation.
 */
export const ChronoFlux = Object.freeze({
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
  duration: Object.freeze({
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
  }),

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
  intervalSet: Object.freeze({
    empty(): IntervalSet {
      return IntervalSet.empty();
    },
    from(intervals: Iterable<Interval>): IntervalSet {
      return IntervalSet.from(intervals);
    },
    of(...intervals: Interval[]): IntervalSet {
      return IntervalSet.from(intervals);
    },
  }),

  /**
   * Astronomical Solar Model namespace.
   */
  solar: Object.freeze({
    /**
     * Evaluates full astronomical solar state at a given Instant and Place.
     */
    evaluate(instant: Instant, place: Place): SolarState {
      return solarModel.evaluate(instant, place);
    },

    /**
     * Finds the next discrete solar event (sunrise, sunset, noon, midnight, dawn, dusk).
     */
    nextEvent(options: SolarEventOptions): Instant | null {
      return solarModel.nextEvent(options);
    },

    /**
     * Finds all transition boundary instants where solar elevation crosses a threshold
     * within a search interval.
     */
    findTransitions(place: Place, searchWindow: Interval, thresholdDeg: number): Instant[] {
      return solarModel.findTransitions(place, searchWindow, thresholdDeg);
    },

    /**
     * The underlying SolarModel instance.
     */
    model: solarModel as SolarModel,
  }),

  /**
   * Civil Calendar and IANA Time Zone Model namespace.
   */
  civil: (() => {
    const resolve = (input: CivilDateTimeInput): Instant => civilModel.resolve(input);
    return Object.freeze({
      /**
       * Evaluates local civil calendar state for a given Instant and Place (or timeZoneId).
       */
      evaluate(instant: Instant, placeOrTimeZone: Place | string): CivilState {
        return civilModel.evaluate(instant, placeOrTimeZone);
      },

      /**
       * Resolves a local civil calendar date/time into a physical Instant with DST disambiguation.
       */
      resolve,

      /**
       * Alias for resolve(). Resolves civil wall-clock time with explicit DST disambiguation.
       */
      disambiguate: resolve,

      /**
       * The underlying CivilModel instance.
       */
      model: civilModel as CivilModel,
    });
  })(),
});
