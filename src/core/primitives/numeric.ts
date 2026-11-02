/**
 * @file numeric.ts
 * Exact numerical input validation, safe integer checking, and fractional-unit rounding for ChronoFlux.
 */

import { RoundingMode } from './types.js';

/**
 * Validates that a rounding mode is recognized.
 */
export function validateRoundingMode(roundingMode: unknown): asserts roundingMode is RoundingMode {
  if (
    roundingMode !== 'trunc' &&
    roundingMode !== 'floor' &&
    roundingMode !== 'ceil' &&
    roundingMode !== 'halfExpand'
  ) {
    throw new RangeError(`Unknown rounding mode: ${roundingMode}`);
  }
}

/**
 * Rounds a scaled decimal string against a given denominator and applies the specified rounding mode.
 */
export function roundScaledDecimal(
  sign: 1n | -1n,
  scaledWhole: bigint,
  fracNum: bigint,
  denom: bigint,
  roundingMode: RoundingMode
): bigint {
  validateRoundingMode(roundingMode);

  const q = fracNum / denom;
  const r = fracNum % denom;
  let total = scaledWhole + q;

  if (r !== 0n) {
    if (sign === 1n) {
      switch (roundingMode) {
        case 'trunc':
        case 'floor':
          break;
        case 'ceil':
          total += 1n;
          break;
        case 'halfExpand':
          if (r * 2n >= denom) {
            total += 1n;
          }
          break;
      }
    } else {
      switch (roundingMode) {
        case 'trunc':
        case 'ceil':
          break;
        case 'floor':
          total += 1n;
          break;
        case 'halfExpand':
          if (r * 2n >= denom) {
            total += 1n;
          }
          break;
      }
    }
  }

  return sign * total;
}

/**
 * Parses and scales a decimal string (e.g. "1.5", "-0.000000001") by unitNanoseconds,
 * applying the specified rounding mode if fractional parts remain.
 */
export function roundDecimalStringToNanoseconds(
  str: string,
  unitNanoseconds: bigint,
  paramName: string,
  roundingMode: RoundingMode
): bigint {
  const match = /^([+-])?(\d+)(?:\.(\d+))?$/.exec(str);
  if (!match) {
    throw new TypeError(`Invalid decimal string for ${paramName}: "${str}"`);
  }

  const sign = match[1] === '-' ? -1n : 1n;
  const whole = BigInt(match[2]!);
  const fracStr = match[3] ?? '';

  if (fracStr.length === 0 || /^0+$/.test(fracStr)) {
    return sign * whole * unitNanoseconds;
  }

  const scale = BigInt(fracStr.length);
  const frac = BigInt(fracStr);
  const denom = 10n ** scale;

  return roundScaledDecimal(
    sign,
    whole * unitNanoseconds,
    frac * unitNanoseconds,
    denom,
    roundingMode
  );
}

/**
 * Converts a numerical input (bigint, safe integer number, or decimal string) into exact integer nanoseconds.
 *
 * Invariant Rules:
 * 1. BigInt: Always exact, no bounds restrictions beyond domain limits.
 * 2. Number: Must be a finite safe integer in [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER].
 *    Unsafe integers throw RangeError directing callers to use BigInt or decimal strings.
 *    Fractional numbers require an explicit RoundingMode; otherwise a RangeError is thrown.
 * 3. String: Decimal strings (integer or fractional). Fractional strings require an explicit RoundingMode.
 *    Invalid non-numeric strings throw TypeError.
 */
export function parseUnitToNanoseconds(
  val: bigint | number | string,
  unitNanoseconds: bigint,
  paramName: string,
  roundingMode?: RoundingMode
): bigint {
  if (val === null || val === undefined) {
    throw new TypeError(`${paramName} must be a number, bigint, or decimal string, received: ${val}`);
  }

  if (typeof val === 'bigint') {
    return val * unitNanoseconds;
  }

  if (typeof val === 'number') {
    if (!Number.isFinite(val)) {
      throw new TypeError(`${paramName} must be a finite number or bigint, received: ${val}`);
    }

    if (Number.isSafeInteger(val)) {
      return BigInt(val) * unitNanoseconds;
    }

    if (Number.isInteger(val)) {
      throw new RangeError(
        `Integer ${val} for ${paramName} is outside safe integer range [${Number.MIN_SAFE_INTEGER}, ${Number.MAX_SAFE_INTEGER}]. ` +
          `Use BigInt or a decimal string for values requiring greater precision.`
      );
    }

    // Fractional number (e.g. 1.5)
    if (roundingMode === undefined) {
      throw new RangeError(
        `Fractional value ${val} for ${paramName} requires an explicit rounding policy ('trunc', 'floor', 'ceil', or 'halfExpand')`
      );
    }

    return roundDecimalStringToNanoseconds(val.toString(), unitNanoseconds, paramName, roundingMode);
  }

  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.length === 0) {
      throw new TypeError(`Invalid numeric string for ${paramName}: "${val}"`);
    }

    // Pure integer string
    if (/^[+-]?\d+$/.test(trimmed)) {
      return BigInt(trimmed) * unitNanoseconds;
    }

    // Decimal string
    const match = /^([+-])?(\d+)\.(\d+)$/.exec(trimmed);
    if (match) {
      const fracStr = match[3]!;
      if (/^0+$/.test(fracStr)) {
        const sign = match[1] === '-' ? -1n : 1n;
        return sign * BigInt(match[2]!) * unitNanoseconds;
      }
      if (roundingMode === undefined) {
        throw new RangeError(
          `Fractional value "${val}" for ${paramName} requires an explicit rounding policy ('trunc', 'floor', 'ceil', or 'halfExpand')`
        );
      }
      return roundDecimalStringToNanoseconds(trimmed, unitNanoseconds, paramName, roundingMode);
    }

    throw new TypeError(`Invalid numeric string for ${paramName}: "${val}"`);
  }

  throw new TypeError(`${paramName} must be a number, bigint, or decimal string, received: ${typeof val}`);
}
