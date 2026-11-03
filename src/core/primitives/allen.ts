/**
 * @file allen.ts
 * Allen's 13 Elementary Interval Relationships (James F. Allen, 1983).
 *
 * For any two half-open intervals A = [s_A, e_A) and B = [s_B, e_B) where s_A < e_A and s_B < e_B,
 * exactly one of the 13 relationships holds.
 */

import type { AllenRelation } from './types.js';

export type { AllenRelation };

/**
 * Returns the formal converse relationship for a given Allen relation.
 *
 * Satisfies the involution property: converse(converse(R)) === R.
 */
export function converseRelation(relation: AllenRelation): AllenRelation {
  switch (relation) {
    case 'before':
      return 'after';
    case 'after':
      return 'before';
    case 'meets':
      return 'metBy';
    case 'metBy':
      return 'meets';
    case 'overlaps':
      return 'overlappedBy';
    case 'overlappedBy':
      return 'overlaps';
    case 'starts':
      return 'startedBy';
    case 'startedBy':
      return 'starts';
    case 'during':
      return 'contains';
    case 'contains':
      return 'during';
    case 'finishes':
      return 'finishedBy';
    case 'finishedBy':
      return 'finishes';
    case 'equals':
      return 'equals';
    default: {
      const exhaustiveCheck: never = relation;
      throw new RangeError(`Unknown Allen relation: ${exhaustiveCheck}`);
    }
  }
}
