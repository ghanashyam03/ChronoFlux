import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  Instant,
  Interval,
  IntervalSet,
} from '../src/index.js';

describe('IntervalSet Primitive & Set Algebra', () => {
  const i0 = Instant.fromEpochNanoseconds(0n);
  const i5 = Instant.fromEpochNanoseconds(500n);
  const i10 = Instant.fromEpochNanoseconds(1000n);
  const i15 = Instant.fromEpochNanoseconds(1500n);
  const i20 = Instant.fromEpochNanoseconds(2000n);
  const i25 = Instant.fromEpochNanoseconds(2500n);
  const i30 = Instant.fromEpochNanoseconds(3000n);
  const i40 = Instant.fromEpochNanoseconds(4000n);

  describe('Canonical Representation & Normalization', () => {
    it('creates empty interval set', () => {
      const empty = IntervalSet.empty();
      expect(empty.isEmpty()).toBe(true);
      expect(empty.count()).toBe(0);
      expect(empty.totalDuration().nanoseconds).toBe(0n);
      expect(empty.span()).toBeNull();
      expect(empty.contains(i0)).toBe(false);
    });

    it('merges overlapping intervals upon normalization', () => {
      // [0, 15) and [10, 25) -> [0, 25)
      const a = new Interval(i0, i15);
      const b = new Interval(i10, i25);
      const set = IntervalSet.from([a, b]);

      expect(set.count()).toBe(1);
      expect(set.intervals[0]!.equals(new Interval(i0, i25))).toBe(true);
    });

    it('merges adjacent intervals into a single contiguous interval', () => {
      // [0, 10) meets [10, 20) -> [0, 20)
      const a = new Interval(i0, i10);
      const b = new Interval(i10, i20);
      const set = IntervalSet.from([a, b]);

      expect(set.count()).toBe(1);
      expect(set.intervals[0]!.equals(new Interval(i0, i20))).toBe(true);
    });

    it('sorts and isolates non-overlapping disjoint intervals', () => {
      // Input in reverse order: [20, 30) and [0, 10)
      const b = new Interval(i20, i30);
      const a = new Interval(i0, i10);
      const set = IntervalSet.from([b, a]);

      expect(set.count()).toBe(2);
      expect(set.intervals[0]!.equals(a)).toBe(true);
      expect(set.intervals[1]!.equals(b)).toBe(true);
      expect(set.totalDuration().nanoseconds).toBe(2000n);
      expect(set.span()!.equals(new Interval(i0, i30))).toBe(true);

      const disjointSet = IntervalSet.fromSortedDisjoint([a, b]);
      expect(disjointSet.equals(set)).toBe(true);
    });
  });

  describe('Point Containment and Interval Enclosure', () => {
    // Set: [0, 10) U [20, 30)
    const set = IntervalSet.from([new Interval(i0, i10), new Interval(i20, i30)]);

    it('contains points inside intervals, rejects points in gaps', () => {
      expect(set.contains(i0)).toBe(true);
      expect(set.contains(i5)).toBe(true);
      expect(set.contains(i10)).toBe(false); // Exclusive boundary
      expect(set.contains(i15)).toBe(false); // In gap
      expect(set.contains(i20)).toBe(true);
      expect(set.contains(i25)).toBe(true);
      expect(set.contains(i30)).toBe(false); // Exclusive boundary
    });

    it('encloses sub-intervals completely contained in one component', () => {
      expect(set.encloses(new Interval(i0, i5))).toBe(true);
      expect(set.encloses(new Interval(i20, i25))).toBe(true);
      // Spans across the gap [10, 20)
      expect(set.encloses(new Interval(i5, i25))).toBe(false);
    });
  });

  describe('Union Operation', () => {
    it('unions with an empty set', () => {
      const set = IntervalSet.fromInterval(new Interval(i0, i10));
      expect(set.union(IntervalSet.empty()).equals(set)).toBe(true);
      expect(IntervalSet.empty().union(set).equals(set)).toBe(true);
    });

    it('unions disjoint sets', () => {
      const s1 = IntervalSet.fromInterval(new Interval(i0, i10));
      const s2 = IntervalSet.fromInterval(new Interval(i20, i30));
      const u = s1.union(s2);

      expect(u.count()).toBe(2);
      expect(u.intervals[0]!.equals(new Interval(i0, i10))).toBe(true);
      expect(u.intervals[1]!.equals(new Interval(i20, i30))).toBe(true);
    });

    it('unions overlapping and bridge intervals', () => {
      // s1 = [0, 10) U [20, 30)
      // bridge = [5, 25)
      // union = [0, 30)
      const s1 = IntervalSet.from([new Interval(i0, i10), new Interval(i20, i30)]);
      const bridge = new Interval(i5, i25);
      const u = s1.union(bridge);

      expect(u.count()).toBe(1);
      expect(u.intervals[0]!.equals(new Interval(i0, i30))).toBe(true);
    });
  });

  describe('Intersection Operation', () => {
    it('returns empty when intersecting with empty set', () => {
      const set = IntervalSet.fromInterval(new Interval(i0, i10));
      expect(set.intersect(IntervalSet.empty()).isEmpty()).toBe(true);
      expect(IntervalSet.empty().intersect(set).isEmpty()).toBe(true);
    });

    it('intersects overlapping sets', () => {
      // s1 = [0, 20)
      // s2 = [10, 30)
      // s1 \cap s2 = [10, 20)
      const s1 = IntervalSet.fromInterval(new Interval(i0, i20));
      const s2 = IntervalSet.fromInterval(new Interval(i10, i30));
      const inter = s1.intersect(s2);

      expect(inter.count()).toBe(1);
      expect(inter.intervals[0]!.equals(new Interval(i10, i20))).toBe(true);
    });

    it('intersects sets with multiple pieces and gaps', () => {
      // s1 = [0, 10) U [20, 30) U [40, 50) (we use i40)
      const i50 = Instant.fromEpochNanoseconds(5000n);
      const s1 = IntervalSet.from([
        new Interval(i0, i10),
        new Interval(i20, i30),
        new Interval(i40, i50),
      ]);
      // s2 = [5, 25)
      const s2 = IntervalSet.fromInterval(new Interval(i5, i25));

      // Intersection should be: [5, 10) U [20, 25)
      const inter = s1.intersect(s2);
      expect(inter.count()).toBe(2);
      expect(inter.intervals[0]!.equals(new Interval(i5, i10))).toBe(true);
      expect(inter.intervals[1]!.equals(new Interval(i20, i25))).toBe(true);
    });

    it('returns empty when sets are disjoint or merely adjacent', () => {
      const s1 = IntervalSet.fromInterval(new Interval(i0, i10));
      const s2 = IntervalSet.fromInterval(new Interval(i10, i20)); // Meets at 10
      expect(s1.intersect(s2).isEmpty()).toBe(true);
    });
  });

  describe('Difference Operation (Set Subtraction)', () => {
    it('returns empty when subtracting a set from itself: A \\ A = empty', () => {
      const set = IntervalSet.from([new Interval(i0, i10), new Interval(i20, i30)]);
      expect(set.difference(set).isEmpty()).toBe(true);
    });

    it('returns original set when subtracting empty set: A \\ empty = A', () => {
      const set = IntervalSet.fromInterval(new Interval(i0, i10));
      expect(set.difference(IntervalSet.empty()).equals(set)).toBe(true);
    });

    it('cuts a hole in an interval', () => {
      // [0, 30) \ [10, 20) = [0, 10) U [20, 30)
      const whole = IntervalSet.fromInterval(new Interval(i0, i30));
      const hole = IntervalSet.fromInterval(new Interval(i10, i20));
      const diff = whole.difference(hole);

      expect(diff.count()).toBe(2);
      expect(diff.intervals[0]!.equals(new Interval(i0, i10))).toBe(true);
      expect(diff.intervals[1]!.equals(new Interval(i20, i30))).toBe(true);
    });

    it('trims the start and end of an interval', () => {
      // [10, 30) \ [0, 15) = [15, 30)
      const s1 = IntervalSet.fromInterval(new Interval(i10, i30));
      const s2 = IntervalSet.fromInterval(new Interval(i0, i15));
      expect(s1.difference(s2).intervals[0]!.equals(new Interval(i15, i30))).toBe(true);

      // [10, 30) \ [25, 40) = [10, 25)
      const s3 = IntervalSet.fromInterval(new Interval(i25, i40));
      expect(s1.difference(s3).intervals[0]!.equals(new Interval(i10, i25))).toBe(true);
    });
  });

  describe('Bounded Complement Operation', () => {
    it('computes complement within a bounding interval', () => {
      // within [0, 30)
      // set = [10, 20)
      // complement = [0, 10) U [20, 30)
      const within = new Interval(i0, i30);
      const set = IntervalSet.fromInterval(new Interval(i10, i20));
      const comp = set.complement(within);

      expect(comp.count()).toBe(2);
      expect(comp.intervals[0]!.equals(new Interval(i0, i10))).toBe(true);
      expect(comp.intervals[1]!.equals(new Interval(i20, i30))).toBe(true);
    });

    it('complement of empty set within boundary is the entire boundary', () => {
      const within = new Interval(i0, i10);
      const comp = IntervalSet.empty().complement(within);

      expect(comp.count()).toBe(1);
      expect(comp.intervals[0]!.equals(within)).toBe(true);
    });
  });

  describe('Serialization & Deserialization', () => {
    it('round-trips JSON serialization', () => {
      const original = IntervalSet.from([new Interval(i0, i10), new Interval(i20, i30)]);
      const json = original.toJSON();

      expect(json.intervals.length).toBe(2);
      expect(json.intervals[0]!.start.epochNanoseconds).toBe('0');
      expect(json.intervals[0]!.end.epochNanoseconds).toBe('1000');

      const restored = IntervalSet.fromJSON(json);
      expect(restored.equals(original)).toBe(true);
    });
  });

  describe('Property-Based Boolean Set Algebra Laws', () => {
    // Generate valid random IntervalSets within a bounded coordinate space
    const arbitraryInterval = fc
      .tuple(fc.bigInt({ min: -500n, max: 500n }), fc.bigInt({ min: -500n, max: 500n }))
      .filter(([s, e]) => s !== e)
      .map(([a, b]) => {
        const s = a < b ? a : b;
        const e = a < b ? b : a;
        return new Interval(Instant.fromEpochNanoseconds(s), Instant.fromEpochNanoseconds(e));
      });

    const arbitraryIntervalSet = fc
      .array(arbitraryInterval, { minLength: 0, maxLength: 5 })
      .map((ivs) => IntervalSet.from(ivs));

    const boundingUniverse = new Interval(
      Instant.fromEpochNanoseconds(-1000n),
      Instant.fromEpochNanoseconds(1000n)
    );

    it('enforces canonical representation: strictly sorted, disjoint, and non-adjacent', () => {
      fc.assert(
        fc.property(arbitraryIntervalSet, (set) => {
          for (let i = 0; i < set.intervals.length - 1; i++) {
            const current = set.intervals[i]!;
            const next = set.intervals[i + 1]!;
            // Strict inequality: end of current must be strictly before start of next
            if (!current.end.isBefore(next.start)) {
              return false;
            }
          }
          return true;
        })
      );
    });

    it('satisfies commutativity: A U B = B U A and A ∩ B = B ∩ A', () => {
      fc.assert(
        fc.property(arbitraryIntervalSet, arbitraryIntervalSet, (A, B) => {
          const u1 = A.union(B);
          const u2 = B.union(A);
          const i1 = A.intersect(B);
          const i2 = B.intersect(A);
          return u1.equals(u2) && i1.equals(i2);
        })
      );
    });

    it('satisfies distributivity: A ∩ (B U C) = (A ∩ B) U (A ∩ C)', () => {
      fc.assert(
        fc.property(
          arbitraryIntervalSet,
          arbitraryIntervalSet,
          arbitraryIntervalSet,
          (A, B, C) => {
            const lhs = A.intersect(B.union(C));
            const rhs = A.intersect(B).union(A.intersect(C));
            return lhs.equals(rhs);
          }
        )
      );
    });

    it("satisfies De Morgan's Laws within bounded universe: (A U B)^c = A^c ∩ B^c", () => {
      fc.assert(
        fc.property(arbitraryIntervalSet, arbitraryIntervalSet, (A, B) => {
          // Bound A and B within the universe
          const boundedA = A.intersect(boundingUniverse);
          const boundedB = B.intersect(boundingUniverse);

          const lhs = boundedA.union(boundedB).complement(boundingUniverse);
          const rhs = boundedA.complement(boundingUniverse).intersect(boundedB.complement(boundingUniverse));

          return lhs.equals(rhs);
        })
      );
    });
  });
});
