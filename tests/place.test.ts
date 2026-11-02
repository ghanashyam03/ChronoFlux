import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { Place } from '../src/index.js';

describe('Place Primitive', () => {
  describe('Valid Geodetic Coordinates & Creation', () => {
    it('creates place with valid latitude and longitude', () => {
      const p = Place.create({ latitude: 37.7749, longitude: -122.4194 });
      expect(p.latitude).toBe(37.7749);
      expect(p.longitude).toBe(-122.4194);
      expect(p.elevationMeters).toBeUndefined();
      expect(p.timeZoneId).toBeUndefined();
    });

    it('creates place with optional elevation in meters', () => {
      // Mount Everest (+8848m)
      const everest = Place.create({ latitude: 27.9881, longitude: 86.925, elevationMeters: 8848 });
      expect(everest.elevationMeters).toBe(8848);

      // Dead Sea (-430m, below sea level)
      const deadSea = Place.create({ latitude: 31.5, longitude: 35.5, elevationMeters: -430 });
      expect(deadSea.elevationMeters).toBe(-430);
    });

    it('creates place with contextual timeZoneId', () => {
      const chennai = Place.create({
        latitude: 13.0827,
        longitude: 80.2707,
        timeZoneId: 'Asia/Kolkata',
      });
      expect(chennai.timeZoneId).toBe('Asia/Kolkata');
    });

    it('accepts exact boundary coordinates', () => {
      expect(() => Place.create({ latitude: 90, longitude: 180 })).not.toThrow();
      expect(() => Place.create({ latitude: -90, longitude: -180 })).not.toThrow();
      expect(() => Place.create({ latitude: 0, longitude: 0 })).not.toThrow();
    });
  });

  describe('Validation & Error Handling', () => {
    it('throws on non-object options', () => {
      expect(() => new (Place as any)(null)).toThrow(TypeError);
      expect(() => new (Place as any)(undefined)).toThrow(TypeError);
    });

    it('throws RangeError on out-of-bounds latitude', () => {
      expect(() => Place.create({ latitude: 90.0001, longitude: 0 })).toThrow(RangeError);
      expect(() => Place.create({ latitude: -90.0001, longitude: 0 })).toThrow(RangeError);
    });

    it('throws TypeError on non-finite or NaN latitude', () => {
      expect(() => Place.create({ latitude: NaN, longitude: 0 })).toThrow(TypeError);
      expect(() => Place.create({ latitude: Infinity, longitude: 0 })).toThrow(TypeError);
      expect(() => Place.create({ latitude: -Infinity, longitude: 0 })).toThrow(TypeError);
      expect(() => Place.create({ latitude: '37' as any, longitude: 0 })).toThrow(TypeError);
    });

    it('throws RangeError on out-of-bounds longitude', () => {
      expect(() => Place.create({ latitude: 0, longitude: 180.0001 })).toThrow(RangeError);
      expect(() => Place.create({ latitude: 0, longitude: -180.0001 })).toThrow(RangeError);
    });

    it('throws TypeError on non-finite or NaN longitude', () => {
      expect(() => Place.create({ latitude: 0, longitude: NaN })).toThrow(TypeError);
      expect(() => Place.create({ latitude: 0, longitude: Infinity })).toThrow(TypeError);
    });

    it('throws TypeError on non-finite or NaN elevation', () => {
      expect(() => Place.create({ latitude: 0, longitude: 0, elevationMeters: NaN })).toThrow(TypeError);
      expect(() => Place.create({ latitude: 0, longitude: 0, elevationMeters: Infinity })).toThrow(TypeError);
    });

    it('throws TypeError on empty or whitespace timeZoneId', () => {
      expect(() => Place.create({ latitude: 0, longitude: 0, timeZoneId: '' })).toThrow(TypeError);
      expect(() => Place.create({ latitude: 0, longitude: 0, timeZoneId: '   ' })).toThrow(TypeError);
    });
  });

  describe('Equality & Serialization', () => {
    it('compares equality accurately', () => {
      const p1 = Place.create({ latitude: 51.5074, longitude: -0.1278, elevationMeters: 25, timeZoneId: 'Europe/London' });
      const p2 = Place.create({ latitude: 51.5074, longitude: -0.1278, elevationMeters: 25, timeZoneId: 'Europe/London' });
      const p3 = Place.create({ latitude: 51.5074, longitude: -0.1278, elevationMeters: 50, timeZoneId: 'Europe/London' });
      const p4 = Place.create({ latitude: 51.5074, longitude: -0.1278, elevationMeters: 25, timeZoneId: 'UTC' });

      expect(p1.equals(p2)).toBe(true);
      expect(p1.equals(p3)).toBe(false);
      expect(p1.equals(p4)).toBe(false); // Different contextual timezone
      expect(p1.equals(null)).toBe(false);
      expect(p1.equals(undefined)).toBe(false);
      expect(p1.equals({})).toBe(false);

      // Geographic coordinate equivalence (ignoring contextual timeZoneId)
      expect(p1.hasSameCoordinates(p4)).toBe(true);
      expect(p1.hasSameCoordinates(p3)).toBe(false);
      expect(p1.hasSameCoordinates(null)).toBe(false);
      expect(p1.hasSameCoordinates(undefined)).toBe(false);
    });

    it('serializes to and from JSON', () => {
      const original = Place.create({
        latitude: 35.6762,
        longitude: 139.6503,
        elevationMeters: 40,
        timeZoneId: 'Asia/Tokyo',
      });

      const json = original.toJSON();
      expect(json.latitude).toBe(35.6762);
      expect(json.longitude).toBe(139.6503);
      expect(json.elevationMeters).toBe(40);
      expect(json.timeZoneId).toBe('Asia/Tokyo');

      const restored = Place.fromJSON(json);
      expect(restored.equals(original)).toBe(true);
    });

    it('produces informative string representation', () => {
      const p = Place.create({ latitude: 10.5, longitude: 20.5, elevationMeters: 100, timeZoneId: 'UTC' });
      expect(p.toString()).toContain('Place(10.500000, 20.500000 alt=100m tz=UTC)');

      const pBasic = Place.create({ latitude: 0, longitude: 0 });
      expect(pBasic.toString()).toBe('Place(0.000000, 0.000000)');
    });
  });

  describe('Property-Based Coordinate Checks', () => {
    it('accepts all valid latitudes [-90, 90] and longitudes [-180, 180]', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -90, max: 90, noNaN: true }),
          fc.double({ min: -180, max: 180, noNaN: true }),
          (lat, lon) => {
            const p = Place.create({ latitude: lat, longitude: lon });
            return p.latitude === lat && p.longitude === lon;
          }
        )
      );
    });
  });
});
