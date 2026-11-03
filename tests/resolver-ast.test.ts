/**
 * @file resolver-ast.test.ts
 * Test suite for Condition AST definitions, fluent Conditions builder, serialization, and validation.
 */

import { describe, expect, it } from 'vitest';
import { ChronoFlux, Conditions, parseConditionAST, validateConditionAST } from '../src/index.js';

describe('Phase 3A — Condition AST and Fluent Builder', () => {
  describe('1. Fluent Conditions Builder API', () => {
    it('constructs solar angle conditions with default unit "deg"', () => {
      const gte10 = Conditions.solar.elevation.gte(10);
      expect(gte10).toEqual({
        kind: 'comparison',
        domain: 'solar',
        property: 'elevation',
        operator: 'gte',
        value: 10,
        unit: 'deg',
      });
      expect(Object.isFrozen(gte10)).toBe(true);
    });

    it('constructs solar angle conditions with explicit "rad" unit', () => {
      const radNode = Conditions.solar.elevation.gte(0.1745, 'rad');
      expect(radNode).toEqual({
        kind: 'comparison',
        domain: 'solar',
        property: 'elevation',
        operator: 'gte',
        value: 0.1745,
        unit: 'rad',
      });
    });

    it('constructs solar angle range conditions with between()', () => {
      const betweenNode = Conditions.solar.elevation.between(10, 45);
      expect(betweenNode).toEqual({
        kind: 'comparison',
        domain: 'solar',
        property: 'elevation',
        operator: 'between',
        value: [10, 45],
        unit: 'deg',
      });
      expect(Object.isFrozen(betweenNode.value)).toBe(true);
    });

    it('constructs solar categorical and boolean conditions', () => {
      const direct = Conditions.solar.isDirectSunlight.eq(true);
      expect(direct).toEqual({
        kind: 'comparison',
        domain: 'solar',
        property: 'isDirectSunlight',
        operator: 'eq',
        value: true,
      });

      const twilight = Conditions.solar.phase.eq('civil_twilight');
      expect(twilight).toEqual({
        kind: 'comparison',
        domain: 'solar',
        property: 'phase',
        operator: 'eq',
        value: 'civil_twilight',
      });

      const polar = Conditions.solar.polarRegime.eq('polar_day');
      expect(polar).toEqual({
        kind: 'comparison',
        domain: 'solar',
        property: 'polarRegime',
        operator: 'eq',
        value: 'polar_day',
      });
    });

    it('constructs civil time conditions', () => {
      const hours = Conditions.civil.hour.between(9, 17);
      expect(hours).toEqual({
        kind: 'comparison',
        domain: 'civil',
        property: 'hour',
        operator: 'between',
        value: [9, 17],
      });

      const weekdays = Conditions.civil.dayOfWeek.between(1, 5);
      expect(weekdays).toEqual({
        kind: 'comparison',
        domain: 'civil',
        property: 'dayOfWeek',
        operator: 'between',
        value: [1, 5],
      });

      const dst = Conditions.civil.isDaylightSaving.eq(true);
      expect(dst).toEqual({
        kind: 'comparison',
        domain: 'civil',
        property: 'isDaylightSaving',
        operator: 'eq',
        value: true,
      });

      // Unit preservation on civil builder
      const hoursWithUnit = Conditions.civil.hour.between(9, 17, 'hours');
      expect(hoursWithUnit).toEqual({
        kind: 'comparison',
        domain: 'civil',
        property: 'hour',
        operator: 'between',
        value: [9, 17],
        unit: 'hours',
      });

      const minutesWithUnit = Conditions.civil.minute.gte(30, 'minutes');
      expect(minutesWithUnit.unit).toBe('minutes');

      expect(() => (Conditions.civil.hour as any).between(9, 17, 'invalid')).toThrow(TypeError);
    });

    it('constructs logical compositions (AND, OR, NOT)', () => {
      const c1 = Conditions.solar.elevation.gte(10);
      const c2 = Conditions.civil.hour.between(9, 17);
      const c3 = Conditions.civil.dayOfWeek.between(1, 5);

      const andNode = Conditions.and(c1, c2, c3);
      expect(andNode.kind).toBe('logical');
      expect(andNode.operator).toBe('and');
      expect(andNode.operands.length).toBe(3);
      expect(Object.isFrozen(andNode)).toBe(true);
      expect(Object.isFrozen(andNode.operands)).toBe(true);

      const orNode = Conditions.or(c1, c2);
      expect(orNode.operator).toBe('or');
      expect(orNode.operands.length).toBe(2);

      const notNode = Conditions.not(c2);
      expect(notNode.operator).toBe('not');
      expect(notNode.operands.length).toBe(1);
      expect(notNode.operands[0]).toBe(c2);
    });

    it('accepts an array of operands for AND / OR', () => {
      const c1 = Conditions.solar.elevation.gte(10);
      const c2 = Conditions.civil.hour.between(9, 17);
      const andArr = Conditions.and([c1, c2]);
      expect(andArr.operands.length).toBe(2);
    });

    it('exposes Conditions builder on ChronoFlux.conditions facade', () => {
      expect(ChronoFlux.conditions).toBe(Conditions);
      expect(typeof ChronoFlux.conditions.solar.elevation.gte).toBe('function');
      expect(typeof ChronoFlux.conditions.civil.hour.between).toBe('function');
    });
  });

  describe('2. Serialization & Validation', () => {
    it('is pure JSON serializable and reconstructible via parseConditionAST', () => {
      const ast = Conditions.and(
        Conditions.solar.elevation.gte(10),
        Conditions.civil.hour.between(9, 17),
        Conditions.not(Conditions.civil.dayOfWeek.eq(7))
      );

      const serialized = JSON.stringify(ast);
      expect(typeof serialized).toBe('string');

      const parsed = parseConditionAST(serialized);
      expect(parsed).toEqual(ast);
      expect(Object.isFrozen(parsed)).toBe(true);
    });

    it('formats human-readable query strings via Conditions.toString()', () => {
      const ast = Conditions.and(
        Conditions.solar.elevation.gte(10),
        Conditions.civil.hour.between(9, 17)
      );

      const str = Conditions.toString(ast);
      expect(str).toContain('solar.elevation >= 10°');
      expect(str).toContain('civil.hour between 9 and 17');
      expect(str).toContain('AND');
    });

    it('validates AST structure and throws on invalid inputs', () => {
      expect(() => validateConditionAST(null)).toThrow(TypeError);
      expect(() => validateConditionAST({ kind: 'unknown' })).toThrow(TypeError);
      expect(() => validateConditionAST({ kind: 'comparison', domain: 'solar', property: 'invalid' })).toThrow(TypeError);
      expect(() => Conditions.and()).toThrow(TypeError);
      expect(() => Conditions.not(null as any)).toThrow(TypeError);
      expect(() => Conditions.solar.elevation.between(NaN, 10)).toThrow(TypeError);
      expect(() => Conditions.civil.hour.in([])).toThrow(TypeError);
    });

    it('rejects non-finite numbers (NaN, Infinity, -Infinity) with TypeError', () => {
      expect(() => Conditions.civil.hour.eq(NaN)).toThrow(TypeError);
      expect(() => Conditions.civil.hour.eq(Infinity)).toThrow(TypeError);
      expect(() => Conditions.civil.hour.eq(-Infinity)).toThrow(TypeError);
      expect(() => Conditions.solar.elevation.gte(Infinity)).toThrow(TypeError);
      expect(() => Conditions.solar.elevation.gte(-Infinity)).toThrow(TypeError);
      expect(() => Conditions.solar.elevation.between(10, NaN)).toThrow(TypeError);
      expect(() =>
        validateConditionAST({
          kind: 'comparison',
          domain: 'solar',
          property: 'elevation',
          operator: 'gte',
          value: NaN,
          unit: 'deg',
        })
      ).toThrow(TypeError);
    });

    it('rejects out-of-range civil values with RangeError', () => {
      // hour in [0, 24]
      expect(() => Conditions.civil.hour.eq(-1)).toThrow(RangeError);
      expect(() => Conditions.civil.hour.eq(25)).toThrow(RangeError);
      expect(() => Conditions.civil.hour.between(-1, 10)).toThrow(RangeError);
      expect(() => Conditions.civil.hour.between(9, 25)).toThrow(RangeError);

      // minute in [0, 60]
      expect(() => Conditions.civil.minute.eq(-1)).toThrow(RangeError);
      expect(() => Conditions.civil.minute.eq(61)).toThrow(RangeError);
      expect(() => Conditions.civil.minute.between(0, 61)).toThrow(RangeError);

      // second in [0, 60]
      expect(() => Conditions.civil.second.eq(-1)).toThrow(RangeError);
      expect(() => Conditions.civil.second.eq(61)).toThrow(RangeError);
      expect(() => Conditions.civil.second.between(0, 61)).toThrow(RangeError);

      // day in [1, 31]
      expect(() => Conditions.civil.day.eq(0)).toThrow(RangeError);
      expect(() => Conditions.civil.day.eq(32)).toThrow(RangeError);

      // month in [1, 12]
      expect(() => Conditions.civil.month.eq(0)).toThrow(RangeError);
      expect(() => Conditions.civil.month.eq(13)).toThrow(RangeError);

      // dayOfWeek in [1, 7]
      expect(() => Conditions.civil.dayOfWeek.eq(0)).toThrow(RangeError);
      expect(() => Conditions.civil.dayOfWeek.eq(8)).toThrow(RangeError);
    });

    it('validates property unit compatibility and rejects invalid units with TypeError', () => {
      // Incompatible units
      expect(() => Conditions.civil.hour.between(9, 17, 'minutes' as any)).toThrow(TypeError);
      expect(() => Conditions.civil.minute.eq(15, 'hours' as any)).toThrow(TypeError);
      expect(() => Conditions.civil.second.eq(30, 'deg' as any)).toThrow(TypeError);
      expect(() => Conditions.civil.dayOfWeek.eq(1, 'hours' as any)).toThrow(TypeError);
      expect(() => Conditions.solar.elevation.gte(10, 'hours' as any)).toThrow(TypeError);
      expect(() => Conditions.solar.azimuth.gte(180, 'seconds' as any)).toThrow(TypeError);

      // Compatible units
      expect(Conditions.civil.hour.between(9, 17, 'hours')).toBeDefined();
      expect(Conditions.civil.minute.eq(15, 'minutes')).toBeDefined();
      expect(Conditions.civil.second.eq(30, 'seconds')).toBeDefined();
      expect(Conditions.solar.elevation.gte(10, 'deg')).toBeDefined();
      expect(Conditions.solar.elevation.gte(0.1745, 'rad')).toBeDefined();
    });

    it('enforces strict property-operator compatibility matrix', () => {
      // Categorical / boolean properties only accept eq, neq, in
      expect(() =>
        validateConditionAST({
          kind: 'comparison',
          domain: 'solar',
          property: 'phase',
          operator: 'gt',
          value: 'day',
        })
      ).toThrow(TypeError);

      expect(() =>
        validateConditionAST({
          kind: 'comparison',
          domain: 'solar',
          property: 'isDirectSunlight',
          operator: 'between',
          value: [0, 1],
        })
      ).toThrow(TypeError);

      expect(() =>
        validateConditionAST({
          kind: 'comparison',
          domain: 'civil',
          property: 'isDaylightSaving',
          operator: 'lt',
          value: true,
        })
      ).toThrow(TypeError);

      // Numeric properties cannot use non-array value for between
      expect(() =>
        validateConditionAST({
          kind: 'comparison',
          domain: 'solar',
          property: 'elevation',
          operator: 'between',
          value: 10 as any,
          unit: 'deg',
        })
      ).toThrow(TypeError);
    });
  });
});
