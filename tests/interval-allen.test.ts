import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  AllenRelation,
  converseRelation,
  Duration,
  Instant,
  Interval,
} from '../src/index.js';

describe('Interval Primitive & Allen 13 Relations', () => {
  const i0 = Instant.fromEpochNanoseconds(0n);
  const i5 = Instant.fromEpochNanoseconds(500n);
  const i10 = Instant.fromEpochNanoseconds(1000n);
  const i15 = Instant.fromEpochNanoseconds(1500n);
  const i20 = Instant.fromEpochNanoseconds(2000n);
  const i25 = Instant.fromEpochNanoseconds(2500n);
  const i30 = Instant.fromEpochNanoseconds(3000n);

  describe('Contract Invariants & Construction', () => {
    it('creates half-open interval when start < end', () => {
      const iv = new Interval(i0, i10);
      expect(iv.start.equals(i0)).toBe(true);
      expect(iv.end.equals(i10)).toBe(true);
      expect(iv.duration.nanoseconds).toBe(1000n);
    });

    it('creates interval from duration', () => {
      const iv = Interval.fromDuration(i0, Duration.fromNanoseconds(500n));
      expect(iv.start.equals(i0)).toBe(true);
      expect(iv.end.equals(i5)).toBe(true);
    });

    it('rejects non-positive durations in Interval.fromDuration', () => {
      expect(() => Interval.fromDuration(i0, Duration.zero())).toThrow(RangeError);
      expect(() => Interval.fromDuration(i0, Duration.fromNanoseconds(-10n))).toThrow(RangeError);
    });

    it('throws RangeError on zero-length intervals (start === end)', () => {
      expect(() => new Interval(i10, i10)).toThrow(RangeError);
    });

    it('throws RangeError on reversed intervals (start > end)', () => {
      expect(() => new Interval(i20, i10)).toThrow(RangeError);
    });

    it('throws TypeError if start or end is not an Instant', () => {
      expect(() => new (Interval as any)(null, i10)).toThrow(TypeError);
      expect(() => new (Interval as any)(i0, 'invalid')).toThrow(TypeError);
    });
  });

  describe("Allen's 13 Elementary Relations (Concrete Verifications)", () => {
    // 1. Before: A = [0, 10), B = [20, 30)
    it('1. verifies "before" relationship', () => {
      const A = new Interval(i0, i10);
      const B = new Interval(i20, i30);
      expect(A.relationTo(B)).toBe('before');
      expect(A.isBefore(B)).toBe(true);
    });

    // 2. After: A = [20, 30), B = [0, 10)
    it('2. verifies "after" relationship (converse of before)', () => {
      const A = new Interval(i20, i30);
      const B = new Interval(i0, i10);
      expect(A.relationTo(B)).toBe('after');
      expect(A.isAfter(B)).toBe(true);
    });

    // 3. Meets: A = [0, 10), B = [10, 20)
    it('3. verifies "meets" relationship', () => {
      const A = new Interval(i0, i10);
      const B = new Interval(i10, i20);
      expect(A.relationTo(B)).toBe('meets');
      expect(A.meets(B)).toBe(true);
      expect(A.isAdjacent(B)).toBe(true);
    });

    // 4. Met-by: A = [10, 20), B = [0, 10)
    it('4. verifies "metBy" relationship (converse of meets)', () => {
      const A = new Interval(i10, i20);
      const B = new Interval(i0, i10);
      expect(A.relationTo(B)).toBe('metBy');
      expect(A.isMetBy(B)).toBe(true);
      expect(A.isAdjacent(B)).toBe(true);
    });

    // 5. Overlaps: A = [0, 15), B = [10, 25)
    it('5. verifies "overlaps" relationship', () => {
      const A = new Interval(i0, i15);
      const B = new Interval(i10, i25);
      expect(A.relationTo(B)).toBe('overlaps');
      expect(A.overlapsRelation(B)).toBe(true);
      expect(A.overlaps(B)).toBe(true);
    });

    // 6. Overlapped-by: A = [10, 25), B = [0, 15)
    it('6. verifies "overlappedBy" relationship (converse of overlaps)', () => {
      const A = new Interval(i10, i25);
      const B = new Interval(i0, i15);
      expect(A.relationTo(B)).toBe('overlappedBy');
      expect(A.isOverlappedBy(B)).toBe(true);
      expect(A.overlaps(B)).toBe(true);
    });

    // 7. Starts: A = [0, 10), B = [0, 20)
    it('7. verifies "starts" relationship', () => {
      const A = new Interval(i0, i10);
      const B = new Interval(i0, i20);
      expect(A.relationTo(B)).toBe('starts');
      expect(A.starts(B)).toBe(true);
      expect(B.encloses(A)).toBe(true);
    });

    // 8. Started-by: A = [0, 20), B = [0, 10)
    it('8. verifies "startedBy" relationship (converse of starts)', () => {
      const A = new Interval(i0, i20);
      const B = new Interval(i0, i10);
      expect(A.relationTo(B)).toBe('startedBy');
      expect(A.isStartedBy(B)).toBe(true);
      expect(A.encloses(B)).toBe(true);
    });

    // 9. During: A = [5, 15), B = [0, 20)
    it('9. verifies "during" relationship', () => {
      const A = new Interval(i5, i15);
      const B = new Interval(i0, i20);
      expect(A.relationTo(B)).toBe('during');
      expect(A.during(B)).toBe(true);
      expect(B.encloses(A)).toBe(true);
    });

    // 10. Contains: A = [0, 20), B = [5, 15)
    it('10. verifies "contains" relationship (converse of during)', () => {
      const A = new Interval(i0, i20);
      const B = new Interval(i5, i15);
      expect(A.relationTo(B)).toBe('contains');
      expect(A.containsInterval(B)).toBe(true);
      expect(A.encloses(B)).toBe(true);
    });

    // 11. Finishes: A = [10, 20), B = [0, 20)
    it('11. verifies "finishes" relationship', () => {
      const A = new Interval(i10, i20);
      const B = new Interval(i0, i20);
      expect(A.relationTo(B)).toBe('finishes');
      expect(A.finishes(B)).toBe(true);
      expect(B.encloses(A)).toBe(true);
    });

    // 12. Finished-by: A = [0, 20), B = [10, 20)
    it('12. verifies "finishedBy" relationship (converse of finishes)', () => {
      const A = new Interval(i0, i20);
      const B = new Interval(i10, i20);
      expect(A.relationTo(B)).toBe('finishedBy');
      expect(A.isFinishedBy(B)).toBe(true);
      expect(A.encloses(B)).toBe(true);
    });

    // 13. Equals: A = [0, 10), B = [0, 10)
    it('13. verifies "equals" relationship (self-converse)', () => {
      const A = new Interval(i0, i10);
      const B = new Interval(i0, i10);
      expect(A.relationTo(B)).toBe('equals');
      expect(A.equals(B)).toBe(true);
      expect(converseRelation('equals')).toBe('equals');
    });
  });

  describe('Converse Relationships Exhaustive Check', () => {
    const allRelations: AllenRelation[] = [
      'before',
      'after',
      'meets',
      'metBy',
      'overlaps',
      'overlappedBy',
      'starts',
      'startedBy',
      'during',
      'contains',
      'finishes',
      'finishedBy',
      'equals',
    ];

    it('each relation satisfies converse(converse(R)) === R', () => {
      for (const rel of allRelations) {
        expect(converseRelation(converseRelation(rel))).toBe(rel);
      }
    });
  });

  describe('Set-Theoretic Interval Operations', () => {
    it('contains instant in half-open range [start, end)', () => {
      const iv = new Interval(i10, i20);
      expect(iv.contains(Instant.fromEpochNanoseconds(999n))).toBe(false);
      expect(iv.contains(i10)).toBe(true); // Inclusive start
      expect(iv.contains(i15)).toBe(true);
      expect(iv.contains(i20)).toBe(false); // Exclusive end
      expect(iv.contains(Instant.fromEpochNanoseconds(2001n))).toBe(false);
    });

    it('computes intersection of overlapping intervals', () => {
      const a = new Interval(i0, i15);
      const b = new Interval(i10, i25);
      const inter = a.intersect(b);

      expect(inter).not.toBeNull();
      expect(inter!.start.equals(i10)).toBe(true);
      expect(inter!.end.equals(i15)).toBe(true);
    });

    it('returns null for intersection of disjoint or adjacent intervals', () => {
      const a = new Interval(i0, i10);
      const b = new Interval(i10, i20); // Adjacent (meets)
      const c = new Interval(i20, i30); // Disjoint (before)

      expect(a.intersect(b)).toBeNull();
      expect(a.intersect(c)).toBeNull();
    });

    it('computes minimal span covering both intervals', () => {
      const a = new Interval(i5, i15);
      const b = new Interval(i20, i30);
      const spanned = a.span(b);

      expect(spanned.start.equals(i5)).toBe(true);
      expect(spanned.end.equals(i30)).toBe(true);
    });
  });

  describe('Serialization', () => {
    it('serializes to and from JSON', () => {
      const iv = new Interval(i5, i25);
      const json = iv.toJSON();

      expect(json.start.epochNanoseconds).toBe('500');
      expect(json.end.epochNanoseconds).toBe('2500');

      const restored = Interval.fromJSON(json);
      expect(restored.equals(iv)).toBe(true);
    });

    it('toString formats half-open notation', () => {
      const iv = new Interval(Instant.EPOCH, Instant.fromEpochSeconds(60));
      expect(iv.toString()).toBe('[1970-01-01T00:00:00.000Z, 1970-01-01T00:01:00.000Z)');
    });
  });

  describe('Property-Based Allen Algebra Invariants', () => {
    // Generates valid intervals with start < end
    const arbitraryInterval = fc
      .tuple(
        fc.bigInt({ min: -10_000n, max: 10_000n }),
        fc.bigInt({ min: -10_000n, max: 10_000n })
      )
      .filter(([s, e]) => s !== e)
      .map(([a, b]) => {
        const s = a < b ? a : b;
        const e = a < b ? b : a;
        return new Interval(Instant.fromEpochNanoseconds(s), Instant.fromEpochNanoseconds(e));
      });

    it('for any two intervals A and B: A.relationTo(B) === converseRelation(B.relationTo(A))', () => {
      fc.assert(
        fc.property(arbitraryInterval, arbitraryInterval, (A, B) => {
          const relAB = A.relationTo(B);
          const relBA = B.relationTo(A);
          return relAB === converseRelation(relBA);
        })
      );
    });

    it('A.equals(B) holds if and only if A.relationTo(B) === "equals"', () => {
      fc.assert(
        fc.property(arbitraryInterval, arbitraryInterval, (A, B) => {
          const eq = A.equals(B);
          const rel = A.relationTo(B);
          return eq === (rel === 'equals');
        })
      );
    });
  });
});
