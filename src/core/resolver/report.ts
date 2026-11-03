/**
 * @file report.ts
 * Mathematical provenance and explanation generator for ChronoFlux resolver.
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

export interface BoundaryExplanation {
  readonly instant: Instant;
  readonly boundaryType: 'start' | 'end';
  readonly reason: string;
  readonly model: 'solar' | 'civil' | 'window';
  readonly conditionDescription: string;
  readonly details?: {
    readonly property?: string;
    readonly threshold?: number | string | boolean;
    readonly actualValue?: number | string | boolean;
    readonly residualDeg?: number;
    readonly toleranceDeg?: number;
    readonly timeZoneId?: string;
    readonly isWindowBoundary?: boolean;
  };
}

export interface IntervalExplanation {
  readonly interval: Interval;
  readonly startExplanation: BoundaryExplanation;
  readonly endExplanation: BoundaryExplanation;
  readonly duration: Duration;
}

export interface ResolutionReport {
  readonly query: string;
  readonly searchWindow: Interval;
  readonly place: Place;
  readonly policy: SelectionPolicy;
  readonly minDuration?: Duration | undefined;
  readonly modelsConsulted: readonly ModelDomain[];
  readonly explanations: readonly IntervalExplanation[];
  readonly totalMatchesFound: number;
  readonly executionTimeMs: number;
  readonly accuracy: {
    readonly solarNumericalToleranceDeg: number;
    readonly isWithinValidityRange: boolean;
    readonly isAccuracyDegraded: boolean;
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
  for (const [key, record] of ctx.solarRecords) {
    if (key.startsWith(boundaryType)) {
      const diffNs = Math.abs(Number(record.instant.epochNanoseconds - instant.epochNanoseconds));
      if (diffNs <= 10_000_000) { // within 10 ms
        let extraContext = '';
        if (ctx.modelsConsulted.has('civil')) {
          const tz = ctx.place.timeZoneId || 'UTC';
          const cState = civilModel.evaluate(instant, tz);
          const tzAbbr = getTimeZoneAbbr(instant, tz);
          extraContext = ` Civil time is ${String(cState.hour).padStart(2, '0')}:${String(cState.minute).padStart(2, '0')} ${tzAbbr}.`;
        }
        return Object.freeze({
          instant,
          boundaryType,
          reason: `${record.reason}${extraContext}`,
          model: 'solar' as const,
          conditionDescription: record.conditionDescription,
          details: Object.freeze({
            property: record.property,
            threshold: record.thresholdDeg,
            actualValue: record.actualValueDeg,
            residualDeg: record.residualDeg,
            toleranceDeg: record.toleranceDeg,
          }),
        });
      }
    }
  }

  // 3. Exact recorded civil boundary
  for (const [key, record] of ctx.civilRecords) {
    if (key.startsWith(boundaryType)) {
      const diffNs = Math.abs(Number(record.instant.epochNanoseconds - instant.epochNanoseconds));
      if (diffNs <= 10_000_000) {
        let extraContext = '';
        if (ctx.modelsConsulted.has('solar')) {
          const coords = computeSolarCoordinates(instant, ctx.place);
          extraContext = ` Solar elevation is ${coords.geometricElevationDeg.toFixed(1)}°.`;
        }
        return Object.freeze({
          instant,
          boundaryType,
          reason: `${record.reason}${extraContext}`,
          model: 'civil' as const,
          conditionDescription: record.conditionDescription,
          details: Object.freeze({
            property: record.property,
            threshold: record.value,
            actualValue: record.value,
            timeZoneId: record.timeZoneId,
          }),
        });
      }
    }
  }

  // 4. Inferred boundary from models consulted
  const tz = ctx.place.timeZoneId || 'UTC';
  const civilState = civilModel.evaluate(instant, tz);
  const coords = computeSolarCoordinates(instant, ctx.place);

  if (ctx.modelsConsulted.has('civil') && civilState.minute === 0 && civilState.second === 0) {
    const tzAbbr = getTimeZoneAbbr(instant, tz);
    const hourStr = String(civilState.hour).padStart(2, '0');
    let extraContext = '';
    if (ctx.modelsConsulted.has('solar')) {
      extraContext = ` Solar elevation is ${coords.geometricElevationDeg >= 0 ? '' : '-'}${Math.abs(coords.geometricElevationDeg).toFixed(1)}°.`;
    }
    return Object.freeze({
      instant,
      boundaryType,
      reason:
        boundaryType === 'start'
          ? `Civil time entered business hours (${hourStr}:00 ${tzAbbr}) in ${tz}.${extraContext}`
          : `Civil time exited business hours (${hourStr}:00 ${tzAbbr}) in ${tz}.${extraContext}`,
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
  executionTimeMs: number
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

  const isWithinValidityRange =
    SOLAR_MODEL_VALIDITY_RANGE.contains(ctx.within.start) &&
    SOLAR_MODEL_VALIDITY_RANGE.contains(ctx.within.end);

  const report: ResolutionReport = Object.freeze({
    query: formatConditionAST(ast),
    searchWindow: ctx.within,
    place: ctx.place,
    policy,
    ...(minDuration !== undefined ? { minDuration } : {}),
    modelsConsulted: Object.freeze(Array.from(ctx.modelsConsulted)),
    explanations: Object.freeze(explanations),
    totalMatchesFound: intervals.intervals.length,
    executionTimeMs: Math.round(executionTimeMs * 100) / 100,
    accuracy: Object.freeze({
      solarNumericalToleranceDeg: 1e-5,
      isWithinValidityRange,
      isAccuracyDegraded: !isWithinValidityRange,
    }),
  });

  return report;
}
