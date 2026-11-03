/**
 * @file intent.ts
 * Temporal intent policy filtering and duration constraints.
 * Implements 'all', 'earliest', 'latest', and 'longest' selection policies,
 * and enforces minDuration threshold filters.
 */

import { Duration } from '../primitives/duration.js';
import { Interval } from '../primitives/interval.js';
import { IntervalSet } from '../primitives/interval-set.js';

export type SelectionPolicy = 'all' | 'earliest' | 'latest' | 'longest';

/**
 * Applies minDuration filtering and selection policy to an IntervalSet.
 */
export function applyIntentPolicy(
  intervals: IntervalSet,
  policy: SelectionPolicy = 'all',
  minDuration?: Duration
): IntervalSet {
  let candidates: readonly Interval[] = intervals.intervals;

  // 1. Filter out intervals shorter than minDuration
  if (minDuration !== undefined) {
    if (!(minDuration instanceof Duration)) {
      throw new TypeError('Expected minDuration to be an instance of Duration');
    }
    if (minDuration.isNegative()) {
      throw new RangeError('minDuration must be non-negative');
    }
    candidates = candidates.filter((interval) => !interval.duration.isLessThan(minDuration));
  }

  if (candidates.length === 0) {
    return IntervalSet.empty();
  }

  // 2. Apply selection policy
  switch (policy) {
    case 'all':
      return IntervalSet.fromSortedDisjoint(candidates);

    case 'earliest':
      return IntervalSet.fromInterval(candidates[0]!);

    case 'latest':
      return IntervalSet.fromInterval(candidates[candidates.length - 1]!);

    case 'longest': {
      let longest = candidates[0]!;
      for (let i = 1; i < candidates.length; i++) {
        const current = candidates[i]!;
        if (current.duration.isGreaterThan(longest.duration)) {
          longest = current;
        }
      }
      return IntervalSet.fromInterval(longest);
    }

    default:
      throw new TypeError(`Unknown selection policy: ${policy}`);
  }
}
