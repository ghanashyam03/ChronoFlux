/**
 * @file ast.ts
 * Strongly typed, pure JSON-serializable Condition AST node definitions.
 * Represents declarative temporal queries without executable JavaScript closures.
 */

export type ComparisonOperator =
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'eq'
  | 'neq'
  | 'in'
  | 'between';

export type LogicalOperator = 'and' | 'or' | 'not';

export type ModelDomain = 'solar' | 'civil';

export type SolarProperty =
  | 'elevation'
  | 'azimuth'
  | 'zenith'
  | 'phase'
  | 'polarRegime'
  | 'isDirectSunlight';

export type CivilProperty =
  | 'hour'
  | 'minute'
  | 'second'
  | 'dayOfWeek'
  | 'day'
  | 'month'
  | 'year'
  | 'isDaylightSaving';

export type AngleUnit = 'deg' | 'rad';
export type TimeUnit = 'hours' | 'minutes' | 'seconds';

export interface SolarComparisonNode {
  readonly kind: 'comparison';
  readonly domain: 'solar';
  readonly property: SolarProperty;
  readonly operator: ComparisonOperator;
  readonly value: number | string | boolean | readonly (number | string)[];
  readonly unit?: AngleUnit;
}

export interface CivilComparisonNode {
  readonly kind: 'comparison';
  readonly domain: 'civil';
  readonly property: CivilProperty;
  readonly operator: ComparisonOperator;
  readonly value: number | string | boolean | readonly (number | string)[];
  readonly unit?: TimeUnit;
}

export type AtomicConditionNode = SolarComparisonNode | CivilComparisonNode;

export interface LogicalConditionNode {
  readonly kind: 'logical';
  readonly operator: LogicalOperator;
  readonly operands: readonly ConditionAST[];
}

export type ConditionAST = AtomicConditionNode | LogicalConditionNode;

/**
 * Continuous Scalar Solar Semantics:
 * Isolated single-instant points have measure zero and zero duration. Under TIME 2.0's
 * half-open interval contract [start, end) where start < end, zero-duration instants cannot
 * form valid non-empty intervals.
 *
 * Therefore:
 * - `eq`: Evaluates to `IntervalSet.empty()` (measure zero points have no elapsed duration).
 * - `neq`: Evaluates to the full search window interval set (excluding isolated points of measure zero
 *          preserves the continuous half-open interval topology).
 * - `gt` vs `gte`: On strictly monotonic branches, `gt` and `gte` produce identical half-open
 *          intervals [t*, t_end) because the boundary instant t* where f(t*) = theta is included
 *          by the half-open start-inclusion [t*, ...).
 *
 * Elevation Datum & Horizon Dip Semantics in Twilight Classification:
 * Place.elevationMeters represents orthometric height above mean sea level (MSL / geoid)
 * assuming an unobstructed geometric sea horizon. Geometric horizon dip
 * d_dip = (1.76 / 60) * sqrt(elevationMeters) degrees depresses the optical sunrise/sunset
 * threshold (theta_eff = -0.8333° - d_dip), expanding direct sunlight and the upper boundary
 * of civil twilight. Statutory lower twilight boundaries (civil -6°, nautical -12°, astronomical -18°)
 * remain fixed relative to the geometric horizontal datum.
 *
 * Root Residual vs. Physical Model Uncertainty:
 * Numerical solver residual (|h(t*) - theta| <= 1e-5°) measures algorithmic convergence of root finding.
 * In contrast, physical model uncertainty (+/-0.01° to +/-0.05°) reflects ephemeris approximations and
 * stochastic atmospheric refraction. High numerical solver convergence must never be conflated
 * with physical measurement accuracy.
 */

const CATEGORICAL_PROPS: ReadonlySet<string> = new Set(['phase', 'polarRegime']);
const BOOLEAN_PROPS: ReadonlySet<string> = new Set(['isDirectSunlight', 'isDaylightSaving']);
const ANGLE_PROPS: ReadonlySet<string> = new Set(['elevation', 'azimuth', 'zenith']);
const DISCRETE_CIVIL_PROPS: ReadonlySet<string> = new Set([
  'hour',
  'minute',
  'second',
  'dayOfWeek',
  'day',
  'month',
  'year',
]);

export const VALID_SOLAR_PHASES: readonly string[] = Object.freeze([
  'day',
  'civil_twilight',
  'nautical_twilight',
  'astronomical_twilight',
  'night',
]);

export const VALID_POLAR_REGIMES: readonly string[] = Object.freeze([
  'none',
  'polar_day',
  'polar_night',
]);

const CIVIL_NUMERIC_BOUNDS: Record<string, { min: number; max: number }> = Object.freeze({
  hour: Object.freeze({ min: 0, max: 24 }),
  minute: Object.freeze({ min: 0, max: 60 }),
  second: Object.freeze({ min: 0, max: 60 }),
  day: Object.freeze({ min: 1, max: 31 }),
  month: Object.freeze({ min: 1, max: 12 }),
  dayOfWeek: Object.freeze({ min: 1, max: 7 }),
});

const VALID_COMPARISON_OPS: readonly ComparisonOperator[] = Object.freeze([
  'gt',
  'gte',
  'lt',
  'lte',
  'eq',
  'neq',
  'in',
  'between',
]);

const VALID_LOGICAL_OPS: readonly LogicalOperator[] = Object.freeze(['and', 'or', 'not']);

const VALID_SOLAR_PROPS: readonly SolarProperty[] = Object.freeze([
  'elevation',
  'azimuth',
  'zenith',
  'phase',
  'polarRegime',
  'isDirectSunlight',
]);

const VALID_CIVIL_PROPS: readonly CivilProperty[] = Object.freeze([
  'hour',
  'minute',
  'second',
  'dayOfWeek',
  'day',
  'month',
  'year',
  'isDaylightSaving',
]);

/**
 * Type guard for SolarComparisonNode.
 */
export function isSolarComparisonNode(node: unknown): node is SolarComparisonNode {
  if (typeof node !== 'object' || node === null) return false;
  const n = node as Record<string, unknown>;
  return (
    n['kind'] === 'comparison' &&
    n['domain'] === 'solar' &&
    VALID_SOLAR_PROPS.includes(n['property'] as SolarProperty) &&
    VALID_COMPARISON_OPS.includes(n['operator'] as ComparisonOperator) &&
    n['value'] !== undefined
  );
}

/**
 * Type guard for CivilComparisonNode.
 */
export function isCivilComparisonNode(node: unknown): node is CivilComparisonNode {
  if (typeof node !== 'object' || node === null) return false;
  const n = node as Record<string, unknown>;
  return (
    n['kind'] === 'comparison' &&
    n['domain'] === 'civil' &&
    VALID_CIVIL_PROPS.includes(n['property'] as CivilProperty) &&
    VALID_COMPARISON_OPS.includes(n['operator'] as ComparisonOperator) &&
    n['value'] !== undefined
  );
}

/**
 * Type guard for AtomicConditionNode.
 */
export function isAtomicConditionNode(node: unknown): node is AtomicConditionNode {
  return isSolarComparisonNode(node) || isCivilComparisonNode(node);
}

/**
 * Type guard for LogicalConditionNode.
 */
export function isLogicalConditionNode(node: unknown): node is LogicalConditionNode {
  if (typeof node !== 'object' || node === null) return false;
  const n = node as Record<string, unknown>;
  if (n['kind'] !== 'logical' || !VALID_LOGICAL_OPS.includes(n['operator'] as LogicalOperator)) {
    return false;
  }
  if (!Array.isArray(n['operands'])) return false;
  if (n['operator'] === 'not' && n['operands'].length !== 1) return false;
  if ((n['operator'] === 'and' || n['operator'] === 'or') && n['operands'].length < 1) return false;
  return n['operands'].every((op) => isConditionAST(op));
}

/**
 * Type guard for any valid ConditionAST node.
 */
export function isConditionAST(node: unknown): node is ConditionAST {
  return isAtomicConditionNode(node) || isLogicalConditionNode(node);
}

/**
 * Asserts that a value is a valid ConditionAST, throwing TypeError or RangeError if invalid.
 * Enforces strict property-operator compatibility matrix, unit validation, and numeric bounds.
 */
export function validateConditionAST(node: unknown): asserts node is ConditionAST {
  if (typeof node !== 'object' || node === null) {
    throw new TypeError(
      `Invalid ConditionAST node: expected non-null object, received ${typeof node === 'object' ? 'null' : typeof node}`
    );
  }

  const n = node as Record<string, unknown>;

  if (n['kind'] === 'logical') {
    const op = n['operator'];
    if (!VALID_LOGICAL_OPS.includes(op as LogicalOperator)) {
      throw new TypeError(`Invalid logical operator: '${String(op)}'. Expected 'and', 'or', or 'not'.`);
    }
    const operands = n['operands'];
    if (!Array.isArray(operands)) {
      throw new TypeError(`Logical operator '${String(op)}' operands must be an array.`);
    }
    if (op === 'not' && operands.length !== 1) {
      throw new TypeError(`Logical operator 'not' requires exactly 1 operand, received ${operands.length}.`);
    }
    if ((op === 'and' || op === 'or') && operands.length < 1) {
      throw new TypeError(`Logical operator '${String(op)}' requires at least 1 operand, received ${operands.length}.`);
    }
    for (const operand of operands) {
      validateConditionAST(operand);
    }
    return;
  }

  if (n['kind'] === 'comparison') {
    const domain = n['domain'];
    if (domain !== 'solar' && domain !== 'civil') {
      throw new TypeError(`Invalid condition domain: '${String(domain)}'. Expected 'solar' or 'civil'.`);
    }

    const prop = n['property'] as string;
    const operator = n['operator'] as string;
    const value = n['value'];
    const unit = n['unit'];

    if (domain === 'solar') {
      if (!VALID_SOLAR_PROPS.includes(prop as SolarProperty)) {
        throw new TypeError(`Invalid solar property: '${prop}'.`);
      }
    } else {
      if (!VALID_CIVIL_PROPS.includes(prop as CivilProperty)) {
        throw new TypeError(`Invalid civil property: '${prop}'.`);
      }
    }

    if (!VALID_COMPARISON_OPS.includes(operator as ComparisonOperator)) {
      throw new TypeError(`Invalid comparison operator: '${operator}'.`);
    }

    // 1. Property-Operator Compatibility Matrix
    if (CATEGORICAL_PROPS.has(prop)) {
      if (operator !== 'eq' && operator !== 'neq' && operator !== 'in') {
        throw new TypeError(
          `Property '${prop}' is categorical and does not support operator '${operator}'. Only 'eq', 'neq', and 'in' are supported.`
        );
      }
    }

    if (BOOLEAN_PROPS.has(prop)) {
      if (operator !== 'eq' && operator !== 'neq') {
        throw new TypeError(
          `Property '${prop}' is boolean and does not support operator '${operator}'. Only 'eq' and 'neq' are supported.`
        );
      }
    }

    // 2. Unit Compatibility Validation
    if (prop === 'hour') {
      if (unit !== undefined && unit !== 'hours') {
        throw new TypeError(`Invalid unit '${unit}' for property 'hour'. Only 'hours' is accepted.`);
      }
    } else if (prop === 'minute') {
      if (unit !== undefined && unit !== 'minutes') {
        throw new TypeError(`Invalid unit '${unit}' for property 'minute'. Only 'minutes' is accepted.`);
      }
    } else if (prop === 'second') {
      if (unit !== undefined && unit !== 'seconds') {
        throw new TypeError(`Invalid unit '${unit}' for property 'second'. Only 'seconds' is accepted.`);
      }
    } else if (ANGLE_PROPS.has(prop)) {
      if (unit !== undefined && unit !== 'deg' && unit !== 'rad') {
        throw new TypeError(`Invalid unit '${unit}' for angle property '${prop}'. Only 'deg' or 'rad' is accepted.`);
      }
    } else {
      if (unit !== undefined) {
        throw new TypeError(`Property '${prop}' does not accept units, received: '${unit}'.`);
      }
    }

    // 3. Value Type & Bounds Validation
    if (BOOLEAN_PROPS.has(prop)) {
      if (typeof value !== 'boolean') {
        throw new TypeError(`Property '${prop}' requires a boolean value, received: ${typeof value}.`);
      }
      return;
    }

    if (CATEGORICAL_PROPS.has(prop)) {
      const validSet = prop === 'phase' ? VALID_SOLAR_PHASES : VALID_POLAR_REGIMES;
      if (operator === 'in') {
        if (!Array.isArray(value) || value.length === 0) {
          throw new TypeError(`Property '${prop}' with operator 'in' requires a non-empty array of strings.`);
        }
        for (const item of value) {
          if (typeof item !== 'string' || item.trim().length === 0) {
            throw new TypeError(`Property '${prop}' with operator 'in' requires non-empty string values.`);
          }
          if (!validSet.includes(item)) {
            throw new TypeError(
              `Invalid value '${item}' for categorical property '${prop}'. Expected one of: ${validSet.join(', ')}`
            );
          }
        }
      } else {
        if (typeof value !== 'string' || value.trim().length === 0) {
          throw new TypeError(`Property '${prop}' requires a non-empty string value, received: ${typeof value}.`);
        }
        if (!validSet.includes(value)) {
          throw new TypeError(
            `Invalid value '${value}' for categorical property '${prop}'. Expected one of: ${validSet.join(', ')}`
          );
        }
      }
      return;
    }

    // Numeric properties
    const checkFiniteNumber = (val: unknown, name: string): void => {
      if (typeof val !== 'number' || !Number.isFinite(val)) {
        throw new TypeError(`Property '${name}' requires finite numeric values, received: ${val}`);
      }
    };

    const checkIntegerNumber = (val: number, name: string): void => {
      if (DISCRETE_CIVIL_PROPS.has(name) && !Number.isInteger(val)) {
        throw new TypeError(`Civil property '${name}' requires integer values, received: ${val}`);
      }
    };

    const checkBounds = (val: number, name: string): void => {
      const bound = CIVIL_NUMERIC_BOUNDS[name];
      if (bound) {
        if (val < bound.min || val > bound.max) {
          throw new RangeError(
            `Property '${name}' value must be between ${bound.min} and ${bound.max}, received: ${val}`
          );
        }
      }
    };

    if (operator === 'between') {
      if (!Array.isArray(value) || value.length !== 2) {
        throw new TypeError(
          `Operator 'between' requires a 2-element array [min, max], received: ${JSON.stringify(value)}`
        );
      }
      checkFiniteNumber(value[0], prop);
      checkFiniteNumber(value[1], prop);
      checkIntegerNumber(value[0] as number, prop);
      checkIntegerNumber(value[1] as number, prop);
      checkBounds(value[0] as number, prop);
      checkBounds(value[1] as number, prop);
      if (prop !== 'azimuth' && (value[0] as number) > (value[1] as number)) {
        throw new RangeError(
          `between() min must be <= max, received min=${value[0]}, max=${value[1]}`
        );
      }
    } else if (operator === 'in') {
      if (!Array.isArray(value) || value.length === 0) {
        throw new TypeError(`Operator 'in' requires a non-empty array of numbers.`);
      }
      for (const item of value) {
        checkFiniteNumber(item, prop);
        checkIntegerNumber(item as number, prop);
        checkBounds(item as number, prop);
      }
    } else {
      checkFiniteNumber(value, prop);
      checkIntegerNumber(value as number, prop);
      checkBounds(value as number, prop);
    }

    return;
  }

  throw new TypeError(
    `Invalid ConditionAST node: ${typeof node === 'object' ? JSON.stringify(node) : String(node)}`
  );
}

/**
 * Converts a ConditionAST node into a human-readable query string.
 */
export function formatConditionAST(node: ConditionAST): string {
  if (node.kind === 'logical') {
    if (node.operator === 'not') {
      return `NOT (${formatConditionAST(node.operands[0]!)})`;
    }
    const opUpper = node.operator.toUpperCase();
    const formattedChildren = node.operands.map((op) => formatConditionAST(op));
    return `(${formattedChildren.join(` ${opUpper} `)})`;
  }

  const { domain, property, operator, value, unit } = node;
  const unitSuffix = unit ? (unit === 'deg' ? '°' : ` ${unit}`) : '';

  switch (operator) {
    case 'between': {
      if (Array.isArray(value) && value.length === 2) {
        return `${domain}.${property} between ${value[0]}${unitSuffix} and ${value[1]}${unitSuffix}`;
      }
      return `${domain}.${property} between ${JSON.stringify(value)}`;
    }
    case 'in': {
      if (Array.isArray(value)) {
        return `${domain}.${property} in [${value.map((v) => `${v}${unitSuffix}`).join(', ')}]`;
      }
      return `${domain}.${property} in ${JSON.stringify(value)}`;
    }
    case 'gt':
      return `${domain}.${property} > ${value}${unitSuffix}`;
    case 'gte':
      return `${domain}.${property} >= ${value}${unitSuffix}`;
    case 'lt':
      return `${domain}.${property} < ${value}${unitSuffix}`;
    case 'lte':
      return `${domain}.${property} <= ${value}${unitSuffix}`;
    case 'eq':
      return `${domain}.${property} == ${value}${unitSuffix}`;
    case 'neq':
      return `${domain}.${property} != ${value}${unitSuffix}`;
    default:
      return `${domain}.${property} ${operator} ${value}`;
  }
}

/**
 * Parses and validates a JSON string or plain JavaScript object into a frozen ConditionAST node.
 */
export function parseConditionAST(input: string | unknown): ConditionAST {
  let parsed: unknown = input;
  if (typeof input === 'string') {
    try {
      parsed = JSON.parse(input);
    } catch (err) {
      throw new TypeError(`Failed to parse ConditionAST JSON: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function deepFreeze<T>(obj: T): T {
    if (obj !== null && typeof obj === 'object') {
      Object.freeze(obj);
      for (const key of Object.keys(obj)) {
        deepFreeze((obj as Record<string, unknown>)[key]);
      }
    }
    return obj;
  }

  validateConditionAST(parsed);
  return deepFreeze(parsed);
}

