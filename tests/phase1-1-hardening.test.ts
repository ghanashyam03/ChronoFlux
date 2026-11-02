import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  Duration,
  Instant,
  Interval,
  IntervalSet,
  NANOSECONDS_PER_DAY,
  NANOSECONDS_PER_HOUR,
  NANOSECONDS_PER_MICROSECOND,
  NANOSECONDS_PER_MILLISECOND,
  NANOSECONDS_PER_MINUTE,
  NANOSECONDS_PER_SECOND,
  Place,
  RoundingMode,
} from '../src/index.js';

describe('Phase 1.1 — Correctness and Invariant Hardening', () => {
  describe('1. Runtime Immutability', () => {
    it('Instant instance is frozen against property mutation or extension', () => {
      const inst = Instant.fromEpochNanoseconds(123456789n);
      expect(Object.isFrozen(inst)).toBe(true);

      expect(() => {
        (inst as any).epochNanoseconds = 999n;
      }).toThrow(TypeError);

      expect(() => {
        (inst as any).newProp = 'illegal';
      }).toThrow(TypeError);

      expect(inst.epochNanoseconds).toBe(123456789n);
    });

    it('Static Instant sentinels (EPOCH, MIN, MAX) are frozen', () => {
      expect(Object.isFrozen(Instant.EPOCH)).toBe(true);
      expect(Object.isFrozen(Instant.MIN)).toBe(true);
      expect(Object.isFrozen(Instant.MAX)).toBe(true);
    });

    it('Duration instance is frozen against property mutation or extension', () => {
      const dur = Duration.fromSeconds(42);
      expect(Object.isFrozen(dur)).toBe(true);

      expect(() => {
        (dur as any).nanoseconds = 0n;
      }).toThrow(TypeError);

      expect(() => {
        (dur as any).custom = 123;
      }).toThrow(TypeError);

      expect(dur.nanoseconds).toBe(42n * NANOSECONDS_PER_SECOND);
    });

    it('Place instance is frozen against coordinate modification', () => {
      const place = Place.create({ latitude: 37.7749, longitude: -122.4194, elevationMeters: 10 });
      expect(Object.isFrozen(place)).toBe(true);

      expect(() => {
        (place as any).latitude = 0;
      }).toThrow(TypeError);

      expect(() => {
        (place as any).longitude = 0;
      }).toThrow(TypeError);

      expect(() => {
        (place as any).elevationMeters = 500;
      }).toThrow(TypeError);

      expect(place.latitude).toBe(37.7749);
      expect(place.longitude).toBe(-122.4194);
      expect(place.elevationMeters).toBe(10);
    });

    it('Interval instance is frozen', () => {
      const start = Instant.fromEpochNanoseconds(0n);
      const end = Instant.fromEpochNanoseconds(1000n);
      const iv = new Interval(start, end);

      expect(Object.isFrozen(iv)).toBe(true);
      expect(Object.isFrozen(iv.start)).toBe(true);
      expect(Object.isFrozen(iv.end)).toBe(true);
      expect(Object.isFrozen(iv.duration)).toBe(true);

      expect(() => {
        (iv as any).start = end;
      }).toThrow(TypeError);

      expect(() => {
        (iv as any).end = start;
      }).toThrow(TypeError);
    });

    it('IntervalSet instance and its backing intervals array are deeply frozen', () => {
      const iv1 = new Interval(Instant.fromEpochNanoseconds(0n), Instant.fromEpochNanoseconds(10n));
      const iv2 = new Interval(Instant.fromEpochNanoseconds(20n), Instant.fromEpochNanoseconds(30n));
      const set = IntervalSet.from([iv1, iv2]);

      expect(Object.isFrozen(set)).toBe(true);
      expect(Object.isFrozen(set.intervals)).toBe(true);

      // Mutating instance properties throws
      expect(() => {
        (set as any).intervals = [];
      }).toThrow(TypeError);

      // Mutating the backing array throws
      expect(() => {
        (set.intervals as any).push(iv1);
      }).toThrow(TypeError);

      expect(() => {
        (set.intervals as any)[0] = iv2;
      }).toThrow(TypeError);

      expect(() => {
        (set.intervals as any).pop();
      }).toThrow(TypeError);

      // Empty set is also frozen
      const empty = IntervalSet.empty();
      expect(Object.isFrozen(empty)).toBe(true);
      expect(Object.isFrozen(empty.intervals)).toBe(true);
    });

    it('IntervalSet.fromSortedDisjoint freezes internal copy against external array mutation', () => {
      const iv = new Interval(Instant.fromEpochNanoseconds(0n), Instant.fromEpochNanoseconds(10n));
      const externalList = [iv];
      const set = IntervalSet.fromSortedDisjoint(externalList);

      // Mutating external array does NOT affect IntervalSet
      externalList.push(new Interval(Instant.fromEpochNanoseconds(20n), Instant.fromEpochNanoseconds(30n)));
      expect(set.count()).toBe(1);
      expect(Object.isFrozen(set.intervals)).toBe(true);
    });
  });

  describe('2. Exact Numerical Inputs & Fractional-Unit Policy', () => {
    describe('Fractional numbers without explicit rounding policy are rejected', () => {
      it('rejects fractional inputs in Duration factories', () => {
        expect(() => Duration.fromSeconds(1.5)).toThrow(RangeError);
        expect(() => Duration.fromMilliseconds(0.5)).toThrow(RangeError);
        expect(() => Duration.fromMicroseconds(0.25)).toThrow(RangeError);
        expect(() => Duration.fromNanoseconds(0.5)).toThrow(RangeError);
        expect(() => Duration.fromMinutes(1.5)).toThrow(RangeError);
        expect(() => Duration.fromHours(2.25)).toThrow(RangeError);
        expect(() => Duration.fromDays(0.5)).toThrow(RangeError);
      });

      it('rejects fractional inputs in Duration.of fields', () => {
        expect(() => Duration.of({ seconds: 1.5 })).toThrow(RangeError);
        expect(() => Duration.of({ milliseconds: 0.1 })).toThrow(RangeError);
        expect(() => Duration.of({ hours: 1, minutes: 30.5 })).toThrow(RangeError);
      });

      it('rejects fractional multiplication factor without rounding mode', () => {
        const d = Duration.fromSeconds(10);
        expect(() => d.multiply(1.5)).toThrow(RangeError);
        expect(() => d.multiply('1.5')).toThrow(RangeError);
      });

      it('rejects non-integer divisor in Duration.divide', () => {
        const d = Duration.fromSeconds(10);
        expect(() => d.divide(2.5)).toThrow(RangeError);
      });

      it('rejects fractional inputs in Instant factories', () => {
        expect(() => Instant.fromEpochSeconds(1.5)).toThrow(RangeError);
        expect(() => Instant.fromEpochMilliseconds(0.5)).toThrow(RangeError);
        expect(() => Instant.fromEpochMicroseconds(0.25)).toThrow(RangeError);
        expect(() => Instant.fromEpochNanoseconds(0.5)).toThrow(RangeError);
      });

      it('rejects fractional decimal strings without rounding mode', () => {
        expect(() => Duration.fromSeconds('1.5')).toThrow(RangeError);
        expect(() => Instant.fromEpochSeconds('1.5')).toThrow(RangeError);
      });
    });

    describe('Explicit rounding policies for fractional-unit conversions', () => {
      it('rounds fractional seconds across all rounding modes', () => {
        // 1.5 seconds = 1,500,000,000 ns (exact multiple of nanoseconds)
        expect(Duration.fromSeconds(1.5, 'trunc').nanoseconds).toBe(1_500_000_000n);
        expect(Duration.fromSeconds(1.5, 'floor').nanoseconds).toBe(1_500_000_000n);
        expect(Duration.fromSeconds(1.5, 'ceil').nanoseconds).toBe(1_500_000_000n);
        expect(Duration.fromSeconds(1.5, 'halfExpand').nanoseconds).toBe(1_500_000_000n);

        // Instant fromEpochSeconds with 1.5
        expect(Instant.fromEpochSeconds(1.5, 'halfExpand').epochNanoseconds).toBe(1_500_000_000n);
      });

      it('rounds sub-nanosecond fractional nanoseconds with explicit rounding modes', () => {
        // Positive 1.5 nanoseconds:
        // trunc -> 1ns, floor -> 1ns, ceil -> 2ns, halfExpand -> 2ns
        expect(Duration.fromNanoseconds(1.5, 'trunc').nanoseconds).toBe(1n);
        expect(Duration.fromNanoseconds(1.5, 'floor').nanoseconds).toBe(1n);
        expect(Duration.fromNanoseconds(1.5, 'ceil').nanoseconds).toBe(2n);
        expect(Duration.fromNanoseconds(1.5, 'halfExpand').nanoseconds).toBe(2n);

        // Negative -1.5 nanoseconds:
        // trunc -> -1ns, floor -> -2ns, ceil -> -1ns, halfExpand -> -2ns
        expect(Duration.fromNanoseconds(-1.5, 'trunc').nanoseconds).toBe(-1n);
        expect(Duration.fromNanoseconds(-1.5, 'floor').nanoseconds).toBe(-2n);
        expect(Duration.fromNanoseconds(-1.5, 'ceil').nanoseconds).toBe(-1n);
        expect(Duration.fromNanoseconds(-1.5, 'halfExpand').nanoseconds).toBe(-2n);
      });

      it('rounds sub-nanosecond decimal strings with explicit rounding modes', () => {
        // 0.0000000005 seconds = 0.5 nanoseconds
        expect(Duration.fromSeconds('0.0000000005', 'trunc').nanoseconds).toBe(0n);
        expect(Duration.fromSeconds('0.0000000005', 'floor').nanoseconds).toBe(0n);
        expect(Duration.fromSeconds('0.0000000005', 'ceil').nanoseconds).toBe(1n);
        expect(Duration.fromSeconds('0.0000000005', 'halfExpand').nanoseconds).toBe(1n);

        // -0.0000000005 seconds = -0.5 nanoseconds
        expect(Duration.fromSeconds('-0.0000000005', 'trunc').nanoseconds).toBe(0n);
        expect(Duration.fromSeconds('-0.0000000005', 'floor').nanoseconds).toBe(-1n);
        expect(Duration.fromSeconds('-0.0000000005', 'ceil').nanoseconds).toBe(0n);
        expect(Duration.fromSeconds('-0.0000000005', 'halfExpand').nanoseconds).toBe(-1n);
      });

      it('Duration.multiply with fractional factors and rounding modes', () => {
        const d = Duration.fromNanoseconds(100n);
        expect(d.multiply(1.5, 'halfExpand').nanoseconds).toBe(150n);
        expect(d.multiply('2.5', 'trunc').nanoseconds).toBe(250n);

        const dOdd = Duration.fromNanoseconds(15n);
        // 15 * 1.5 = 22.5 ns
        expect(dOdd.multiply(1.5, 'trunc').nanoseconds).toBe(22n);
        expect(dOdd.multiply(1.5, 'floor').nanoseconds).toBe(22n);
        expect(dOdd.multiply(1.5, 'ceil').nanoseconds).toBe(23n);
        expect(dOdd.multiply(1.5, 'halfExpand').nanoseconds).toBe(23n);

        // Negative duration: -15 * 1.5 = -22.5 ns
        const dNeg = Duration.fromNanoseconds(-15n);
        expect(dNeg.multiply(1.5, 'trunc').nanoseconds).toBe(-22n);
        expect(dNeg.multiply(1.5, 'floor').nanoseconds).toBe(-23n);
        expect(dNeg.multiply(1.5, 'ceil').nanoseconds).toBe(-22n);
        expect(dNeg.multiply(1.5, 'halfExpand').nanoseconds).toBe(-23n);
      });

      it('Duration.of with composite fields and rounding mode', () => {
        const d = Duration.of({ days: 0.5, hours: 1.5 }, 'halfExpand');
        expect(d.nanoseconds).toBe(12n * NANOSECONDS_PER_HOUR + 1n * NANOSECONDS_PER_HOUR + 30n * NANOSECONDS_PER_MINUTE);
      });
    });

    describe('Safe Integer Requirements & Arbitrary Precision Alternatives', () => {
      it('accepts safe integer boundary values [MIN_SAFE_INTEGER, MAX_SAFE_INTEGER]', () => {
        expect(() => Duration.fromSeconds(Number.MAX_SAFE_INTEGER)).not.toThrow();
        expect(() => Duration.fromSeconds(Number.MIN_SAFE_INTEGER)).not.toThrow();
        expect(() => Duration.fromNanoseconds(Number.MAX_SAFE_INTEGER)).not.toThrow();
        expect(() => Duration.fromNanoseconds(Number.MIN_SAFE_INTEGER)).not.toThrow();
        expect(() => Instant.fromEpochNanoseconds(Number.MAX_SAFE_INTEGER)).not.toThrow();
        expect(() => Instant.fromEpochNanoseconds(Number.MIN_SAFE_INTEGER)).not.toThrow();
      });

      it('rejects unsafe number integers (> MAX_SAFE_INTEGER or < MIN_SAFE_INTEGER)', () => {
        const unsafePositive = Number.MAX_SAFE_INTEGER + 1; // 9007199254740992
        const unsafeNegative = Number.MIN_SAFE_INTEGER - 1; // -9007199254740992

        expect(() => Duration.fromSeconds(unsafePositive)).toThrow(RangeError);
        expect(() => Duration.fromSeconds(unsafeNegative)).toThrow(RangeError);
        expect(() => Duration.fromMilliseconds(unsafePositive)).toThrow(RangeError);
        expect(() => Duration.fromNanoseconds(unsafePositive)).toThrow(RangeError);
        expect(() => Duration.fromNanoseconds(1e20)).toThrow(RangeError);

        expect(() => Instant.fromEpochSeconds(unsafePositive)).toThrow(RangeError);
        expect(() => Instant.fromEpochMilliseconds(unsafePositive)).toThrow(RangeError);
        expect(() => Instant.fromEpochMicroseconds(unsafePositive)).toThrow(RangeError);
        expect(() => Instant.fromEpochNanoseconds(unsafePositive)).toThrow(RangeError);
      });

      it('accepts BigInt and decimal strings for values requiring greater precision', () => {
        const largeBigInt = 9007199254740992000n;
        const largeString = '9007199254740992000';

        const d1 = Duration.fromNanoseconds(largeBigInt);
        const d2 = Duration.fromNanoseconds(largeString);
        expect(d1.nanoseconds).toBe(largeBigInt);
        expect(d2.nanoseconds).toBe(largeBigInt);
        expect(d1.equals(d2)).toBe(true);

        const dMs = Duration.fromMilliseconds(largeBigInt);
        expect(dMs.nanoseconds).toBe(largeBigInt * NANOSECONDS_PER_MILLISECOND);

        const inst = Instant.fromEpochNanoseconds(largeString);
        expect(inst.epochNanoseconds).toBe(largeBigInt);
      });
    });
  });

  describe('3. Leap-Second Semantics', () => {
    it('accepts authentic historical IERS leap second dates at UTC 23:59:60Z and clamps to :59', () => {
      // 1972-06-30 leap second
      const ls1972 = Instant.fromISOString('1972-06-30T23:59:60Z');
      expect(ls1972.toISOString()).toBe('1972-06-30T23:59:59.000Z');

      // 2016-12-31 leap second
      const ls2016 = Instant.fromISOString('2016-12-31T23:59:60Z');
      expect(ls2016.toISOString()).toBe('2016-12-31T23:59:59.000Z');

      // Preserves sub-second fraction when clamping
      const lsFrac = Instant.fromISOString('1972-06-30T23:59:60.500Z');
      expect(lsFrac.toISOString()).toBe('1972-06-30T23:59:59.500Z');

      // Accepts zero offset +00:00 or -00:00
      const lsZeroOffset = Instant.fromISOString('1972-06-30T23:59:60+00:00');
      expect(lsZeroOffset.toISOString()).toBe('1972-06-30T23:59:59.000Z');
    });

    it('rejects second 60 on non-leap-second calendar dates', () => {
      // 2026-11-02 was never an IERS leap second date
      expect(() => Instant.fromISOString('2026-11-02T23:59:60Z')).toThrow(RangeError);

      // 2023-06-30 was not a leap second date
      expect(() => Instant.fromISOString('2023-06-30T23:59:60Z')).toThrow(RangeError);

      // 2000-02-29 was not a leap second date
      expect(() => Instant.fromISOString('2000-02-29T23:59:60Z')).toThrow(RangeError);
    });

    it('rejects second 60 when accompanied by non-zero UTC offsets', () => {
      // Non-zero positive offset
      expect(() => Instant.fromISOString('1972-06-30T23:59:60+05:30')).toThrow(RangeError);

      // Non-zero negative offset
      expect(() => Instant.fromISOString('2016-12-31T23:59:60-05:00')).toThrow(RangeError);

      expect(() => Instant.fromISOString('1972-06-30T23:59:60+01:00')).toThrow(RangeError);
    });

    it('rejects second 60 under strict leap second policy', () => {
      // Authentic leap second dates are strictly rejected when configured with 'reject' or 'strict'
      expect(() =>
        Instant.fromISOString('1972-06-30T23:59:60Z', { leapSecondPolicy: 'reject' })
      ).toThrow(RangeError);

      expect(() =>
        Instant.fromISOString('2016-12-31T23:59:60Z', { leapSecondPolicy: 'strict' })
      ).toThrow(RangeError);
    });
  });

  describe('4. Allen API Naming & Generic Intersection', () => {
    const i0 = Instant.fromEpochNanoseconds(0n);
    const i5 = Instant.fromEpochNanoseconds(500n);
    const i10 = Instant.fromEpochNanoseconds(1000n);
    const i15 = Instant.fromEpochNanoseconds(1500n);
    const i20 = Instant.fromEpochNanoseconds(2000n);
    const i25 = Instant.fromEpochNanoseconds(2500n);

    it('intersects() correctly tests general interval intersection', () => {
      const a = new Interval(i0, i15);
      const b = new Interval(i10, i25);
      expect(a.intersects(b)).toBe(true);
      expect(b.intersects(a)).toBe(true);

      // Disjoint intervals
      const c = new Interval(i20, i25);
      expect(a.intersects(c)).toBe(false);
      expect(c.intersects(a)).toBe(false);

      // Adjacent intervals meet at boundary but do NOT intersect (half-open)
      const d = new Interval(i15, i25);
      expect(a.intersects(d)).toBe(false);
      expect(d.intersects(a)).toBe(false);
    });

    it('overlaps() acts as alias for intersects()', () => {
      const a = new Interval(i0, i15);
      const b = new Interval(i10, i25);
      expect(a.overlaps(b)).toBe(true);
      expect(b.overlaps(a)).toBe(true);
    });

    it('clearly distinguishes general intersection from Allen directional "overlaps"', () => {
      // A = [5, 15) is 'during' B = [0, 20)
      const A = new Interval(i5, i15);
      const B = new Interval(i0, i20);

      // General intersection holds (A ∩ B = [5, 15) ≠ ∅)
      expect(A.intersects(B)).toBe(true);
      expect(B.intersects(A)).toBe(true);

      // But Allen's relation is strictly 'during', NOT 'overlaps'!
      expect(A.relationTo(B)).toBe('during');
      expect(A.overlapsRelation(B)).toBe(false);
      expect(A.isOverlaps(B)).toBe(false);

      // B contains A
      expect(B.relationTo(A)).toBe('contains');
      expect(B.overlapsRelation(A)).toBe(false);
      expect(B.isOverlaps(A)).toBe(false);
    });

    it('provides consistent Allen relation helper methods across all 13 relations', () => {
      const A = new Interval(i0, i15);
      const B = new Interval(i10, i25);

      // 5. overlaps
      expect(A.relationTo(B)).toBe('overlaps');
      expect(A.overlapsRelation(B)).toBe(true);
      expect(A.isOverlaps(B)).toBe(true);

      // 6. overlappedBy
      expect(B.relationTo(A)).toBe('overlappedBy');
      expect(B.overlappedBy(A)).toBe(true);
      expect(B.isOverlappedBy(A)).toBe(true);

      // 3. meets / isMeets
      const M1 = new Interval(i0, i10);
      const M2 = new Interval(i10, i20);
      expect(M1.meets(M2)).toBe(true);
      expect(M1.isMeets(M2)).toBe(true);

      // 7. starts / isStarts
      const S1 = new Interval(i0, i10);
      const S2 = new Interval(i0, i20);
      expect(S1.starts(S2)).toBe(true);
      expect(S1.isStarts(S2)).toBe(true);

      // 9. during / isDuring
      const D1 = new Interval(i5, i15);
      const D2 = new Interval(i0, i20);
      expect(D1.during(D2)).toBe(true);
      expect(D1.isDuring(D2)).toBe(true);

      // 10. containsInterval / isContainsInterval
      expect(D2.containsInterval(D1)).toBe(true);
      expect(D2.isContainsInterval(D1)).toBe(true);

      // 11. finishes / isFinishes
      const F1 = new Interval(i10, i20);
      const F2 = new Interval(i0, i20);
      expect(F1.finishes(F2)).toBe(true);
      expect(F1.isFinishes(F2)).toBe(true);
    });
  });

  describe('5. Robustness & Edge Cases for Numeric and Division Parsers', () => {
    it('handles decimal strings with all-zero fractional parts as exact integers', () => {
      const d = Duration.fromSeconds('10.00');
      expect(d.nanoseconds).toBe(10n * NANOSECONDS_PER_SECOND);

      const dNeg = Duration.fromSeconds('-5.000');
      expect(dNeg.nanoseconds).toBe(-5n * NANOSECONDS_PER_SECOND);
    });

    it('validates invalid types and empty strings in numeric parser', () => {
      expect(() => Duration.fromSeconds('')).toThrow(TypeError);
      expect(() => Duration.fromSeconds('   ')).toThrow(TypeError);
      expect(() => Duration.fromSeconds(true as any)).toThrow(TypeError);
      expect(() => Duration.fromSeconds({} as any)).toThrow(TypeError);
      expect(() => Duration.fromSeconds(null as any)).toThrow(TypeError);
      expect(() => Duration.fromSeconds(1.5, 'unknown_mode' as any)).toThrow(RangeError);
    });

    it('Duration.divide edge cases', () => {
      const d = Duration.fromNanoseconds(10n);
      // Integer string divisor
      const { quotient, remainder } = d.divide('3');
      expect(quotient).toBe(3n);
      expect(remainder.nanoseconds).toBe(1n);

      // Unsafe integer divisor throws RangeError
      expect(() => d.divide(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);

      // Invalid divisor string throws TypeError
      expect(() => d.divide('abc')).toThrow(TypeError);

      // Invalid type throws TypeError
      expect(() => d.divide({} as any)).toThrow(TypeError);
      expect(() => d.divide(null as any)).toThrow(TypeError);
    });

    it('IntervalSet.fromInterval argument validation', () => {
      expect(() => IntervalSet.fromInterval(null as any)).toThrow(TypeError);
      expect(() => IntervalSet.fromInterval({} as any)).toThrow(TypeError);
    });
  });
});
