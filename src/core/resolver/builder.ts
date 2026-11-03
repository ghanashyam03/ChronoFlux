/**
 * @file builder.ts
 * Ergonomic fluent Condition query builder API for ChronoFlux.
 * Produces strictly typed, runtime-frozen, serializable ConditionAST nodes.
 */

import {
  AngleUnit,
  CivilComparisonNode,
  CivilProperty,
  ComparisonOperator,
  ConditionAST,
  formatConditionAST,
  LogicalConditionNode,
  SolarComparisonNode,
  SolarProperty,
  TimeUnit,
  validateConditionAST,
} from './ast.js';

export interface SolarAngleBuilder {
  gt(val: number, unit?: AngleUnit): SolarComparisonNode;
  gte(val: number, unit?: AngleUnit): SolarComparisonNode;
  lt(val: number, unit?: AngleUnit): SolarComparisonNode;
  lte(val: number, unit?: AngleUnit): SolarComparisonNode;
  eq(val: number, unit?: AngleUnit): SolarComparisonNode;
  neq(val: number, unit?: AngleUnit): SolarComparisonNode;
  between(min: number, max: number, unit?: AngleUnit): SolarComparisonNode;
  in(vals: readonly number[], unit?: AngleUnit): SolarComparisonNode;
}

export interface CategoricalBuilder<T extends string> {
  eq(val: T): SolarComparisonNode;
  neq(val: T): SolarComparisonNode;
  in(vals: readonly T[]): SolarComparisonNode;
}

export interface BooleanBuilder<D extends 'solar' | 'civil'> {
  eq(val: boolean): D extends 'solar' ? SolarComparisonNode : CivilComparisonNode;
  neq(val: boolean): D extends 'solar' ? SolarComparisonNode : CivilComparisonNode;
}

export interface CivilNumericBuilder {
  gt(val: number, unit?: TimeUnit): CivilComparisonNode;
  gte(val: number, unit?: TimeUnit): CivilComparisonNode;
  lt(val: number, unit?: TimeUnit): CivilComparisonNode;
  lte(val: number, unit?: TimeUnit): CivilComparisonNode;
  eq(val: number, unit?: TimeUnit): CivilComparisonNode;
  neq(val: number, unit?: TimeUnit): CivilComparisonNode;
  between(min: number, max: number, unit?: TimeUnit): CivilComparisonNode;
  in(vals: readonly number[], unit?: TimeUnit): CivilComparisonNode;
}

function createAngleBuilder(property: SolarProperty): SolarAngleBuilder {
  function makeNode(
    operator: ComparisonOperator,
    value: number | readonly number[],
    unit: AngleUnit = 'deg'
  ): SolarComparisonNode {
    if (unit !== 'deg' && unit !== 'rad') {
      throw new TypeError(`Invalid angle unit: ${unit}. Expected 'deg' or 'rad'.`);
    }
    return Object.freeze({
      kind: 'comparison' as const,
      domain: 'solar' as const,
      property,
      operator,
      value: Array.isArray(value) ? Object.freeze(value.slice()) : value,
      unit,
    });
  }

  return Object.freeze({
    gt: (val: number, unit?: AngleUnit) => makeNode('gt', val, unit),
    gte: (val: number, unit?: AngleUnit) => makeNode('gte', val, unit),
    lt: (val: number, unit?: AngleUnit) => makeNode('lt', val, unit),
    lte: (val: number, unit?: AngleUnit) => makeNode('lte', val, unit),
    eq: (val: number, unit?: AngleUnit) => makeNode('eq', val, unit),
    neq: (val: number, unit?: AngleUnit) => makeNode('neq', val, unit),
    between: (min: number, max: number, unit?: AngleUnit) => {
      if (typeof min !== 'number' || typeof max !== 'number' || !Number.isFinite(min) || !Number.isFinite(max)) {
        throw new TypeError(`between() requires finite numbers for min and max, received: min=${min}, max=${max}`);
      }
      return makeNode('between', [min, max], unit);
    },
    in: (vals: readonly number[], unit?: AngleUnit) => {
      if (!Array.isArray(vals) || vals.length === 0) {
        throw new TypeError('in() requires a non-empty array of numbers');
      }
      return makeNode('in', vals, unit);
    },
  });
}

function createCategoricalBuilder<T extends string>(
  domain: 'solar',
  property: SolarProperty
): CategoricalBuilder<T> {
  function makeNode(operator: ComparisonOperator, value: T | readonly T[]): SolarComparisonNode {
    return Object.freeze({
      kind: 'comparison' as const,
      domain,
      property,
      operator,
      value: Array.isArray(value) ? Object.freeze(value.slice()) : value,
    });
  }

  return Object.freeze({
    eq: (val: T) => makeNode('eq', val),
    neq: (val: T) => makeNode('neq', val),
    in: (vals: readonly T[]) => {
      if (!Array.isArray(vals) || vals.length === 0) {
        throw new TypeError('in() requires a non-empty array of strings');
      }
      return makeNode('in', vals);
    },
  });
}

function createBooleanBuilder<D extends 'solar' | 'civil'>(
  domain: D,
  property: D extends 'solar' ? SolarProperty : CivilProperty
): BooleanBuilder<D> {
  function makeNode(operator: ComparisonOperator, value: boolean): any {
    return Object.freeze({
      kind: 'comparison' as const,
      domain,
      property,
      operator,
      value,
    });
  }

  return Object.freeze({
    eq: (val: boolean) => makeNode('eq', val),
    neq: (val: boolean) => makeNode('neq', val),
  });
}

function createCivilNumericBuilder(property: CivilProperty): CivilNumericBuilder {
  function makeNode(
    operator: ComparisonOperator,
    value: number | readonly number[],
    unit?: TimeUnit
  ): CivilComparisonNode {
    if (unit !== undefined && unit !== 'hours' && unit !== 'minutes' && unit !== 'seconds') {
      throw new TypeError(`Invalid civil time unit: ${unit}. Expected 'hours', 'minutes', or 'seconds'.`);
    }
    return Object.freeze({
      kind: 'comparison' as const,
      domain: 'civil' as const,
      property,
      operator,
      value: Array.isArray(value) ? Object.freeze(value.slice()) : value,
      ...(unit !== undefined ? { unit } : {}),
    });
  }

  return Object.freeze({
    gt: (val: number, unit?: TimeUnit) => makeNode('gt', val, unit),
    gte: (val: number, unit?: TimeUnit) => makeNode('gte', val, unit),
    lt: (val: number, unit?: TimeUnit) => makeNode('lt', val, unit),
    lte: (val: number, unit?: TimeUnit) => makeNode('lte', val, unit),
    eq: (val: number, unit?: TimeUnit) => makeNode('eq', val, unit),
    neq: (val: number, unit?: TimeUnit) => makeNode('neq', val, unit),
    between: (min: number, max: number, unit?: TimeUnit) => {
      if (typeof min !== 'number' || typeof max !== 'number' || !Number.isFinite(min) || !Number.isFinite(max)) {
        throw new TypeError(`between() requires finite numbers for min and max, received: min=${min}, max=${max}`);
      }
      return makeNode('between', [min, max], unit);
    },
    in: (vals: readonly number[], unit?: TimeUnit) => {
      if (!Array.isArray(vals) || vals.length === 0) {
        throw new TypeError('in() requires a non-empty array of numbers');
      }
      return makeNode('in', vals, unit);
    },
  });
}

/**
 * Fluent query builder for declarative temporal conditions.
 */
export const Conditions = Object.freeze({
  /**
   * Astronomical Solar Model conditions.
   */
  solar: Object.freeze({
    elevation: createAngleBuilder('elevation'),
    azimuth: createAngleBuilder('azimuth'),
    zenith: createAngleBuilder('zenith'),
    phase: createCategoricalBuilder<'day' | 'civil_twilight' | 'nautical_twilight' | 'astronomical_twilight' | 'night'>(
      'solar',
      'phase'
    ),
    polarRegime: createCategoricalBuilder<'none' | 'polar_day' | 'polar_night'>('solar', 'polarRegime'),
    isDirectSunlight: createBooleanBuilder('solar', 'isDirectSunlight'),
  }),

  /**
   * Civil Calendar and IANA Timezone conditions.
   */
  civil: Object.freeze({
    hour: createCivilNumericBuilder('hour'),
    minute: createCivilNumericBuilder('minute'),
    second: createCivilNumericBuilder('second'),
    dayOfWeek: createCivilNumericBuilder('dayOfWeek'),
    day: createCivilNumericBuilder('day'),
    month: createCivilNumericBuilder('month'),
    year: createCivilNumericBuilder('year'),
    isDaylightSaving: createBooleanBuilder('civil', 'isDaylightSaving'),
  }),

  /**
   * Logical conjunction: resolves intervals where ALL operands hold simultaneously.
   */
  and(...operands: (ConditionAST | readonly ConditionAST[])[]): LogicalConditionNode {
    const flattened = operands.length === 1 && Array.isArray(operands[0])
      ? (operands[0] as readonly ConditionAST[])
      : (operands as readonly ConditionAST[]);

    if (flattened.length === 0) {
      throw new TypeError('Conditions.and() requires at least one operand');
    }
    for (const op of flattened) {
      validateConditionAST(op);
    }

    return Object.freeze({
      kind: 'logical' as const,
      operator: 'and' as const,
      operands: Object.freeze(flattened.slice()),
    });
  },

  /**
   * Logical disjunction: resolves intervals where AT LEAST ONE operand holds.
   */
  or(...operands: (ConditionAST | readonly ConditionAST[])[]): LogicalConditionNode {
    const flattened = operands.length === 1 && Array.isArray(operands[0])
      ? (operands[0] as readonly ConditionAST[])
      : (operands as readonly ConditionAST[]);

    if (flattened.length === 0) {
      throw new TypeError('Conditions.or() requires at least one operand');
    }
    for (const op of flattened) {
      validateConditionAST(op);
    }

    return Object.freeze({
      kind: 'logical' as const,
      operator: 'or' as const,
      operands: Object.freeze(flattened.slice()),
    });
  },

  /**
   * Logical negation: resolves the complement of the operand within the search window.
   */
  not(operand: ConditionAST): LogicalConditionNode {
    validateConditionAST(operand);
    return Object.freeze({
      kind: 'logical' as const,
      operator: 'not' as const,
      operands: Object.freeze([operand]),
    });
  },

  /**
   * Returns a human-readable query string for any ConditionAST.
   */
  toString(ast: ConditionAST): string {
    return formatConditionAST(ast);
  },
});
