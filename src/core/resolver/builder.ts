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

/**
 * Fluent builder for solar angle properties (elevation, azimuth, zenith).
 */
export interface SolarAngleBuilder {
  /** Strictly greater than (> val). */
  gt(val: number, unit?: AngleUnit): SolarComparisonNode;
  /** Greater than or equal to (>= val). */
  gte(val: number, unit?: AngleUnit): SolarComparisonNode;
  /** Strictly less than (< val). */
  lt(val: number, unit?: AngleUnit): SolarComparisonNode;
  /** Less than or equal to (<= val). */
  lte(val: number, unit?: AngleUnit): SolarComparisonNode;
  /** Exact equality (== val). Note: Continuous measure-zero points evaluate to empty set. */
  eq(val: number, unit?: AngleUnit): SolarComparisonNode;
  /** Inequality (!= val). Evaluates to full window complement. */
  neq(val: number, unit?: AngleUnit): SolarComparisonNode;
  /** Half-open continuous range between min and max (inclusive min, exclusive max: [min, max)). */
  between(min: number, max: number, unit?: AngleUnit): SolarComparisonNode;
  /** Set membership: matches any angle in vals. */
  in(vals: readonly number[], unit?: AngleUnit): SolarComparisonNode;
}

/**
 * Fluent builder for categorical properties (phase, polarRegime).
 */
export interface CategoricalBuilder<T extends string> {
  /** Matches exact categorical value. */
  eq(val: T): SolarComparisonNode;
  /** Matches any categorical value other than val. */
  neq(val: T): SolarComparisonNode;
  /** Matches any of the specified categorical values. */
  in(vals: readonly T[]): SolarComparisonNode;
}

/**
 * Fluent builder for boolean properties (isDirectSunlight, isDaylightSaving).
 */
export interface BooleanBuilder<D extends 'solar' | 'civil'> {
  /** Matches specified boolean value. */
  eq(val: boolean): D extends 'solar' ? SolarComparisonNode : CivilComparisonNode;
  /** Matches opposite boolean value. */
  neq(val: boolean): D extends 'solar' ? SolarComparisonNode : CivilComparisonNode;
}

/**
 * Fluent builder for discrete civil properties (hour, minute, second, dayOfWeek, day, month, year).
 */
export interface CivilNumericBuilder {
  /** Strictly greater than (> val). */
  gt(val: number, unit?: TimeUnit): CivilComparisonNode;
  /** Greater than or equal to (>= val). */
  gte(val: number, unit?: TimeUnit): CivilComparisonNode;
  /** Strictly less than (< val). */
  lt(val: number, unit?: TimeUnit): CivilComparisonNode;
  /** Less than or equal to (<= val). */
  lte(val: number, unit?: TimeUnit): CivilComparisonNode;
  /** Exact integer equality (== val). */
  eq(val: number, unit?: TimeUnit): CivilComparisonNode;
  /** Inequality (!= val). */
  neq(val: number, unit?: TimeUnit): CivilComparisonNode;
  /** Half-open range [min, max). For hours: between(9, 17) corresponds to 09:00 to 17:00. */
  between(min: number, max: number, unit?: TimeUnit): CivilComparisonNode;
  /** Discrete set membership: matches any integer in vals. */
  in(vals: readonly number[], unit?: TimeUnit): CivilComparisonNode;
}

function createAngleBuilder(property: SolarProperty): SolarAngleBuilder {
  function makeNode(
    operator: ComparisonOperator,
    value: number | readonly number[],
    unit: AngleUnit = 'deg'
  ): SolarComparisonNode {
    const node: SolarComparisonNode = Object.freeze({
      kind: 'comparison' as const,
      domain: 'solar' as const,
      property,
      operator,
      value: Array.isArray(value) ? Object.freeze(value.slice()) : value,
      unit,
    });
    validateConditionAST(node);
    return node;
  }

  return Object.freeze({
    gt: (val: number, unit?: AngleUnit) => makeNode('gt', val, unit),
    gte: (val: number, unit?: AngleUnit) => makeNode('gte', val, unit),
    lt: (val: number, unit?: AngleUnit) => makeNode('lt', val, unit),
    lte: (val: number, unit?: AngleUnit) => makeNode('lte', val, unit),
    eq: (val: number, unit?: AngleUnit) => makeNode('eq', val, unit),
    neq: (val: number, unit?: AngleUnit) => makeNode('neq', val, unit),
    between: (min: number, max: number, unit?: AngleUnit) => {
      return makeNode('between', [min, max], unit);
    },
    in: (vals: readonly number[], unit?: AngleUnit) => {
      return makeNode('in', vals, unit);
    },
  });
}

function createCategoricalBuilder<T extends string>(
  domain: 'solar',
  property: SolarProperty
): CategoricalBuilder<T> {
  function makeNode(operator: ComparisonOperator, value: T | readonly T[]): SolarComparisonNode {
    const node: SolarComparisonNode = Object.freeze({
      kind: 'comparison' as const,
      domain,
      property,
      operator,
      value: Array.isArray(value) ? Object.freeze(value.slice()) : value,
    });
    validateConditionAST(node);
    return node;
  }

  return Object.freeze({
    eq: (val: T) => makeNode('eq', val),
    neq: (val: T) => makeNode('neq', val),
    in: (vals: readonly T[]) => {
      return makeNode('in', vals);
    },
  });
}

function createBooleanBuilder<D extends 'solar' | 'civil'>(
  domain: D,
  property: D extends 'solar' ? SolarProperty : CivilProperty
): BooleanBuilder<D> {
  function makeNode(operator: ComparisonOperator, value: boolean): any {
    const node = Object.freeze({
      kind: 'comparison' as const,
      domain,
      property,
      operator,
      value,
    });
    validateConditionAST(node);
    return node;
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
    const node: CivilComparisonNode = Object.freeze({
      kind: 'comparison' as const,
      domain: 'civil' as const,
      property,
      operator,
      value: Array.isArray(value) ? Object.freeze(value.slice()) : value,
      ...(unit !== undefined ? { unit } : {}),
    });
    validateConditionAST(node);
    return node;
  }

  return Object.freeze({
    gt: (val: number, unit?: TimeUnit) => makeNode('gt', val, unit),
    gte: (val: number, unit?: TimeUnit) => makeNode('gte', val, unit),
    lt: (val: number, unit?: TimeUnit) => makeNode('lt', val, unit),
    lte: (val: number, unit?: TimeUnit) => makeNode('lte', val, unit),
    eq: (val: number, unit?: TimeUnit) => makeNode('eq', val, unit),
    neq: (val: number, unit?: TimeUnit) => makeNode('neq', val, unit),
    between: (min: number, max: number, unit?: TimeUnit) => {
      return makeNode('between', [min, max], unit);
    },
    in: (vals: readonly number[], unit?: TimeUnit) => {
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
