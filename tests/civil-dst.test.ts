/**
 * @file civil-dst.test.ts
 * Civil Calendar and IANA Time Zone Model Tests.
 * Validates DST spring-forward skipped hours, fall-back repeated hours,
 * cross-timezone offset calculations, and disambiguation policies.
 */

import { describe, expect, it } from 'vitest';
import { ChronoFlux } from '../src/index.js';

describe('Civil Calendar & IANA Time Zone Model', () => {
  describe('Basic Civil State Evaluation', () => {
    it('evaluates UTC civil state correctly', () => {
      const instant = ChronoFlux.instant('2026-07-04T18:30:45.123456Z');
      const civil = ChronoFlux.civil.evaluate(instant, 'UTC');

      expect(civil.year).toBe(2026);
      expect(civil.month).toBe(7);
      expect(civil.day).toBe(4);
      expect(civil.hour).toBe(18);
      expect(civil.minute).toBe(30);
      expect(civil.second).toBe(45);
      expect(civil.millisecond).toBe(123);
      expect(civil.nanosecond).toBe(456000);
      expect(civil.timeZoneId).toBe('UTC');
      expect(civil.utcOffsetMinutes).toBe(0);
      expect(civil.isDaylightSaving).toBe(false);
      expect(Object.isFrozen(civil)).toBe(true);
    });

    it('evaluates local time for New York in winter (EST, UTC-5)', () => {
      const instant = ChronoFlux.instant('2026-01-15T17:00:00Z');
      const civil = ChronoFlux.civil.evaluate(instant, 'America/New_York');

      expect(civil.year).toBe(2026);
      expect(civil.month).toBe(1);
      expect(civil.day).toBe(15);
      expect(civil.hour).toBe(12);
      expect(civil.minute).toBe(0);
      expect(civil.second).toBe(0);
      expect(civil.utcOffsetMinutes).toBe(-300);
      expect(civil.isDaylightSaving).toBe(false);
    });

    it('evaluates local time for New York in summer (EDT, UTC-4)', () => {
      const instant = ChronoFlux.instant('2026-07-15T16:00:00Z');
      const civil = ChronoFlux.civil.evaluate(instant, 'America/New_York');

      expect(civil.year).toBe(2026);
      expect(civil.month).toBe(7);
      expect(civil.day).toBe(15);
      expect(civil.hour).toBe(12);
      expect(civil.minute).toBe(0);
      expect(civil.second).toBe(0);
      expect(civil.utcOffsetMinutes).toBe(-240);
      expect(civil.isDaylightSaving).toBe(true);
    });

    it('evaluates non-DST timezones like Asia/Kolkata (UTC+5:30)', () => {
      const instant = ChronoFlux.instant('2026-06-15T12:00:00Z');
      const civil = ChronoFlux.civil.evaluate(instant, 'Asia/Kolkata');

      expect(civil.hour).toBe(17);
      expect(civil.minute).toBe(30);
      expect(civil.utcOffsetMinutes).toBe(330);
      expect(civil.isDaylightSaving).toBe(false);
    });

    it('evaluates Southern Hemisphere DST like Australia/Sydney (summer in Jan, winter in July)', () => {
      // Sydney in January (AEDT, UTC+11, DST is active)
      const janInstant = ChronoFlux.instant('2026-01-15T01:00:00Z');
      const janCivil = ChronoFlux.civil.evaluate(janInstant, 'Australia/Sydney');
      expect(janCivil.utcOffsetMinutes).toBe(660); // UTC+11
      expect(janCivil.isDaylightSaving).toBe(true);

      // Sydney in July (AEST, UTC+10, standard winter time)
      const julInstant = ChronoFlux.instant('2026-07-15T02:00:00Z');
      const julCivil = ChronoFlux.civil.evaluate(julInstant, 'Australia/Sydney');
      expect(julCivil.utcOffsetMinutes).toBe(600); // UTC+10
      expect(julCivil.isDaylightSaving).toBe(false);
    });

    it('evaluates fractional offset timezones with 30-minute DST shift (Australia/Lord_Howe)', () => {
      // Lord Howe in July (winter, UTC+10:30)
      const winter = ChronoFlux.civil.evaluate(ChronoFlux.instant('2026-07-15T12:00:00Z'), 'Australia/Lord_Howe');
      expect(winter.utcOffsetMinutes).toBe(630); // 10.5 hours

      // Lord Howe in January (summer DST, UTC+11:00)
      const summer = ChronoFlux.civil.evaluate(ChronoFlux.instant('2026-01-15T12:00:00Z'), 'Australia/Lord_Howe');
      expect(summer.utcOffsetMinutes).toBe(660); // 11.0 hours
      expect(summer.isDaylightSaving).toBe(true);
    });
  });

  describe('DST Spring-Forward Disambiguation (Skipped Hour)', () => {
    // In America/New_York on 2026-03-08, 02:00-02:59 is skipped (clocks jump 02:00 -> 03:00)
    it("throws RangeError when disambiguation is 'reject'", () => {
      expect(() => {
        ChronoFlux.civil.resolve({
          year: 2026,
          month: 3,
          day: 8,
          hour: 2,
          minute: 30,
          timeZoneId: 'America/New_York',
          disambiguation: 'reject',
        });
      }).toThrow(RangeError);
    });

    it("advances past gap when disambiguation is 'compatible' or 'later'", () => {
      const resolvedCompatible = ChronoFlux.civil.resolve({
        year: 2026,
        month: 3,
        day: 8,
        hour: 2,
        minute: 30,
        timeZoneId: 'America/New_York',
        disambiguation: 'compatible',
      });

      const resolvedLater = ChronoFlux.civil.resolve({
        year: 2026,
        month: 3,
        day: 8,
        hour: 2,
        minute: 30,
        timeZoneId: 'America/New_York',
        disambiguation: 'later',
      });

      expect(resolvedCompatible.equals(resolvedLater)).toBe(true);

      // In wall-clock time, 02:30 advances by 1h gap to 03:30 EDT (-4h offset) => 07:30 UTC
      const civilCheck = ChronoFlux.civil.evaluate(resolvedCompatible, 'America/New_York');
      expect(civilCheck.hour).toBe(3);
      expect(civilCheck.minute).toBe(30);
      expect(civilCheck.utcOffsetMinutes).toBe(-240);
    });

    it("moves before gap when disambiguation is 'earlier'", () => {
      const resolvedEarlier = ChronoFlux.civil.resolve({
        year: 2026,
        month: 3,
        day: 8,
        hour: 2,
        minute: 30,
        timeZoneId: 'America/New_York',
        disambiguation: 'earlier',
      });

      // In wall-clock time, moves 1h before gap to 01:30 EST (-5h offset) => 06:30 UTC
      const civilCheck = ChronoFlux.civil.evaluate(resolvedEarlier, 'America/New_York');
      expect(civilCheck.hour).toBe(1);
      expect(civilCheck.minute).toBe(30);
      expect(civilCheck.utcOffsetMinutes).toBe(-300);
    });
  });

  describe('DST Fall-Back Disambiguation (Repeated Hour)', () => {
    // In America/New_York on 2026-11-01, 01:00-01:59 occurs twice (EDT UTC-4, then EST UTC-5)
    it("throws RangeError when disambiguation is 'reject'", () => {
      expect(() => {
        ChronoFlux.civil.resolve({
          year: 2026,
          month: 11,
          day: 1,
          hour: 1,
          minute: 30,
          timeZoneId: 'America/New_York',
          disambiguation: 'reject',
        });
      }).toThrow(RangeError);
    });

    it("selects earlier EDT instance when disambiguation is 'compatible' or 'earlier'", () => {
      const resolvedCompatible = ChronoFlux.civil.resolve({
        year: 2026,
        month: 11,
        day: 1,
        hour: 1,
        minute: 30,
        timeZoneId: 'America/New_York',
        disambiguation: 'compatible',
      });

      const resolvedEarlier = ChronoFlux.civil.resolve({
        year: 2026,
        month: 11,
        day: 1,
        hour: 1,
        minute: 30,
        timeZoneId: 'America/New_York',
        disambiguation: 'earlier',
      });

      expect(resolvedCompatible.equals(resolvedEarlier)).toBe(true);

      // Earlier instance: 01:30 EDT (-4h) => 05:30 UTC
      expect(resolvedCompatible.toISOString()).toBe('2026-11-01T05:30:00.000Z');
      const civil = ChronoFlux.civil.evaluate(resolvedCompatible, 'America/New_York');
      expect(civil.utcOffsetMinutes).toBe(-240);
      expect(civil.isDaylightSaving).toBe(true);
      expect(civil.transition?.isAmbiguous).toBe(true);
    });

    it("selects later EST instance when disambiguation is 'later'", () => {
      const resolvedLater = ChronoFlux.civil.resolve({
        year: 2026,
        month: 11,
        day: 1,
        hour: 1,
        minute: 30,
        timeZoneId: 'America/New_York',
        disambiguation: 'later',
      });

      // Later instance: 01:30 EST (-5h) => 06:30 UTC
      expect(resolvedLater.toISOString()).toBe('2026-11-01T06:30:00.000Z');
      const civil = ChronoFlux.civil.evaluate(resolvedLater, 'America/New_York');
      expect(civil.utcOffsetMinutes).toBe(-300);
      expect(civil.isDaylightSaving).toBe(false);
      expect(civil.transition?.isAmbiguous).toBe(true);
    });
  });

  describe('Precision & Sub-millisecond Preservation', () => {
    it('accurately preserves sub-millisecond nanoseconds when resolving civil input', () => {
      const instant = ChronoFlux.civil.resolve({
        year: 2026,
        month: 5,
        day: 20,
        hour: 14,
        minute: 25,
        second: 30,
        millisecond: 500,
        nanosecond: 123456,
        timeZoneId: 'Europe/Paris',
      });

      const civil = ChronoFlux.civil.evaluate(instant, 'Europe/Paris');
      expect(civil.year).toBe(2026);
      expect(civil.month).toBe(5);
      expect(civil.day).toBe(20);
      expect(civil.hour).toBe(14);
      expect(civil.minute).toBe(25);
      expect(civil.second).toBe(30);
      expect(civil.millisecond).toBe(500);
      expect(civil.nanosecond).toBe(123456);
    });
  });

  describe('Pure Intl Reference Implementation Fallback', () => {
    it('executes identical disambiguation when Temporal is unavailable', () => {
      // Temporarily stash and remove global Temporal
      const globalObj = globalThis as Record<string, unknown>;
      const originalTemporal = globalObj['Temporal'];
      try {
        delete globalObj['Temporal'];

        // 1. Spring forward compatible
        const resolvedSpringCompatible = ChronoFlux.civil.resolve({
          year: 2026,
          month: 3,
          day: 8,
          hour: 2,
          minute: 30,
          timeZoneId: 'America/New_York',
          disambiguation: 'compatible',
        });
        const springCivil = ChronoFlux.civil.evaluate(resolvedSpringCompatible, 'America/New_York');
        expect(springCivil.hour).toBe(3);
        expect(springCivil.minute).toBe(30);

        // 2. Spring forward earlier
        const resolvedSpringEarlier = ChronoFlux.civil.resolve({
          year: 2026,
          month: 3,
          day: 8,
          hour: 2,
          minute: 30,
          timeZoneId: 'America/New_York',
          disambiguation: 'earlier',
        });
        const springEarlierCivil = ChronoFlux.civil.evaluate(resolvedSpringEarlier, 'America/New_York');
        expect(springEarlierCivil.hour).toBe(1);
        expect(springEarlierCivil.minute).toBe(30);

        // 3. Spring forward reject
        expect(() => {
          ChronoFlux.civil.resolve({
            year: 2026,
            month: 3,
            day: 8,
            hour: 2,
            minute: 30,
            timeZoneId: 'America/New_York',
            disambiguation: 'reject',
          });
        }).toThrow(RangeError);

        // 4. Fall back earlier
        const resolvedFallEarlier = ChronoFlux.civil.resolve({
          year: 2026,
          month: 11,
          day: 1,
          hour: 1,
          minute: 30,
          timeZoneId: 'America/New_York',
          disambiguation: 'earlier',
        });
        expect(resolvedFallEarlier.toISOString()).toBe('2026-11-01T05:30:00.000Z');

        // 5. Fall back later
        const resolvedFallLater = ChronoFlux.civil.resolve({
          year: 2026,
          month: 11,
          day: 1,
          hour: 1,
          minute: 30,
          timeZoneId: 'America/New_York',
          disambiguation: 'later',
        });
        expect(resolvedFallLater.toISOString()).toBe('2026-11-01T06:30:00.000Z');

        // 6. Fall back reject
        expect(() => {
          ChronoFlux.civil.resolve({
            year: 2026,
            month: 11,
            day: 1,
            hour: 1,
            minute: 30,
            timeZoneId: 'America/New_York',
            disambiguation: 'reject',
          });
        }).toThrow(RangeError);

        // 7. Normal instant
        const resolvedNormal = ChronoFlux.civil.resolve({
          year: 2026,
          month: 6,
          day: 1,
          hour: 12,
          timeZoneId: 'America/New_York',
        });
        expect(resolvedNormal.toISOString()).toBe('2026-06-01T16:00:00.000Z');
      } finally {
        globalObj['Temporal'] = originalTemporal;
      }
    });
  });

  describe('Input Validation & Error Paths', () => {
    it('throws on invalid time zone identifiers', () => {
      expect(() => {
        ChronoFlux.civil.evaluate(ChronoFlux.now(), 'Invalid/TimeZone_Zone');
      }).toThrow(RangeError);

      expect(() => {
        ChronoFlux.civil.resolve({
          year: 2026,
          month: 1,
          day: 1,
          timeZoneId: 'Invalid/NonExistent_Zone',
        });
      }).toThrow(RangeError);

      expect(() => {
        ChronoFlux.civil.evaluate(ChronoFlux.now(), '');
      }).toThrow(TypeError);
    });

    it('throws on invalid disambiguation policy or out of bounds fields', () => {
      expect(() => {
        ChronoFlux.civil.resolve({
          year: 2026,
          month: 1,
          day: 1,
          timeZoneId: 'UTC',
          // @ts-expect-error Invalid policy
          disambiguation: 'invalid_policy',
        });
      }).toThrow(TypeError);

      expect(() => {
        ChronoFlux.civil.resolve({
          year: 2026,
          month: 13,
          day: 1,
          timeZoneId: 'UTC',
        });
      }).toThrow(RangeError);

      expect(() => {
        ChronoFlux.civil.resolve({
          year: 2026,
          month: 2,
          day: 30, // 2026 is not leap year
          timeZoneId: 'UTC',
        });
      }).toThrow(RangeError);
    });

    it('throws TypeError when Place instance has no timeZoneId and no provider registered (no silent UTC fallback)', () => {
      const placeWithoutTz = ChronoFlux.place({ latitude: 10, longitude: 20 });
      expect(() => {
        ChronoFlux.civil.evaluate(ChronoFlux.instant('2026-05-01T12:00:00Z'), placeWithoutTz);
      }).toThrow(TypeError);

      const placeWithTz = ChronoFlux.place({ latitude: 10, longitude: 20, timeZoneId: 'Asia/Tokyo' });
      const civilTokyo = ChronoFlux.civil.evaluate(ChronoFlux.instant('2026-05-01T12:00:00Z'), placeWithTz);
      expect(civilTokyo.timeZoneId).toBe('Asia/Tokyo');
      expect(civilTokyo.utcOffsetMinutes).toBe(540);
    });

    it('resolves Place without timeZoneId when pluggable TimeZoneLookupProvider is registered', () => {
      const mockProvider = {
        lookup(lat: number, lon: number): string | null {
          if (lat === 10 && lon === 20) {
            return 'Africa/Lagos';
          }
          return null;
        },
      };

      ChronoFlux.civil.registerTimeZoneLookupProvider(mockProvider);
      try {
        const placeWithoutTz = ChronoFlux.place({ latitude: 10, longitude: 20 });
        const civil = ChronoFlux.civil.evaluate(ChronoFlux.instant('2026-05-01T12:00:00Z'), placeWithoutTz);
        expect(civil.timeZoneId).toBe('Africa/Lagos');
        expect(civil.utcOffsetMinutes).toBe(60);

        // Place at unmapped coordinates still throws TypeError
        const unmapped = ChronoFlux.place({ latitude: 0, longitude: 0 });
        expect(() => {
          ChronoFlux.civil.evaluate(ChronoFlux.instant('2026-05-01T12:00:00Z'), unmapped);
        }).toThrow(TypeError);
      } finally {
        ChronoFlux.civil.registerTimeZoneLookupProvider(null);
      }
    });

    it('exposes civil time runtime provenance with tz version', () => {
      const prov = ChronoFlux.civil.getProvenance();
      expect(prov.runtime).toBeDefined();
      expect(prov.tzVersion).toBeDefined();
      expect(prov.icuVersion).toBeDefined();
    });

    it('exposes model metadata and disambiguate alias', () => {
      expect(ChronoFlux.civil.model.metadata.name).toContain('Civil');
      expect(ChronoFlux.civil.disambiguate).toBe(ChronoFlux.civil.resolve);
    });
  });

  describe('Pre-1970 Negative Epoch & 2-Digit Year Correctness', () => {
    it('evaluates negative epoch nanoseconds without off-by-one millisecond or year errors', () => {
      // 1 nanosecond before Unix epoch (1969-12-31T23:59:59.999999999Z)
      const instantMinus1Ns = ChronoFlux.instant(-1n);
      const civilMinus1 = ChronoFlux.civil.evaluate(instantMinus1Ns, 'UTC');

      expect(civilMinus1.year).toBe(1969);
      expect(civilMinus1.month).toBe(12);
      expect(civilMinus1.day).toBe(31);
      expect(civilMinus1.hour).toBe(23);
      expect(civilMinus1.minute).toBe(59);
      expect(civilMinus1.second).toBe(59);
      expect(civilMinus1.millisecond).toBe(999);
      expect(civilMinus1.nanosecond).toBe(999999);

      // Resolves and round-trips exactly
      const resolved = ChronoFlux.civil.resolve({
        year: 1969,
        month: 12,
        day: 31,
        hour: 23,
        minute: 59,
        second: 59,
        millisecond: 999,
        nanosecond: 999000,
        timeZoneId: 'UTC',
      });
      expect(resolved.epochNanoseconds).toBe(-1000n);

      const roundTrip = ChronoFlux.civil.evaluate(resolved, 'UTC');
      expect(roundTrip.year).toBe(1969);
      expect(roundTrip.month).toBe(12);
      expect(roundTrip.day).toBe(31);
      expect(roundTrip.hour).toBe(23);
      expect(roundTrip.minute).toBe(59);
      expect(roundTrip.second).toBe(59);
      expect(roundTrip.millisecond).toBe(999);
      expect(roundTrip.nanosecond).toBe(999000);
    });

    it('correctly resolves 2-digit years (0-99) without standard Date.UTC 1900-offset corruption', () => {
      // Year 26 CE must resolve to 0026, not 1926
      const resolvedYear26 = ChronoFlux.civil.resolve({
        year: 26,
        month: 6,
        day: 15,
        hour: 12,
        timeZoneId: 'UTC',
      });
      expect(resolvedYear26.toISOString()).toBe('0026-06-15T12:00:00.000Z');

      // Year 0 CE (1 BCE)
      const resolvedYear0 = ChronoFlux.civil.resolve({
        year: 0,
        month: 1,
        day: 1,
        timeZoneId: 'UTC',
      });
      expect(resolvedYear0.toISOString()).toBe('0000-01-01T00:00:00.000Z');

      // Fallback pure Intl mode without Temporal
      const globalObj = globalThis as Record<string, unknown>;
      const originalTemporal = globalObj['Temporal'];
      try {
        delete globalObj['Temporal'];

        const fallbackYear26 = ChronoFlux.civil.resolve({
          year: 26,
          month: 6,
          day: 15,
          hour: 12,
          timeZoneId: 'UTC',
        });
        expect(fallbackYear26.toISOString()).toBe('0026-06-15T12:00:00.000Z');
      } finally {
        globalObj['Temporal'] = originalTemporal;
      }
    });

    it('handles Southern Hemisphere DST spring-forward and fall-back disambiguation in Australia/Sydney', () => {
      // Sydney spring forward: 2026-10-04, 02:00 -> 03:00 (02:30 skipped)
      expect(() => {
        ChronoFlux.civil.resolve({
          year: 2026,
          month: 10,
          day: 4,
          hour: 2,
          minute: 30,
          timeZoneId: 'Australia/Sydney',
          disambiguation: 'reject',
        });
      }).toThrow(RangeError);

      const sydneySpringLater = ChronoFlux.civil.resolve({
        year: 2026,
        month: 10,
        day: 4,
        hour: 2,
        minute: 30,
        timeZoneId: 'Australia/Sydney',
        disambiguation: 'later',
      });
      // 03:30 AEDT (+11h) => 16:30 UTC previous day
      expect(sydneySpringLater.toISOString()).toBe('2026-10-03T16:30:00.000Z');

      const sydneySpringEarlier = ChronoFlux.civil.resolve({
        year: 2026,
        month: 10,
        day: 4,
        hour: 2,
        minute: 30,
        timeZoneId: 'Australia/Sydney',
        disambiguation: 'earlier',
      });
      // 01:30 AEST (+10h) => 15:30 UTC previous day
      expect(sydneySpringEarlier.toISOString()).toBe('2026-10-03T15:30:00.000Z');

      // Sydney fall back: 2026-04-05, 02:59 -> 02:00 (02:30 repeated)
      const sydneyFallEarlier = ChronoFlux.civil.resolve({
        year: 2026,
        month: 4,
        day: 5,
        hour: 2,
        minute: 30,
        timeZoneId: 'Australia/Sydney',
        disambiguation: 'earlier',
      });
      // 02:30 AEDT (+11h) => 15:30 UTC previous day
      expect(sydneyFallEarlier.toISOString()).toBe('2026-04-04T15:30:00.000Z');

      const sydneyFallLater = ChronoFlux.civil.resolve({
        year: 2026,
        month: 4,
        day: 5,
        hour: 2,
        minute: 30,
        timeZoneId: 'Australia/Sydney',
        disambiguation: 'later',
      });
      // 02:30 AEST (+10h) => 16:30 UTC previous day
      expect(sydneyFallLater.toISOString()).toBe('2026-04-04T16:30:00.000Z');
    });
  });
});
