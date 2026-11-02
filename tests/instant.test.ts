import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  Duration,
  Instant,
  MAX_EPOCH_NANOSECONDS,
  MIN_EPOCH_NANOSECONDS,
  NANOSECONDS_PER_DAY,
  NANOSECONDS_PER_MILLISECOND,
  NANOSECONDS_PER_SECOND,
} from '../src/index.js';

describe('Instant Primitive', () => {
  describe('Range Boundaries & Construction', () => {
    it('constructs Unix Epoch instant at 0ns', () => {
      const epoch = Instant.fromEpochNanoseconds(0n);
      expect(epoch.epochNanoseconds).toBe(0n);
      expect(epoch.equals(Instant.EPOCH)).toBe(true);
      expect(epoch.toISOString()).toBe('1970-01-01T00:00:00.000Z');
    });

    it('accepts exact min and max bounds', () => {
      expect(Instant.MIN.epochNanoseconds).toBe(MIN_EPOCH_NANOSECONDS);
      expect(Instant.MAX.epochNanoseconds).toBe(MAX_EPOCH_NANOSECONDS);

      const minInstant = Instant.fromEpochNanoseconds(MIN_EPOCH_NANOSECONDS);
      const maxInstant = Instant.fromEpochNanoseconds(MAX_EPOCH_NANOSECONDS);
      expect(minInstant.equals(Instant.MIN)).toBe(true);
      expect(maxInstant.equals(Instant.MAX)).toBe(true);
    });

    it('rejects nanoseconds exceeding min or max bounds', () => {
      expect(() => Instant.fromEpochNanoseconds(MIN_EPOCH_NANOSECONDS - 1n)).toThrow(RangeError);
      expect(() => Instant.fromEpochNanoseconds(MAX_EPOCH_NANOSECONDS + 1n)).toThrow(RangeError);
    });

    it('rejects non-bigint types in constructor', () => {
      expect(() => new (Instant as any)(1000)).toThrow(TypeError);
      expect(() => new (Instant as any)('1000')).toThrow(TypeError);
    });

    it('creates instant from microseconds and seconds', () => {
      const fromUs = Instant.fromEpochMicroseconds(100);
      expect(fromUs.epochNanoseconds).toBe(100_000n);

      const fromUsBig = Instant.fromEpochMicroseconds(200n);
      expect(fromUsBig.epochNanoseconds).toBe(200_000n);

      const fromSec = Instant.fromEpochSeconds(5);
      expect(fromSec.epochNanoseconds).toBe(5_000_000_000n);

      const fromSecBig = Instant.fromEpochSeconds(10n);
      expect(fromSecBig.epochNanoseconds).toBe(10_000_000_000n);
    });

    it('formats dates with year > 9999 in expanded ISO-8601 format', () => {
      // Near MAX_EPOCH_NANOSECONDS (~year 275760 CE)
      const future = Instant.fromEpochNanoseconds(MAX_EPOCH_NANOSECONDS);
      const iso = future.toISOString();
      expect(iso.startsWith('+')).toBe(true);
      expect(iso).toContain('T');
      expect(iso.endsWith('Z')).toBe(true);
    });
  });

  describe('Pre-1970 and Negative Epoch Timestamps', () => {
    it('handles negative epoch timestamps before 1970', () => {
      // 1 nanosecond before epoch
      const justBefore = Instant.fromEpochNanoseconds(-1n);
      expect(justBefore.epochNanoseconds).toBe(-1n);
      expect(justBefore.toISOString()).toBe('1969-12-31T23:59:59.999999999Z');

      // Exactly 1 second before epoch
      const oneSecBefore = Instant.fromEpochNanoseconds(-NANOSECONDS_PER_SECOND);
      expect(oneSecBefore.toISOString()).toBe('1969-12-31T23:59:59.000Z');

      // Exactly 1 day before epoch
      const oneDayBefore = Instant.fromEpochNanoseconds(-NANOSECONDS_PER_DAY);
      expect(oneDayBefore.toISOString()).toBe('1969-12-31T00:00:00.000Z');

      // The year 1900
      const d1900 = Instant.fromISOString('1900-01-01T00:00:00.000Z');
      expect(d1900.epochNanoseconds).toBeLessThan(0n);
      expect(d1900.toISOString()).toBe('1900-01-01T00:00:00.000Z');
    });

    it('handles ancient BCE dates', () => {
      const ancient = Instant.fromISOString('-000500-01-01T12:00:00.000Z');
      expect(ancient.epochNanoseconds).toBeLessThan(0n);
      expect(ancient.toISOString()).toBe('-000500-01-01T12:00:00.000Z');
    });
  });

  describe('Rounding and Millisecond Conversion Modes', () => {
    // 1 millisecond = 1,000,000 nanoseconds
    const baseMs = 100n;
    const baseNs = baseMs * NANOSECONDS_PER_MILLISECOND; // 100,000,000n

    it('rounds positive fractional milliseconds correctly', () => {
      // 100.25 ms = 100,250,000 ns
      const tQuarter = Instant.fromEpochNanoseconds(baseNs + 250_000n);
      expect(tQuarter.toEpochMillisecondsBigInt('trunc')).toBe(100n);
      expect(tQuarter.toEpochMillisecondsBigInt('floor')).toBe(100n);
      expect(tQuarter.toEpochMillisecondsBigInt('ceil')).toBe(101n);
      expect(tQuarter.toEpochMillisecondsBigInt('halfExpand')).toBe(100n);

      // 100.50 ms = 100,500,000 ns
      const tHalf = Instant.fromEpochNanoseconds(baseNs + 500_000n);
      expect(tHalf.toEpochMillisecondsBigInt('trunc')).toBe(100n);
      expect(tHalf.toEpochMillisecondsBigInt('floor')).toBe(100n);
      expect(tHalf.toEpochMillisecondsBigInt('ceil')).toBe(101n);
      expect(tHalf.toEpochMillisecondsBigInt('halfExpand')).toBe(101n);

      // 100.75 ms = 100,750,000 ns
      const tThreeQuarter = Instant.fromEpochNanoseconds(baseNs + 750_000n);
      expect(tThreeQuarter.toEpochMillisecondsBigInt('trunc')).toBe(100n);
      expect(tThreeQuarter.toEpochMillisecondsBigInt('floor')).toBe(100n);
      expect(tThreeQuarter.toEpochMillisecondsBigInt('ceil')).toBe(101n);
      expect(tThreeQuarter.toEpochMillisecondsBigInt('halfExpand')).toBe(101n);
    });

    it('rounds negative fractional milliseconds correctly', () => {
      // -100.25 ms = -100,250,000 ns
      const negQuarter = Instant.fromEpochNanoseconds(-baseNs - 250_000n);
      expect(negQuarter.toEpochMillisecondsBigInt('trunc')).toBe(-100n);
      expect(negQuarter.toEpochMillisecondsBigInt('floor')).toBe(-101n);
      expect(negQuarter.toEpochMillisecondsBigInt('ceil')).toBe(-100n);
      expect(negQuarter.toEpochMillisecondsBigInt('halfExpand')).toBe(-100n);

      // -100.50 ms = -100,500,000 ns
      const negHalf = Instant.fromEpochNanoseconds(-baseNs - 500_000n);
      expect(negHalf.toEpochMillisecondsBigInt('trunc')).toBe(-100n);
      expect(negHalf.toEpochMillisecondsBigInt('floor')).toBe(-101n);
      expect(negHalf.toEpochMillisecondsBigInt('ceil')).toBe(-100n);
      expect(negHalf.toEpochMillisecondsBigInt('halfExpand')).toBe(-101n);

      // -100.75 ms = -100,750,000 ns
      const negThreeQuarter = Instant.fromEpochNanoseconds(-baseNs - 750_000n);
      expect(negThreeQuarter.toEpochMillisecondsBigInt('trunc')).toBe(-100n);
      expect(negThreeQuarter.toEpochMillisecondsBigInt('floor')).toBe(-101n);
      expect(negThreeQuarter.toEpochMillisecondsBigInt('ceil')).toBe(-100n);
      expect(negThreeQuarter.toEpochMillisecondsBigInt('halfExpand')).toBe(-101n);
    });

    it('exact millisecond multiples produce identical values across all rounding modes', () => {
      const exact = Instant.fromEpochMilliseconds(500n);
      expect(exact.toEpochMillisecondsBigInt('trunc')).toBe(500n);
      expect(exact.toEpochMillisecondsBigInt('floor')).toBe(500n);
      expect(exact.toEpochMillisecondsBigInt('ceil')).toBe(500n);
      expect(exact.toEpochMillisecondsBigInt('halfExpand')).toBe(500n);
    });
  });

  describe('JavaScript Date and TC39 Temporal Adapters', () => {
    it('converts to and from JavaScript Date', () => {
      const now = new Date();
      const instant = Instant.fromDate(now);

      expect(instant.toEpochMilliseconds()).toBe(now.getTime());
      expect(instant.toDate().getTime()).toBe(now.getTime());

      // Pre-1970 date
      const pre1970 = new Date('1965-06-15T12:00:00Z');
      const instPre = Instant.fromDate(pre1970);
      expect(instPre.toEpochMilliseconds()).toBe(pre1970.getTime());
      expect(instPre.toDate().getTime()).toBe(pre1970.getTime());
    });

    it('throws on invalid Date conversion', () => {
      expect(() => Instant.fromDate(new Date('invalid'))).toThrow(RangeError);
    });

    it('interoperates with TC39 Temporal.Instant where available', () => {
      const globalTemporal = (globalThis as any).Temporal;
      if (globalTemporal?.Instant) {
        const inst = Instant.fromEpochNanoseconds(123456789012345n);
        const temp = inst.toTemporalInstant();

        expect(typeof temp).toBe('object');
        expect(temp.epochNanoseconds).toBe(123456789012345n);

        const restored = Instant.fromTemporalInstant(temp);
        expect(restored.equals(inst)).toBe(true);
      } else {
        // Fallback check: throws error when Temporal is absent
        const inst = Instant.fromEpochNanoseconds(1000n);
        expect(() => inst.toTemporalInstant()).toThrow();
      }
    });

    it('validates argument in fromTemporalInstant', () => {
      expect(() => Instant.fromTemporalInstant(null as any)).toThrow(TypeError);
      expect(() => Instant.fromTemporalInstant({} as any)).toThrow(TypeError);
      expect(() => Instant.fromTemporalInstant({ epochNanoseconds: 123 as any })).toThrow(TypeError);
    });
  });

  describe('Exact Arithmetic & Comparisons', () => {
    it('adds and subtracts durations exactly', () => {
      const start = Instant.fromEpochNanoseconds(1_000_000_000n);
      const delta = Duration.fromNanoseconds(500_000_000n);

      const added = start.add(delta);
      expect(added.epochNanoseconds).toBe(1_500_000_000n);

      const subtracted = added.subtract(delta);
      expect(subtracted.equals(start)).toBe(true);
    });

    it('diff, since, and until calculate exact durations', () => {
      const t1 = Instant.fromEpochNanoseconds(100n);
      const t2 = Instant.fromEpochNanoseconds(300n);

      expect(t2.diff(t1).nanoseconds).toBe(200n);
      expect(t2.since(t1).nanoseconds).toBe(200n);
      expect(t1.until(t2).nanoseconds).toBe(200n);
      expect(t1.diff(t2).nanoseconds).toBe(-200n);
    });

    it('relational comparisons', () => {
      const t1 = Instant.fromEpochNanoseconds(100n);
      const t2 = Instant.fromEpochNanoseconds(200n);
      const t3 = Instant.fromEpochNanoseconds(200n);

      expect(t1.compareTo(t2)).toBe(-1);
      expect(t2.compareTo(t1)).toBe(1);
      expect(t2.compareTo(t3)).toBe(0);

      expect(t1.isBefore(t2)).toBe(true);
      expect(t1.isBeforeOrEqual(t2)).toBe(true);
      expect(t2.isAfter(t1)).toBe(true);
      expect(t2.isAfterOrEqual(t1)).toBe(true);
      expect(t2.equals(t3)).toBe(true);
      expect(t2.isBeforeOrEqual(t3)).toBe(true);
      expect(t2.isAfterOrEqual(t3)).toBe(true);
    });
  });

  describe('ISO 8601 String Formatting & Parsing', () => {
    it('formats nanosecond precision', () => {
      const inst = Instant.fromEpochNanoseconds(123456789n);
      expect(inst.toISOString()).toBe('1970-01-01T00:00:00.123456789Z');
    });

    it('parses timestamps with millisecond precision', () => {
      const iso = '2026-11-02T12:30:45.500Z';
      const inst = Instant.fromISOString(iso);
      expect(inst.toISOString()).toBe(iso);
    });

    it('parses timestamps with full nanosecond precision', () => {
      const iso = '2026-11-02T12:30:45.123456789Z';
      const inst = Instant.fromISOString(iso);
      expect(inst.toISOString()).toBe(iso);
    });

    it('parses timestamps with timezone offsets', () => {
      // 12:00:00 +05:30 is 06:30:00 UTC
      const inst = Instant.fromISOString('2026-11-02T12:00:00+05:30');
      expect(inst.toISOString()).toBe('2026-11-02T06:30:00.000Z');

      // 12:00:00 -04:00 is 16:00:00 UTC
      const instNeg = Instant.fromISOString('2026-11-02T12:00:00-04:00');
      expect(instNeg.toISOString()).toBe('2026-11-02T16:00:00.000Z');
    });

    it('throws on invalid ISO strings', () => {
      expect(() => Instant.fromISOString('not-a-date')).toThrow(RangeError);
      expect(() => Instant.fromISOString('2026-13-01T00:00:00Z')).toThrow(RangeError);
      expect(() => Instant.fromISOString('2026-01-32T00:00:00Z')).toThrow(RangeError);
    });
  });

  describe('JSON Serialization & Deserialization', () => {
    it('serializes to decimal string without losing precision', () => {
      const original = Instant.fromEpochNanoseconds(1730550000123456789n);
      const json = original.toJSON();

      expect(json.epochNanoseconds).toBe('1730550000123456789');
      // Verify standard JSON.stringify does NOT throw
      const jsonString = JSON.stringify(original);
      expect(jsonString).toContain('1730550000123456789');

      const deserialized = Instant.fromJSON(json);
      expect(deserialized.equals(original)).toBe(true);
    });

    it('deserializes from decimal string or ISO string', () => {
      const inst1 = Instant.fromJSON('123456789');
      expect(inst1.epochNanoseconds).toBe(123456789n);

      const inst2 = Instant.fromJSON('2026-11-02T12:00:00.000Z');
      expect(inst2.toISOString()).toBe('2026-11-02T12:00:00.000Z');
    });
  });

  describe('Property-Based Invariants', () => {
    it('instant.add(duration).diff(instant) === duration', () => {
      fc.assert(
        fc.property(
          fc.bigInt({ min: -1_000_000_000_000_000_000n, max: 1_000_000_000_000_000_000n }),
          fc.bigInt({ min: -100_000_000_000_000n, max: 100_000_000_000_000n }),
          (instNs, durNs) => {
            const instant = Instant.fromEpochNanoseconds(instNs);
            const duration = Duration.fromNanoseconds(durNs);
            return instant.add(duration).diff(instant).equals(duration);
          }
        )
      );
    });

    it('transitivity of comparisons: if a < b and b < c then a < c', () => {
      fc.assert(
        fc.property(
          fc.bigInt({ min: -1_000_000_000_000_000n, max: 1_000_000_000_000_000n }),
          fc.bigInt({ min: -1_000_000_000_000_000n, max: 1_000_000_000_000_000n }),
          fc.bigInt({ min: -1_000_000_000_000_000n, max: 1_000_000_000_000_000n }),
          (nsA, nsB, nsC) => {
            const a = Instant.fromEpochNanoseconds(nsA);
            const b = Instant.fromEpochNanoseconds(nsB);
            const c = Instant.fromEpochNanoseconds(nsC);

            if (a.isBefore(b) && b.isBefore(c)) {
              return a.isBefore(c);
            }
            return true;
          }
        )
      );
    });
  });
});
