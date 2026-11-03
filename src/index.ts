/**
 * @file index.ts
 * Main entry point for @chronoflux/core.
 */

import {
  civilModel,
  CivilModel,
  CivilState,
  CivilDateTimeInput,
  TimeZoneLookupProvider,
  CivilTimeProvenance,
} from './core/models/civil/index.js';
import {
  solarModel,
  SolarModel,
  SolarState,
  SolarEventOptions,
  InstantaneousSolarPosition,
  AstronomicalTimeScale,
  AstronomicalTimeScaleOptions,
  createAstronomicalTimeScale,
  validateAstronomicalTimeScale,
  getAstronomicalTimeScale,
  registerAstronomicalTimeScale,
} from './core/models/solar/index.js';
import { Duration, DurationFields } from './core/primitives/duration.js';
import { Instant } from './core/primitives/instant.js';
import { Interval } from './core/primitives/interval.js';
import { IntervalSet } from './core/primitives/interval-set.js';
import { Place, PlaceOptions } from './core/primitives/place.js';
import { RoundingMode } from './core/primitives/types.js';
import {
  Conditions,
  resolve,
  ResolveOptions,
  ResolutionResult,
} from './core/resolver/index.js';

export * from './core/index.js';

// Explicit type re-exports ensuring clean accessibility at the package root level
export type {
  // Core Primitives
  RoundingMode,
  AngleUnit,
  TimeUnit,
  AllenRelation,
  DurationFields,
  PlaceOptions,
  InstantJSON,
  DurationJSON,
  PlaceJSON,
  IntervalJSON,
  IntervalSetJSON,
  InstantParseOptions,
  LeapSecondPolicy,

  // Astronomical Solar Model
  SolarState,
  SolarPhase,
  PolarRegimeType,
  CrossingCondition,
  SolarUncertaintyDetails,
  SolarEventOptions,
  SolarEventName,
  SolarEventInstant,
  SolarTransitionInstant,
  InstantaneousSolarPosition,
  AstronomicalTimeScale,
  AstronomicalTimeScaleOptions,

  // Civil Calendar & IANA Time Zone Model
  CivilState,
  CivilDateTimeInput,
  TimeZoneLookupProvider,
  CivilTimeProvenance,
  DisambiguationPolicy,
  DstDisambiguation,
  DstConfidence,
  CivilTransitionInfo,

  // Temporal Conditions & Resolver
  ConditionAST,
  AtomicConditionNode,
  LogicalConditionNode,
  SolarComparisonNode,
  CivilComparisonNode,
  ComparisonOperator,
  LogicalOperator,
  SolarProperty,
  CivilProperty,
  ModelDomain,
  ResolveOptions,
  ResolutionResult,
  ResolutionReport,
  IntervalExplanation,
  BoundaryExplanation,
  SelectionPolicy,
} from './core/index.js';

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
   * Constructs an Instant from nanoseconds, milliseconds, Date, ISO string, or another Instant.
   */
  instant(
    source: bigint | number | Date | string | Instant | { readonly epochNanoseconds: bigint },
    roundingMode?: RoundingMode
  ): Instant {
    if (source instanceof Instant) {
      return source;
    }
    if (
      typeof source === 'object' &&
      source !== null &&
      'epochNanoseconds' in source &&
      typeof (source as { epochNanoseconds: unknown }).epochNanoseconds === 'bigint'
    ) {
      return new Instant((source as { epochNanoseconds: bigint }).epochNanoseconds);
    }
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
    /**
     * Constructs an empty IntervalSet containing 0 intervals.
     */
    empty(): IntervalSet {
      return IntervalSet.empty();
    },
    /**
     * Constructs a canonical IntervalSet from an iterable collection of Interval objects.
     */
    from(intervals: Iterable<Interval>): IntervalSet {
      return IntervalSet.from(intervals);
    },
    /**
     * Constructs a canonical IntervalSet from variable Interval arguments.
     */
    of(...intervals: Interval[]): IntervalSet {
      return IntervalSet.from(intervals);
    },
  }),

  /**
   * Astronomical Solar Model namespace.
   */
  solar: Object.freeze({
    /**
     * Evaluates instantaneous solar position without diurnal event solving overhead.
     */
    evaluatePosition(instant: Instant, place: Place): InstantaneousSolarPosition {
      return solarModel.evaluatePosition(instant, place);
    },

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
     * Creates an astronomical time scale provider with canonical conversions.
     */
    createAstronomicalTimeScale(options: AstronomicalTimeScaleOptions): AstronomicalTimeScale {
      return createAstronomicalTimeScale(options);
    },

    /**
     * Validates an astronomical time scale provider for self-consistency.
     */
    validateAstronomicalTimeScale(provider: AstronomicalTimeScale, testInstant?: Instant): void {
      validateAstronomicalTimeScale(provider, testInstant);
    },

    /**
     * Registers a pluggable astronomical time scale provider.
     */
    registerAstronomicalTimeScale(
      provider: AstronomicalTimeScale | null,
      options?: { validate?: boolean }
    ): void {
      registerAstronomicalTimeScale(provider, options);
    },

    /**
     * Retrieves the current active astronomical time scale provider.
     */
    getAstronomicalTimeScale(): AstronomicalTimeScale {
      return getAstronomicalTimeScale();
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
       * Registers a global pluggable geographic timezone lookup provider.
       */
      registerTimeZoneLookupProvider(provider: TimeZoneLookupProvider | null): void {
        civilModel.registerTimeZoneLookupProvider(provider);
      },

      /**
       * Gets the currently registered geographic timezone lookup provider.
       */
      getTimeZoneLookupProvider(): TimeZoneLookupProvider | null {
        return civilModel.getTimeZoneLookupProvider();
      },

      /**
       * Returns provenance metadata about the runtime environment and IANA tz database.
       */
      getProvenance(): CivilTimeProvenance {
        return civilModel.getProvenance();
      },

      /**
       * The underlying CivilModel instance.
       */
      model: civilModel as CivilModel,
    });
  })(),

  /**
   * Fluent temporal condition query builder.
   */
  conditions: Conditions,

  /**
   * Resolves a declarative temporal condition AST into continuous, mathematically verified
   * half-open interval sets with complete boundary provenance.
   */
  resolve(options: ResolveOptions): ResolutionResult {
    return resolve(options);
  },
});

export default ChronoFlux;
