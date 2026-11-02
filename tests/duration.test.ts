import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  Duration,
  NANOSECONDS_PER_DAY,
  NANOSECONDS_PER_HOUR,
  NANOSECONDS_PER_MICROSECOND,
  NANOSECONDS_PER_MILLISECOND,
  NANOSECONDS_PER_MINUTE,
  NANOSECONDS_PER_SECOND,
} from '../src/index.js';

describe('Duration Primitive', () => {
  describe('Factories & Unit Construction', () => {
    it('creates zero duration', () => {
      const zero = Duration.zero();
      expect(zero.nanoseconds).toBe(0n);
      expect(zero.isZero()).toBe(true);
      expect(zero.isPositive()).toBe(false);
      expect(zero.isNegative()).toBe(false);
    });

    it('creates duration from nanoseconds', () => {
      const d1 = Duration.fromNanoseconds(500n);
      const d2 = Duration.fromNanoseconds(500);
      expect(d1.nanoseconds).toBe(500n);
      expect(d2.nanoseconds).toBe(500n);
      expect(d1.equals(d2)).toBe(true);
    });

    it('creates duration from microseconds', () => {
      const d = Duration.fromMicroseconds(42);
      expect(d.nanoseconds).toBe(42n * NANOSECONDS_PER_MICROSECOND);
    });

    it('creates duration from milliseconds', () => {
      const d = Duration.fromMilliseconds(150);
      expect(d.nanoseconds).toBe(150n * NANOSECONDS_PER_MILLISECOND);
    });

    it('creates duration from seconds', () => {
      const d = Duration.fromSeconds(60);
      expect(d.nanoseconds).toBe(60n * NANOSECONDS_PER_SECOND);
    });

    it('creates duration from minutes', () => {
      const d = Duration.fromMinutes(30);
      expect(d.nanoseconds).toBe(30n * NANOSECONDS_PER_MINUTE);
    });

    it('creates duration from hours', () => {
      const d = Duration.fromHours(2);
      expect(d.nanoseconds).toBe(2n * NANOSECONDS_PER_HOUR);
    });

    it('creates duration from days', () => {
      const d = Duration.fromDays(7);
      expect(d.nanoseconds).toBe(7n * NANOSECONDS_PER_DAY);
    });

    it('creates duration using composite of() fields', () => {
      const d = Duration.of({
        days: 1,
        hours: 2,
        minutes: 3,
        seconds: 4,
        milliseconds: 5,
        microseconds: 6,
        nanoseconds: 7,
      });

      const expected =
        1n * NANOSECONDS_PER_DAY +
        2n * NANOSECONDS_PER_HOUR +
        3n * NANOSECONDS_PER_MINUTE +
        4n * NANOSECONDS_PER_SECOND +
        5n * NANOSECONDS_PER_MILLISECOND +
        6n * NANOSECONDS_PER_MICROSECOND +
        7n;

      expect(d.nanoseconds).toBe(expected);
    });

    it('validates bigint type in constructor', () => {
      expect(() => new (Duration as any)(123)).toThrow(TypeError);
    });
  });

  describe('Exact Arithmetic', () => {
    it('supports addition and subtraction', () => {
      const a = Duration.fromSeconds(10);
      const b = Duration.fromSeconds(5);

      expect(a.add(b).nanoseconds).toBe(15n * NANOSECONDS_PER_SECOND);
      expect(a.subtract(b).nanoseconds).toBe(5n * NANOSECONDS_PER_SECOND);
      expect(b.subtract(a).nanoseconds).toBe(-5n * NANOSECONDS_PER_SECOND);
    });

    it('supports negation and absolute value', () => {
      const positive = Duration.fromMilliseconds(100);
      const negative = positive.negate();

      expect(negative.nanoseconds).toBe(-100n * NANOSECONDS_PER_MILLISECOND);
      expect(negative.isNegative()).toBe(true);
      expect(negative.isPositive()).toBe(false);

      expect(negative.abs().nanoseconds).toBe(100n * NANOSECONDS_PER_MILLISECOND);
      expect(positive.abs().nanoseconds).toBe(100n * NANOSECONDS_PER_MILLISECOND);
      expect(Duration.zero().abs().isZero()).toBe(true);
    });

    it('supports multiplication', () => {
      const d = Duration.fromMilliseconds(15);
      expect(d.multiply(3).nanoseconds).toBe(45n * NANOSECONDS_PER_MILLISECOND);
      expect(d.multiply(-2n).nanoseconds).toBe(-30n * NANOSECONDS_PER_MILLISECOND);
    });

    it('supports integer division with remainder', () => {
      const d = Duration.fromNanoseconds(17n);
      const { quotient, remainder } = d.divide(5n);

      expect(quotient).toBe(3n);
      expect(remainder.nanoseconds).toBe(2n);

      // Verify invariant: d == quotient * divisor + remainder
      expect(quotient * 5n + remainder.nanoseconds).toBe(17n);
    });

    it('throws on division by zero', () => {
      const d = Duration.fromSeconds(10);
      expect(() => d.divide(0n)).toThrow(RangeError);
      expect(() => d.divide(0)).toThrow(RangeError);
    });
  });

  describe('Comparisons', () => {
    const d1 = Duration.fromSeconds(5);
    const d2 = Duration.fromSeconds(10);
    const d3 = Duration.fromSeconds(10);

    it('compareTo returns -1, 0, 1', () => {
      expect(d1.compareTo(d2)).toBe(-1);
      expect(d2.compareTo(d1)).toBe(1);
      expect(d2.compareTo(d3)).toBe(0);
    });

    it('relational helper methods', () => {
      expect(d1.isLessThan(d2)).toBe(true);
      expect(d1.isLessThanOrEqual(d2)).toBe(true);
      expect(d2.isGreaterThan(d1)).toBe(true);
      expect(d2.isGreaterThanOrEqual(d1)).toBe(true);
      expect(d2.equals(d3)).toBe(true);
      expect(d2.isGreaterThanOrEqual(d3)).toBe(true);
      expect(d2.isLessThanOrEqual(d3)).toBe(true);
    });
  });

  describe('Informational Unit Getters & toParts', () => {
    it('computes floating-point units accurately', () => {
      const d = Duration.fromMilliseconds(1500);
      expect(d.totalSeconds).toBe(1.5);
      expect(d.totalMilliseconds).toBe(1500);
      expect(d.totalMicroseconds).toBe(1_500_000);
      expect(d.totalNanoseconds).toBe(1_500_000_000n);
      expect(d.totalMinutes).toBe(1.5 / 60);
      expect(d.totalHours).toBe(1.5 / 3600);
      expect(d.totalDays).toBe(1.5 / 86400);
    });

    it('deconstructs positive and negative durations to parts', () => {
      const d = Duration.of({
        days: 2,
        hours: 3,
        minutes: 4,
        seconds: 5,
        milliseconds: 6,
        microseconds: 7,
        nanoseconds: 8,
      });

      const parts = d.toParts();
      expect(parts.sign).toBe(1);
      expect(parts.days).toBe(2n);
      expect(parts.hours).toBe(3);
      expect(parts.minutes).toBe(4);
      expect(parts.seconds).toBe(5);
      expect(parts.milliseconds).toBe(6);
      expect(parts.microseconds).toBe(7);
      expect(parts.nanoseconds).toBe(8);

      const negParts = d.negate().toParts();
      expect(negParts.sign).toBe(-1);
      expect(negParts.days).toBe(2n);
      expect(negParts.hours).toBe(3);
    });
  });

  describe('ISO 8601 Serialization & Parsing', () => {
    it('formats zero duration as PT0S', () => {
      expect(Duration.zero().toISOString()).toBe('PT0S');
    });

    it('formats positive durations in ISO-8601', () => {
      expect(Duration.fromHours(1).toISOString()).toBe('PT1H');
      expect(Duration.of({ hours: 1, minutes: 30 }).toISOString()).toBe('PT1H30M');
      expect(Duration.of({ days: 2, hours: 4 }).toISOString()).toBe('P2DT4H');
      expect(Duration.fromNanoseconds(1n).toISOString()).toBe('PT0.000000001S');
    });

    it('formats negative durations in ISO-8601', () => {
      expect(Duration.fromSeconds(-5).toISOString()).toBe('-PT5S');
      expect(Duration.fromDays(-1).toISOString()).toBe('-P1D');
    });

    it('parses valid ISO-8601 duration strings', () => {
      const d1 = Duration.parseISO('PT1H30M');
      expect(d1.totalMinutes).toBe(90);

      const d2 = Duration.parseISO('P2DT3H4M5.5S');
      expect(d2.nanoseconds).toBe(
        2n * NANOSECONDS_PER_DAY +
          3n * NANOSECONDS_PER_HOUR +
          4n * NANOSECONDS_PER_MINUTE +
          5n * NANOSECONDS_PER_SECOND +
          500_000_000n
      );

      const d3 = Duration.parseISO('-PT10S');
      expect(d3.nanoseconds).toBe(-10n * NANOSECONDS_PER_SECOND);
    });

    it('throws on invalid ISO duration strings', () => {
      expect(() => Duration.parseISO('invalid')).toThrow(RangeError);
      expect(() => Duration.parseISO('10S')).toThrow(RangeError);

      // Bare P and PT without components are invalid in ISO 8601
      expect(() => Duration.parseISO('P')).toThrow(RangeError);
      expect(() => Duration.parseISO('PT')).toThrow(RangeError);
      expect(() => Duration.parseISO('-P')).toThrow(RangeError);
      expect(() => Duration.parseISO('+P')).toThrow(RangeError);
      expect(() => Duration.parseISO('P1DT')).toThrow(RangeError);
    });

    it('safe equals and comparison methods against null and invalid instances', () => {
      expect(Duration.zero().equals(null)).toBe(false);
      expect(Duration.zero().equals(undefined)).toBe(false);
      expect(Duration.zero().equals(0)).toBe(false);
      expect(Duration.zero().equals({})).toBe(false);

      expect(() => Duration.zero().compareTo(null as any)).toThrow(TypeError);
      expect(() => Duration.zero().add(null as any)).toThrow(TypeError);
      expect(() => Duration.zero().subtract(null as any)).toThrow(TypeError);
      expect(() => Duration.zero().isGreaterThan(null as any)).toThrow(TypeError);
      expect(() => Duration.zero().isLessThan(null as any)).toThrow(TypeError);

      expect(() => Duration.of(null as any)).toThrow(TypeError);
      expect(() => Duration.of({ seconds: NaN })).toThrow(TypeError);
      expect(() => Duration.of({ minutes: Infinity })).toThrow(TypeError);
      expect(() => Duration.fromSeconds(NaN)).toThrow(TypeError);
      expect(() => Duration.fromSeconds(Infinity)).toThrow(TypeError);
      expect(() => Duration.fromSeconds('abc' as any)).toThrow(TypeError);
      expect(() => Duration.of({ seconds: 'abc' as any })).toThrow(TypeError);
      expect(() => Duration.fromMilliseconds(NaN)).toThrow(TypeError);
      expect(() => Duration.fromNanoseconds(NaN)).toThrow(TypeError);
    });

    it('round-trips JSON serialization', () => {
      const orig = Duration.fromNanoseconds(-987654321012345678n);
      const json = orig.toJSON();
      expect(typeof json.nanoseconds).toBe('string');

      const restored = Duration.fromJSON(json);
      expect(restored.equals(orig)).toBe(true);

      const fromStr = Duration.fromJSON(orig.nanoseconds.toString());
      expect(fromStr.equals(orig)).toBe(true);
    });
  });

  describe('Property-Based Mathematical Laws', () => {
    const arbitraryNanoseconds = fc.bigInt({
      min: -8_640_000_000_000_000_000_000n,
      max: 8_640_000_000_000_000_000_000n,
    });

    it('satisfies additive identity: d + 0 = d', () => {
      fc.assert(
        fc.property(arbitraryNanoseconds, (ns) => {
          const d = Duration.fromNanoseconds(ns);
          return d.add(Duration.zero()).equals(d);
        })
      );
    });

    it('satisfies additive inverse: d + (-d) = 0', () => {
      fc.assert(
        fc.property(arbitraryNanoseconds, (ns) => {
          const d = Duration.fromNanoseconds(ns);
          return d.add(d.negate()).isZero();
        })
      );
    });

    it('satisfies involution of negation: -(-d) = d', () => {
      fc.assert(
        fc.property(arbitraryNanoseconds, (ns) => {
          const d = Duration.fromNanoseconds(ns);
          return d.negate().negate().equals(d);
        })
      );
    });

    it('satisfies commutativity of addition: a + b = b + a', () => {
      fc.assert(
        fc.property(
          fc.bigInt({ min: -1_000_000_000_000_000n, max: 1_000_000_000_000_000n }),
          fc.bigInt({ min: -1_000_000_000_000_000n, max: 1_000_000_000_000_000n }),
          (nsA, nsB) => {
            const a = Duration.fromNanoseconds(nsA);
            const b = Duration.fromNanoseconds(nsB);
            return a.add(b).equals(b.add(a));
          }
        )
      );
    });
  });
});
