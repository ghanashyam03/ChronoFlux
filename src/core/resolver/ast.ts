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
 * Asserts that a value is a valid ConditionAST, throwing TypeError if invalid.
 */
export function validateConditionAST(node: unknown): asserts node is ConditionAST {
  if (!isConditionAST(node)) {
    throw new TypeError(
      `Invalid ConditionAST node: ${typeof node === 'object' ? JSON.stringify(node) : String(node)}`
    );
  }
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
