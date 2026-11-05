/**
 * @file numeric.ts
 * Exact numerical input validation, safe integer checking, and fractional-unit rounding for TIME 2.0.
 */

import { LeapSecondPolicy, RoundingMode } from './types.js';

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
 * Validates that a leap second policy is recognized.
 */
export function validateLeapSecondPolicy(policy: unknown): asserts policy is LeapSecondPolicy {
  if (
    policy !== 'reject' &&
    policy !== 'strict' &&
    policy !== 'compatible' &&
    policy !== 'clamp'
  ) {
    throw new RangeError(`Unknown leap second policy: ${policy}`);
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
 * Normalizes a decimal or scientific string (e.g. "1.5", "-0.005", "1e-8", ".5", "5.", "+1.5e3")
 * into sign, integral whole BigInt, and fractional digit string without floating-point precision loss.
 */
export function normalizeDecimalString(
  str: string,
  paramName: string
): { sign: 1n | -1n; whole: bigint; fracStr: string } {
  const trimmed = str.trim();
  if (trimmed.length === 0) {
    throw new TypeError(`Invalid numeric string for ${paramName}: "${str}"`);
  }

  const match = /^([+-])?(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/.exec(trimmed);
  if (!match) {
    throw new TypeError(`Invalid numeric string for ${paramName}: "${str}"`);
  }

  const sign: 1n | -1n = match[1] === '-' ? -1n : 1n;
  const wholeRaw = match[2] ?? '0';
  const fracRaw = match[3] ?? match[4] ?? '';
  const expStr = match[5];
  const exp = expStr ? parseInt(expStr, 10) : 0;

  let normWhole: string;
  let normFrac: string;

  if (exp === 0) {
    normWhole = wholeRaw.replace(/^0+/, '') || '0';
    normFrac = fracRaw;
  } else if (exp > 0) {
    if (exp <= fracRaw.length) {
      normWhole = (wholeRaw + fracRaw.slice(0, exp)).replace(/^0+/, '') || '0';
      normFrac = fracRaw.slice(exp);
    } else {
      normWhole = (wholeRaw + fracRaw + '0'.repeat(exp - fracRaw.length)).replace(/^0+/, '') || '0';
      normFrac = '';
    }
  } else {
    // exp < 0: shift decimal point to the left by |exp|
    const shift = -exp;
    const cleanWhole = wholeRaw.replace(/^0+/, '');
    if (cleanWhole.length === 0) {
      normWhole = '0';
      normFrac = '0'.repeat(shift) + fracRaw;
    } else if (shift < cleanWhole.length) {
      normWhole = cleanWhole.slice(0, cleanWhole.length - shift);
      normFrac = cleanWhole.slice(cleanWhole.length - shift) + fracRaw;
    } else {
      normWhole = '0';
      normFrac = '0'.repeat(shift - cleanWhole.length) + cleanWhole + fracRaw;
    }
  }

  return {
    sign,
    whole: BigInt(normWhole),
    fracStr: normFrac,
  };
}

/**
 * Parses and scales a decimal or scientific string (e.g. "1.5", "-0.000000001", "1e-8") by unitNanoseconds,
 * applying the specified rounding mode if fractional parts remain.
 */
export function roundDecimalStringToNanoseconds(
  str: string,
  unitNanoseconds: bigint,
  paramName: string,
  roundingMode: RoundingMode
): bigint {
  const { sign, whole, fracStr } = normalizeDecimalString(str, paramName);

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
 * Converts a numerical input (bigint, safe integer number, or decimal/scientific string) into exact integer nanoseconds.
 *
 * Invariant Rules:
 * 1. BigInt: Always exact, no bounds restrictions beyond domain limits.
 * 2. Number: Must be a finite safe integer in [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER].
 *    Unsafe integers throw RangeError directing callers to use BigInt or decimal strings.
 *    Fractional numbers require an explicit RoundingMode; otherwise a RangeError is thrown.
 * 3. String: Decimal or scientific strings (integer or fractional). Fractional strings require an explicit RoundingMode.
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

    // Fractional number (e.g. 1.5, 1e-8, 0.00000001)
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

    const { sign, whole, fracStr } = normalizeDecimalString(trimmed, paramName);
    if (fracStr.length === 0 || /^0+$/.test(fracStr)) {
      return sign * whole * unitNanoseconds;
    }

    if (roundingMode === undefined) {
      throw new RangeError(
        `Fractional value "${val}" for ${paramName} requires an explicit rounding policy ('trunc', 'floor', 'ceil', or 'halfExpand')`
      );
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

  throw new TypeError(`${paramName} must be a number, bigint, or decimal string, received: ${typeof val}`);
}
