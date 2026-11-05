import { describe, expect, it } from 'vitest';
import {
  converseRelation,
  Duration,
  Instant,
  Interval,
  IntervalSet,
  Place,
} from '../src/core/index.js';
import { Time, ChronoFlux } from '../src/index.js';

describe('Time and ChronoFlux Public Facade & Uncovered Edge Paths', () => {
  describe('Time Facade Methods', () => {
    it('verifies ChronoFlux is an exact alias of Time', () => {
      expect(ChronoFlux).toBe(Time);
    });

    it('creates Instant via now() and instant()', () => {
      const now = Time.now();
      expect(now).toBeInstanceOf(Instant);

      const fromBigInt = Time.instant(1000n);
      expect(fromBigInt.epochNanoseconds).toBe(1000n);

      const fromMs = Time.instant(500);
      expect(fromMs.epochNanoseconds).toBe(500_000_000n);

      const date = new Date(1730550000000);
      const fromDate = Time.instant(date);
      expect(fromDate.toEpochMilliseconds()).toBe(1730550000000);

      const fromIso = Time.instant('2026-11-02T12:00:00.000Z');
      expect(fromIso.toISOString()).toBe('2026-11-02T12:00:00.000Z');

      expect(() => Time.instant(null as any)).toThrow(TypeError);
    });

    it('creates Durations via duration namespace', () => {
      expect(Time.duration.nanoseconds(10).nanoseconds).toBe(10n);
      expect(Time.duration.microseconds(10).nanoseconds).toBe(10_000n);
      expect(Time.duration.milliseconds(10).nanoseconds).toBe(10_000_000n);
      expect(Time.duration.seconds(10).nanoseconds).toBe(10_000_000_000n);
      expect(Time.duration.minutes(10).nanoseconds).toBe(600_000_000_000n);
      expect(Time.duration.hours(10).nanoseconds).toBe(36_000_000_000_000n);
      expect(Time.duration.days(1).nanoseconds).toBe(86_400_000_000_000n);
      expect(Time.duration.zero().isZero()).toBe(true);
      expect(Time.duration.of({ seconds: 5, milliseconds: 500 }).nanoseconds).toBe(5_500_000_000n);
    });

    it('creates Place via place()', () => {
      const p = Time.place({ latitude: 12.34, longitude: 56.78 });
      expect(p).toBeInstanceOf(Place);
    });

    it('creates Interval and IntervalSet via facade', () => {
      const i1 = Time.instant(0n);
      const i2 = Time.instant(1000n);
      const iv = Time.interval(i1, i2);
      expect(iv).toBeInstanceOf(Interval);

      const emptySet = Time.intervalSet.empty();
      expect(emptySet.isEmpty()).toBe(true);

      const setFromList = Time.intervalSet.from([iv]);
      expect(setFromList.count()).toBe(1);

      const setOf = Time.intervalSet.of(iv);
      expect(setOf.count()).toBe(1);
    });
  });

  describe('Edge Error Paths & Robustness', () => {
    it('throws RangeError on invalid AllenRelation in converseRelation', () => {
      expect(() => converseRelation('invalid' as any)).toThrow(RangeError);
    });

    it('Duration toString, and invalid fromJSON inputs', () => {
      const d = Duration.fromSeconds(5);
      expect(d.toString()).toBe('PT5S');
      expect(() => Duration.fromJSON(null as any)).toThrow(TypeError);
      expect(() => Duration.fromJSON({} as any)).toThrow(TypeError);

      // Parse with explicit '+' in ISO duration
      const dPlus = Duration.fromJSON('+PT10S');
      expect(dPlus.totalSeconds).toBe(10);
    });

    it('Instant now, toString, toEpochNanosecondsString, and invalid fromJSON', () => {
      const inst = Instant.now();
      expect(inst.epochNanoseconds).toBeGreaterThan(0n);
      expect(inst.toString()).toBe(inst.toISOString());
      expect(inst.toEpochNanosecondsString()).toBe(inst.epochNanoseconds.toString());

      expect(() => Instant.fromJSON(null as any)).toThrow(TypeError);
      expect(() => Instant.fromJSON({} as any)).toThrow(TypeError);

      // Invalid rounding mode
      expect(() => inst.toEpochMillisecondsBigInt('invalid_mode' as any)).toThrow(RangeError);
    });

    it('Interval.of, Interval invalid fromJSON', () => {
      const i1 = Instant.fromEpochNanoseconds(0n);
      const i2 = Instant.fromEpochNanoseconds(100n);
      const iv = Interval.of(i1, i2);
      expect(iv.duration.nanoseconds).toBe(100n);

      expect(() => Interval.fromJSON(null as any)).toThrow(TypeError);
      expect(() => Interval.fromJSON({} as any)).toThrow(TypeError);
    });

    it('IntervalSet Symbol.iterator, toString, invalid fromJSON, invalid items', () => {
      const iv1 = new Interval(Instant.fromEpochNanoseconds(0n), Instant.fromEpochNanoseconds(10n));
      const iv2 = new Interval(Instant.fromEpochNanoseconds(20n), Instant.fromEpochNanoseconds(30n));
      const set = IntervalSet.from([iv1, iv2]);

      // Test iterator protocol in for-of loop
      const collected: Interval[] = [];
      for (const item of set) {
        collected.push(item);
      }
      expect(collected.length).toBe(2);

      expect(set.toString()).toContain('[1970-01-01T00:00:00.000Z');

      expect(() => IntervalSet.fromJSON(null as any)).toThrow(TypeError);
      expect(() => IntervalSet.fromJSON({ intervals: 'not an array' } as any)).toThrow(TypeError);
      expect(() => IntervalSet.from([null as any])).toThrow(TypeError);
    });
  });
});
