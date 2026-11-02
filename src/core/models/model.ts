/**
 * @file model.ts
 * Core temporal model interfaces and metadata definitions.
 */

import { Duration } from '../primitives/duration.js';
import { Instant } from '../primitives/instant.js';
import { Interval } from '../primitives/interval.js';
import { Place } from '../primitives/place.js';

/**
 * Explicit accuracy profile documenting time resolution, margin of error,
 * assumptions, and validity range of a temporal model.
 */
export interface ModelAccuracyProfile {
  /**
   * Smallest meaningful time resolution supported by the model calculations.
   */
  readonly timeResolution: Duration;

  /**
   * Quantified or descriptive margin of error (e.g. "±0.01° for 1800-2100 CE").
   */
  readonly marginOfError: string;

  /**
   * Scientific or numerical assumptions under which the accuracy holds.
   */
  readonly assumptions?: readonly string[];

  /**
   * Domain validity interval on the physical timeline.
   */
  readonly validityRange?: Interval;
}

/**
 * Standardized metadata for all ChronoFlux temporal models.
 */
export interface ModelMetadata {
  /**
   * Unique identifier or human-readable model name.
   */
  readonly name: string;

  /**
   * Semantic version string of the model algorithm implementation.
   */
  readonly version: string;

  /**
   * Quantified accuracy profile.
   */
  readonly accuracy: {
    readonly timeResolution: Duration;
    readonly marginOfError: string;
  };

  /**
   * Scientific or numerical assumptions required by the model.
   */
  readonly assumptions: readonly string[];

  /**
   * Valid temporal range for which the model is calibrated.
   */
  readonly validityRange?: Interval;
}

/**
 * Universal interface for all domain temporal models in ChronoFlux.
 * A TemporalModel evaluates continuous or civil state at an Instant and Place.
 */
export interface TemporalModel<TState> {
  /**
   * Metadata describing model name, version, and accuracy bounds.
   */
  readonly metadata: ModelMetadata;

  /**
   * Evaluates domain state for a given physical Instant and geographic Place.
   */
  evaluate(instant: Instant, place: Place): TState;

  /**
   * Optional numerical solver finding transition boundary instants within a search window.
   */
  findTransitions?(
    place: Place,
    searchWindow: Interval,
    threshold: number
  ): Instant[];
}
