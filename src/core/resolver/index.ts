/**
 * @file index.ts
 * Public entrypoint for the ChronoFlux Temporal Conditions and Resolver module.
 */

import { Duration } from '../primitives/duration.js';
import { Interval } from '../primitives/interval.js';
import { IntervalSet } from '../primitives/interval-set.js';
import { Place } from '../primitives/place.js';
import { ConditionAST, validateConditionAST } from './ast.js';
import { createResolutionContext, resolveAST } from './engine.js';
import { applyIntentPolicy, SelectionPolicy } from './intent.js';
import { buildResolutionReport, ResolutionReport } from './report.js';

export * from './ast.js';
export * from './builder.js';
export * from './solver-solar.js';
export * from './solver-civil.js';
export * from './engine.js';
export * from './intent.js';
export * from './report.js';

export interface ResolveOptions {
  readonly place: Place;
  readonly within: Interval;
  readonly where: ConditionAST;
  readonly policy?: SelectionPolicy;
  readonly minDuration?: Duration;
}

export interface ResolutionResult {
  /**
   * The final resolved interval set after applying selection policy and duration constraints.
   */
  readonly intervals: IntervalSet;

  /**
   * The complete set of matching intervals before policy selection was applied.
   */
  readonly allMatchingIntervals: IntervalSet;

  /**
   * Mathematical provenance report detailing boundary reasons, residuals, and consulted models.
   */
  readonly report: ResolutionReport;
}

/**
 * Resolves a declarative temporal condition AST into continuous, mathematically verified
 * half-open interval sets with full boundary provenance.
 */
export function resolve(options: ResolveOptions): ResolutionResult {
  if (typeof options !== 'object' || options === null) {
    throw new TypeError('resolve() requires an options object');
  }

  const { place, within, where, policy = 'all', minDuration } = options;

  if (!(place instanceof Place)) {
    throw new TypeError('options.place must be an instance of Place');
  }

  if (!(within instanceof Interval)) {
    throw new TypeError('options.within must be an instance of Interval');
  }

  validateConditionAST(where);

  if (minDuration !== undefined) {
    if (!(minDuration instanceof Duration)) {
      throw new TypeError('options.minDuration must be an instance of Duration');
    }
    if (minDuration.isNegative()) {
      throw new RangeError('options.minDuration must be non-negative');
    }
  }

  const validPolicies: readonly SelectionPolicy[] = ['all', 'earliest', 'latest', 'longest'];
  if (!validPolicies.includes(policy)) {
    throw new TypeError(`Invalid policy: ${policy}. Expected one of: ${validPolicies.join(', ')}`);
  }

  const startMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const ctx = createResolutionContext(place, within);

  // 1. Resolve raw matching intervals via algebraic AST dispatch
  const allMatchingIntervals = resolveAST(where, ctx);

  // 2. Apply intent selection policy and duration constraints
  const intervals = applyIntentPolicy(allMatchingIntervals, policy, minDuration);

  const endMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const executionTimeMs = endMs - startMs;

  // 3. Assemble detailed resolution report
  const report = buildResolutionReport(
    where,
    intervals,
    ctx,
    policy,
    minDuration,
    executionTimeMs,
    allMatchingIntervals
  );

  return Object.freeze({
    intervals,
    allMatchingIntervals,
    report,
  });
}
