/**
 * @file report.ts
 * Mathematical provenance and explanation generator for TIME 2.0 resolver.
 * Generates detailed ResolutionReport documenting governing conditions, physical crossing
 * residuals, accuracy bounds, and execution metadata for every resolved boundary.
 */

import { civilModel } from '../models/civil/index.js';
import { computeSolarCoordinates, SOLAR_MODEL_VALIDITY_RANGE } from '../models/solar/math.js';
import { Duration } from '../primitives/duration.js';
import { Instant } from '../primitives/instant.js';
import { Interval } from '../primitives/interval.js';
import { IntervalSet } from '../primitives/interval-set.js';
import { Place } from '../primitives/place.js';
import { ConditionAST, formatConditionAST, ModelDomain } from './ast.js';
import { ResolutionContext } from './engine.js';
import { SelectionPolicy } from './intent.js';
import { CivilBoundaryProvenance, getEffectiveTimeZoneId } from './solver-civil.js';
import { SolarBoundaryProvenance } from './solver-solar.js';

/**
 * Granular provenance explanation for a single interval boundary (start or end).
 */
export interface BoundaryExplanation {
  /** Physical or civil Instant at which this boundary occurs */
  readonly instant: Instant;
  /** Whether this boundary represents the opening ('start') or closing ('end') of an interval */
  readonly boundaryType: 'start' | 'end';
  /** Human-readable explanation describing the physical crossing, civil event, or window clamp */
  readonly reason: string;
  /** Domain model governing this boundary: 'solar', 'civil', or 'window' (bounding search interval) */
  readonly model: 'solar' | 'civil' | 'window';
  /** Declarative condition AST clause that governed this boundary */
  readonly conditionDescription: string;
  /** Quantitative residuals, tolerances, and metadata */
  readonly details?: {
    readonly property?: string;
    readonly threshold?: number | string | boolean;
    readonly actualValue?: number | string | boolean;
    readonly residualDeg?: number;
    readonly toleranceDeg?: number;
    readonly timeZoneId?: string;
    readonly isWindowBoundary?: boolean;
    readonly isWrapBoundary?: boolean;
    readonly boundaryCategory?: string;
  };
}

/**
 * Granular explanation for an entire resolved interval, linking start and end boundaries.
 */
export interface IntervalExplanation {
  /** The continuous half-open interval [start, end) represented by this explanation */
  readonly interval: Interval;
  /** Granular mathematical provenance for the opening boundary (start) */
  readonly startExplanation: BoundaryExplanation;
  /** Granular mathematical provenance for the closing boundary (end) */
  readonly endExplanation: BoundaryExplanation;
  /** Total elapsed duration of this interval */
  readonly duration: Duration;
}

/**
 * Mathematical provenance and execution report returned by Time.resolve().
 * Details governing conditions, physical crossing residuals, models consulted, and performance.
 */
export interface ResolutionReport {
  /** Human-readable string representation of the resolved Condition AST query */
  readonly query: string;
  /** Bounding search window within which the condition was resolved */
  readonly searchWindow: Interval;
  /** Geographic observer place on the WGS84 ellipsoid */
  readonly place: Place;
  /** Selection intent policy applied ('all', 'earliest', 'latest', 'longest') */
  readonly policy: SelectionPolicy;
  /** Minimum duration filter constraint applied, if any */
  readonly minDuration?: Duration | undefined;
  /** List of model domains consulted during evaluation ('solar', 'civil') */
  readonly modelsConsulted: readonly ModelDomain[];
  /** Detailed boundary-by-boundary explanations for every matching interval */
  readonly explanations: readonly IntervalExplanation[];
  /** Total count of matching intervals before policy filtering */
  readonly totalMatchesFound: number;
  /** Execution runtime of the resolver in milliseconds */
  readonly executionTimeMs: number;
  /** Numerical accuracy bounds, validity range, and timezone metadata */
  readonly accuracy: {
    readonly solarNumericalToleranceDeg?: number;
    readonly isWithinValidityRange?: boolean;
    readonly isAccuracyDegraded?: boolean;
    readonly civilResolution?: string;
    readonly timeZoneId?: string;
  };
}

function getTimeZoneAbbr(instant: Instant, timeZoneId: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZoneId,
      timeZoneName: 'short',
    });
    const parts = formatter.formatToParts(new Date(Number(instant.toEpochMilliseconds())));
    const tzPart = parts.find((p) => p.type === 'timeZoneName')?.value;
    return tzPart || timeZoneId;
  } catch {
    return timeZoneId;
  }
}

/**
 * Generates a boundary explanation for an interval boundary instant.
 */
function explainBoundary(
  instant: Instant,
  boundaryType: 'start' | 'end',
  ctx: ResolutionContext,
  ast: ConditionAST
): BoundaryExplanation {
  // 1. Search window boundary
  if (instant.equals(ctx.within.start)) {
    return Object.freeze({
      instant,
      boundaryType,
      reason: 'Interval clamped to start of search window.',
      model: 'window' as const,
      conditionDescription: 'window.start',
      details: Object.freeze({ isWindowBoundary: true }),
    });
  }

  if (instant.equals(ctx.within.end)) {
    return Object.freeze({
      instant,
      boundaryType,
      reason: 'Interval clamped to end of search window.',
      model: 'window' as const,
      conditionDescription: 'window.end',
      details: Object.freeze({ isWindowBoundary: true }),
    });
  }

  // 2. Exact recorded solar crossing
  let bestSolarRecord: SolarBoundaryProvenance | null = null;
  let bestDiffNs = 10_000_000; // 10 ms
  for (const record of ctx.solarRecords.values()) {
    const diff = Math.abs(Number(record.instant.epochNanoseconds - instant.epochNanoseconds));
    if (diff < bestDiffNs) {
      bestDiffNs = diff;
      bestSolarRecord = record;
    }
  }

  if (bestSolarRecord) {
    let extraContext = '';
    if (ctx.modelsConsulted.has('civil')) {
      const tz = getEffectiveTimeZoneId(ctx.place);
      const cState = civilModel.evaluate(instant, tz);
      const tzAbbr = getTimeZoneAbbr(instant, tz);
      extraContext = ` Civil time is ${String(cState.hour).padStart(2, '0')}:${String(cState.minute).padStart(2, '0')} ${tzAbbr}.`;
    }

    let reason = bestSolarRecord.reason;
    if (!bestSolarRecord.isWrapBoundary && bestSolarRecord.boundaryType !== boundaryType) {
      if (bestSolarRecord.boundaryType === 'start') {
        reason = `Solar elevation crossed threshold ${bestSolarRecord.thresholdDeg.toFixed(2)}° (rising) with numerical residual ${bestSolarRecord.residualDeg !== undefined ? bestSolarRecord.residualDeg.toExponential(2) : '0'}°.`;
      } else {
        reason = `Solar elevation dropped below threshold ${bestSolarRecord.thresholdDeg.toFixed(2)}° (setting) with numerical residual ${bestSolarRecord.residualDeg !== undefined ? bestSolarRecord.residualDeg.toExponential(2) : '0'}°.`;
      }
    }

    const details: {
      property?: string;
      threshold?: number | string | boolean;
      actualValue?: number | string | boolean;
      residualDeg?: number;
      toleranceDeg?: number;
      timeZoneId?: string;
      isWindowBoundary?: boolean;
      isWrapBoundary?: boolean;
      boundaryCategory?: string;
    } = {
      property: bestSolarRecord.property,
      threshold: bestSolarRecord.thresholdDeg,
      actualValue: bestSolarRecord.actualValueDeg,
      ...(bestSolarRecord.residualDeg !== undefined ? { residualDeg: bestSolarRecord.residualDeg } : {}),
      ...(bestSolarRecord.toleranceDeg !== undefined ? { toleranceDeg: bestSolarRecord.toleranceDeg } : {}),
      ...(bestSolarRecord.isWrapBoundary !== undefined ? { isWrapBoundary: bestSolarRecord.isWrapBoundary } : {}),
      ...(bestSolarRecord.boundaryCategory !== undefined ? { boundaryCategory: bestSolarRecord.boundaryCategory } : {}),
    };

    return Object.freeze({
      instant,
      boundaryType,
      reason: `${reason}${extraContext}`,
      model: 'solar' as const,
      conditionDescription: bestSolarRecord.conditionDescription,
      details: Object.freeze(details),
    });
  }

  // 3. Exact recorded civil boundary
  let bestCivilRecord: CivilBoundaryProvenance | null = null;
  let bestCivilDiffNs = 10_000_000; // 10 ms
  for (const record of ctx.civilRecords.values()) {
    const diff = Math.abs(Number(record.instant.epochNanoseconds - instant.epochNanoseconds));
    if (diff < bestCivilDiffNs) {
      bestCivilDiffNs = diff;
      bestCivilRecord = record;
    }
  }

  if (bestCivilRecord) {
    let extraContext = '';
    if (ctx.modelsConsulted.has('solar')) {
      const coords = computeSolarCoordinates(instant, ctx.place);
      extraContext = ` Solar elevation is ${coords.geometricElevationDeg.toFixed(1)}°.`;
    }
    return Object.freeze({
      instant,
      boundaryType,
      reason: `${bestCivilRecord.reason}${extraContext}`,
      model: 'civil' as const,
      conditionDescription: bestCivilRecord.conditionDescription,
      details: Object.freeze({
        property: bestCivilRecord.property,
        threshold: bestCivilRecord.value,
        actualValue: bestCivilRecord.value,
        timeZoneId: bestCivilRecord.timeZoneId,
      }),
    });
  }

  // 4. Inferred boundary from models consulted
  if (ctx.modelsConsulted.has('civil')) {
    const tz = getEffectiveTimeZoneId(ctx.place);
    const civilState = civilModel.evaluate(instant, tz);
    const tzAbbr = getTimeZoneAbbr(instant, tz);
    const hourStr = String(civilState.hour).padStart(2, '0');
    const minStr = String(civilState.minute).padStart(2, '0');
    let extraContext = '';
    if (ctx.modelsConsulted.has('solar')) {
      const coords = computeSolarCoordinates(instant, ctx.place);
      extraContext = ` Solar elevation is ${coords.geometricElevationDeg >= 0 ? '' : '-'}${Math.abs(coords.geometricElevationDeg).toFixed(1)}°.`;
    }
    return Object.freeze({
      instant,
      boundaryType,
      reason:
        boundaryType === 'start'
          ? `Civil time entered matching civil state (${hourStr}:${minStr} ${tzAbbr}) in ${tz}.${extraContext}`
          : `Civil time exited matching civil state (${hourStr}:${minStr} ${tzAbbr}) in ${tz}.${extraContext}`,
      model: 'civil' as const,
      conditionDescription: `civil.hour ${boundaryType === 'start' ? '>=' : '<'} ${civilState.hour}`,
      details: Object.freeze({
        property: 'hour',
        threshold: civilState.hour,
        actualValue: civilState.hour,
        timeZoneId: tz,
      }),
    });
  }

  if (ctx.modelsConsulted.has('solar')) {
    const coords = computeSolarCoordinates(instant, ctx.place);
    return Object.freeze({
      instant,
      boundaryType,
      reason:
        boundaryType === 'start'
          ? `Solar elevation crossed threshold (${coords.geometricElevationDeg.toFixed(2)}°).`
          : `Solar elevation dropped below threshold (${coords.geometricElevationDeg.toFixed(2)}°).`,
      model: 'solar' as const,
      conditionDescription: 'solar.elevation',
      details: Object.freeze({
        property: 'elevation',
        actualValue: coords.geometricElevationDeg,
      }),
    });
  }

  return Object.freeze({
    instant,
    boundaryType,
    reason: `Boundary governed by ${formatConditionAST(ast)}.`,
    model: (ctx.modelsConsulted.values().next().value ?? 'solar') as 'solar' | 'civil',
    conditionDescription: formatConditionAST(ast),
  });
}

/**
 * Builds the complete ResolutionReport for a resolution run.
 */
export function buildResolutionReport(
  ast: ConditionAST,
  intervals: IntervalSet,
  ctx: ResolutionContext,
  policy: SelectionPolicy = 'all',
  minDuration: Duration | undefined,
  executionTimeMs: number,
  allMatchingIntervals?: IntervalSet
): ResolutionReport {
  const explanations: IntervalExplanation[] = [];

  for (const interval of intervals.intervals) {
    const startExp = explainBoundary(interval.start, 'start', ctx, ast);
    const endExp = explainBoundary(interval.end, 'end', ctx, ast);

    explanations.push(
      Object.freeze({
        interval,
        startExplanation: startExp,
        endExplanation: endExp,
        duration: interval.duration,
      })
    );
  }

  const hasSolar = ctx.modelsConsulted.has('solar');
  const hasCivil = ctx.modelsConsulted.has('civil');

  let accuracy: ResolutionReport['accuracy'];
  if (hasSolar) {
    const isWithinValidityRange =
      SOLAR_MODEL_VALIDITY_RANGE.contains(ctx.within.start) &&
      SOLAR_MODEL_VALIDITY_RANGE.contains(ctx.within.end);

    accuracy = Object.freeze({
      solarNumericalToleranceDeg: 1e-5,
      isWithinValidityRange,
      isAccuracyDegraded: !isWithinValidityRange,
      ...(hasCivil
        ? {
            civilResolution: 'Exact integer calendar boundary (0 numerical residual)',
            timeZoneId: getEffectiveTimeZoneId(ctx.place),
          }
        : {}),
    });
  } else if (hasCivil) {
    accuracy = Object.freeze({
      civilResolution: 'Exact integer calendar boundary (0 numerical residual)',
      timeZoneId: getEffectiveTimeZoneId(ctx.place),
    });
  } else {
    accuracy = Object.freeze({});
  }

  const totalMatchesFound = allMatchingIntervals
    ? allMatchingIntervals.intervals.length
    : intervals.intervals.length;

  const report: ResolutionReport = Object.freeze({
    query: formatConditionAST(ast),
    searchWindow: ctx.within,
    place: ctx.place,
    policy,
    ...(minDuration !== undefined ? { minDuration } : {}),
    modelsConsulted: Object.freeze(Array.from(ctx.modelsConsulted)),
    explanations: Object.freeze(explanations),
    totalMatchesFound,
    executionTimeMs: Math.round(executionTimeMs * 100) / 100,
    accuracy,
  });

  return report;
}
