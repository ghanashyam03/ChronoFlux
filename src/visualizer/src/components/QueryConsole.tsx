/**
 * @file QueryConsole.tsx
 * Interactive declarative condition playground, IntervalSet timeline, and ResolutionReport inspector.
 */

import React, { useState, useMemo } from 'react';
import {
  Time,
  Conditions,
  type ConditionAST,
  type SelectionPolicy,
  type ResolutionResult,
  type AllenRelation,
  type ResolveOptions,
} from '@chronoflux/core';
import type { TemporalStateHook } from '../state/useTemporalState.js';
import { QUERY_PRESETS } from '../state/presets.js';
import {
  intervalToPixelRange,
  formatUtcIso,
  formatDurationFriendly,
} from '../utils/timeline.js';

interface QueryConsoleProps {
  readonly state: TemporalStateHook;
}

export const QueryConsole: React.FC<QueryConsoleProps> = ({ state }) => {
  const { selectedPlace, searchWindow } = state;

  const [activePresetId, setActivePresetId] = useState<string>('civil_business_daylight');
  const [selectedPolicy, setSelectedPolicy] = useState<SelectionPolicy>('all');
  const [minDurationMinutes, setMinDurationMinutes] = useState<number>(0);

  // Custom condition builder states
  const [builderDomain, setBuilderDomain] = useState<'solar' | 'civil'>('solar');
  const [builderProp, setBuilderProp] = useState<string>('elevation');
  const [builderOp, setBuilderOp] = useState<string>('gte');
  const [builderVal, setBuilderVal] = useState<number>(10);
  const [builderValMax, setBuilderValMax] = useState<number>(25);

  const [selectedIntervalIndex, setSelectedIntervalIndex] = useState<number | null>(null);
  const [compareIntervalA, setCompareIntervalA] = useState<number | null>(null);
  const [compareIntervalB, setCompareIntervalB] = useState<number | null>(null);

  // 1. Resolve active ConditionAST
  const activeCondition = useMemo<ConditionAST>(() => {
    if (activePresetId !== 'custom') {
      const preset = QUERY_PRESETS.find((p) => p.id === activePresetId);
      if (preset) {
        return preset.condition;
      }
    }

    // Build custom condition safely using Conditions builder
    try {
      if (builderDomain === 'solar') {
        if (builderProp === 'elevation') {
          if (builderOp === 'gte') return Conditions.solar.elevation.gte(builderVal);
          if (builderOp === 'gt') return Conditions.solar.elevation.gt(builderVal);
          if (builderOp === 'lte') return Conditions.solar.elevation.lte(builderVal);
          if (builderOp === 'lt') return Conditions.solar.elevation.lt(builderVal);
          if (builderOp === 'between') return Conditions.solar.elevation.between(builderVal, builderValMax);
        } else if (builderProp === 'polarRegime') {
          return Conditions.solar.polarRegime.eq(builderVal === 1 ? 'polar_day' : 'polar_night');
        }
      } else {
        if (builderProp === 'hour') {
          if (builderOp === 'gte') return Conditions.civil.hour.gte(builderVal);
          if (builderOp === 'lte') return Conditions.civil.hour.lte(builderVal);
          if (builderOp === 'between') return Conditions.civil.hour.between(builderVal, builderValMax);
          if (builderOp === 'eq') return Conditions.civil.hour.eq(builderVal);
        }
      }
    } catch {
      // Fallback
    }
    return Conditions.solar.elevation.gte(10);
  }, [activePresetId, builderDomain, builderProp, builderOp, builderVal, builderValMax]);

  // 2. Execute Time.resolve()
  const resolution = useMemo<{
    result: ResolutionResult | null;
    error: string | null;
  }>(() => {
    try {
      const options: ResolveOptions = {
        place: selectedPlace,
        within: searchWindow,
        where: activeCondition,
        policy: selectedPolicy,
        ...(minDurationMinutes > 0
          ? { minDuration: Time.duration.minutes(minDurationMinutes) }
          : {}),
      };

      const res = Time.resolve(options);

      return { result: res, error: null };
    } catch (err: unknown) {
      return {
        result: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }, [selectedPlace, searchWindow, activeCondition, selectedPolicy, minDurationMinutes]);

  const { result, error } = resolution;
  const intervals = result?.intervals.intervals ?? [];

  // 3. Allen Relationship between selected intervals
  const allenComparison = useMemo<{ relation: AllenRelation; desc: string } | null>(() => {
    if (compareIntervalA === null || compareIntervalB === null) {
      return null;
    }
    const intA = intervals[compareIntervalA];
    const intB = intervals[compareIntervalB];
    if (!intA || !intB) {
      return null;
    }

    const rel = intA.relationTo(intB);
    let desc = '';
    switch (rel) {
      case 'before':
        desc = 'Interval A ends strictly before Interval B starts.';
        break;
      case 'after':
        desc = 'Interval A starts strictly after Interval B ends.';
        break;
      case 'meets':
        desc = 'Interval A ends exactly at the start of Interval B.';
        break;
      case 'metBy':
        desc = 'Interval A starts exactly at the end of Interval B.';
        break;
      case 'overlaps':
        desc = 'Interval A starts before B and overlaps into B.';
        break;
      case 'overlappedBy':
        desc = 'Interval A is overlapped by Interval B.';
        break;
      case 'equals':
        desc = 'Interval A and Interval B are identical half-open intervals.';
        break;
      case 'contains':
        desc = 'Interval A strictly encompasses Interval B.';
        break;
      case 'during':
        desc = 'Interval A is completely inside Interval B.';
        break;
      case 'starts':
        desc = 'Interval A starts at the same instant as B but ends earlier.';
        break;
      case 'startedBy':
        desc = 'Interval A starts at the same instant as B but ends later.';
        break;
      case 'finishes':
        desc = 'Interval A ends at the same instant as B but started later.';
        break;
      case 'finishedBy':
        desc = 'Interval A ends at the same instant as B but started earlier.';
        break;
    }

    return { relation: rel, desc };
  }, [compareIntervalA, compareIntervalB, intervals]);

  return (
    <div className="diagnostic-panel">
      <div className="panel-header">
        <div className="panel-title-group">
          <span className="panel-title">Declarative Condition & Intent Resolver</span>
        </div>
        <span className="panel-subtitle">
          Time.resolve() Interval Algebra Engine
        </span>
      </div>

      <div className="panel-body">
        <div className="query-builder-container">
          {/* Preset Buttons */}
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
              QUERY PRESETS
            </div>
            <div className="query-presets-bar">
              {QUERY_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  className={`preset-chip ${activePresetId === preset.id ? 'active' : ''}`}
                  onClick={() => {
                    setActivePresetId(preset.id);
                    setSelectedIntervalIndex(null);
                  }}
                >
                  {preset.name}
                </button>
              ))}
              <button
                className={`preset-chip ${activePresetId === 'custom' ? 'active' : ''}`}
                onClick={() => {
                  setActivePresetId('custom');
                  setSelectedIntervalIndex(null);
                }}
              >
                + Custom AST
              </button>
            </div>
          </div>

          {/* Custom Builder Controls if active */}
          {activePresetId === 'custom' && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                padding: '10px',
                background: 'var(--surface-secondary)',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                alignItems: 'center',
              }}
            >
              <select
                className="preset-select"
                value={builderDomain}
                onChange={(e) => setBuilderDomain(e.target.value as any)}
              >
                <option value="solar">solar</option>
                <option value="civil">civil</option>
              </select>

              <select
                className="preset-select"
                value={builderProp}
                onChange={(e) => setBuilderProp(e.target.value)}
              >
                {builderDomain === 'solar' ? (
                  <>
                    <option value="elevation">elevation</option>
                    <option value="polarRegime">polarRegime</option>
                  </>
                ) : (
                  <option value="hour">hour</option>
                )}
              </select>

              <select
                className="preset-select"
                value={builderOp}
                onChange={(e) => setBuilderOp(e.target.value)}
              >
                <option value="gte">&gt;=</option>
                <option value="gt">&gt;</option>
                <option value="lte">&lt;=</option>
                <option value="lt">&lt;</option>
                <option value="between">between [min, max)</option>
              </select>

              <input
                type="number"
                className="preset-select"
                style={{ width: '70px' }}
                value={builderVal}
                onChange={(e) => setBuilderVal(Number(e.target.value))}
              />

              {builderOp === 'between' && (
                <>
                  <span className="text-muted">and</span>
                  <input
                    type="number"
                    className="preset-select"
                    style={{ width: '70px' }}
                    value={builderValMax}
                    onChange={(e) => setBuilderValMax(Number(e.target.value))}
                  />
                </>
              )}
            </div>
          )}

          {/* AST Query & Policy Bar */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="text-muted">Policy:</span>
              <select
                className="preset-select"
                value={selectedPolicy}
                onChange={(e) => setSelectedPolicy(e.target.value as SelectionPolicy)}
              >
                <option value="all">all</option>
                <option value="earliest">earliest</option>
                <option value="latest">latest</option>
                <option value="longest">longest</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="text-muted">Min Duration:</span>
              <input
                type="number"
                className="preset-select"
                style={{ width: '60px' }}
                value={minDurationMinutes}
                onChange={(e) => setMinDurationMinutes(Math.max(0, Number(e.target.value)))}
              />
              <span className="text-muted">mins</span>
            </div>
          </div>

          {/* AST Expression Preview */}
          <div className="ast-preview-box">
            {result ? result.report.query : JSON.stringify(activeCondition, null, 2)}
          </div>

          {/* Error Message if any */}
          {error && (
            <div
              style={{
                padding: '10px 14px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #ef4444',
                borderRadius: '6px',
                color: '#fca5a5',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
              }}
            >
              Error: {error}
            </div>
          )}

          {/* Interval Results & Timeline Visualization */}
          {result && (
            <div className="interval-results-container">
              <div className="interval-summary-bar">
                <div>
                  Matches: <span className="text-cyan">{intervals.length}</span> (
                  {result.report.totalMatchesFound} raw)
                </div>
                <div>
                  Total Duration:{' '}
                  <span className="text-gold">
                    {formatDurationFriendly(result.intervals.totalDuration())}
                  </span>
                </div>
                <div>
                  Execution Time:{' '}
                  <span className="text-cyan">{result.report.executionTimeMs.toFixed(2)} ms</span>
                </div>
              </div>

              {/* Visual Interval Timeline Bar */}
              <div className="intervals-timeline-viz">
                {intervals.map((interval, idx) => {
                  const range = intervalToPixelRange(interval, searchWindow, 1000);
                  const isSelected = selectedIntervalIndex === idx;

                  return (
                    <div
                      key={idx}
                      className={`interval-bar-segment ${isSelected ? 'selected' : ''}`}
                      style={{
                        left: `${(range.startX / 1000) * 100}%`,
                        width: `${(range.width / 1000) * 100}%`,
                      }}
                      onClick={() => {
                        setSelectedIntervalIndex(idx);
                        if (compareIntervalA === null) {
                          setCompareIntervalA(idx);
                        } else if (compareIntervalB === null && compareIntervalA !== idx) {
                          setCompareIntervalB(idx);
                        } else {
                          setCompareIntervalA(idx);
                          setCompareIntervalB(null);
                        }
                      }}
                      title={`Interval [${idx + 1}]: ${formatDurationFriendly(interval.duration)}`}
                    />
                  );
                })}
              </div>

              {/* Clicked Interval Details */}
              {selectedIntervalIndex !== null && intervals[selectedIntervalIndex] && (
                <div
                  style={{
                    background: 'var(--surface-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    padding: '10px 14px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                  }}
                >
                  <div style={{ color: 'var(--accent-emerald)', fontWeight: 600, marginBottom: '4px' }}>
                    Matched Interval [{selectedIntervalIndex + 1}]:
                  </div>
                  <div>Start: {formatUtcIso(intervals[selectedIntervalIndex]!.start)}</div>
                  <div>End: {formatUtcIso(intervals[selectedIntervalIndex]!.end)}</div>
                  <div>Duration: {formatDurationFriendly(intervals[selectedIntervalIndex]!.duration)}</div>
                </div>
              )}

              {/* Allen Relationship Comparison Inspector */}
              {intervals.length > 1 && (
                <div className="allen-inspector-box">
                  <div className="allen-title">Allen's Interval Algebra Inspector</div>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <span>Compare Interval:</span>
                    <select
                      className="preset-select"
                      value={compareIntervalA ?? 0}
                      onChange={(e) => setCompareIntervalA(Number(e.target.value))}
                    >
                      {intervals.map((_, i) => (
                        <option key={i} value={i}>
                          Interval #{i + 1}
                        </option>
                      ))}
                    </select>
                    <span>with</span>
                    <select
                      className="preset-select"
                      value={compareIntervalB ?? (intervals.length > 1 ? 1 : 0)}
                      onChange={(e) => setCompareIntervalB(Number(e.target.value))}
                    >
                      {intervals.map((_, i) => (
                        <option key={i} value={i}>
                          Interval #{i + 1}
                        </option>
                      ))}
                    </select>
                  </div>

                  {allenComparison && (
                    <div style={{ marginTop: '6px' }}>
                      <span className="badge-pill" style={{ background: '#3b82f6', color: '#fff' }}>
                        {allenComparison.relation.toUpperCase()}
                      </span>
                      <span className="allen-description" style={{ marginLeft: '8px' }}>
                        {allenComparison.desc}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Mathematical Provenance Report */}
              <div className="provenance-card">
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  MATHEMATICAL PROVENANCE & ACCURACY
                </div>
                <div className="provenance-row">
                  <span className="provenance-label">Models Consulted:</span>
                  <span className="provenance-value">{result.report.modelsConsulted.join(', ')}</span>
                </div>
                {result.report.accuracy.solarNumericalToleranceDeg !== undefined && (
                  <div className="provenance-row">
                    <span className="provenance-label">Solver Numerical Tolerance:</span>
                    <span className="provenance-value">
                      &lt; {result.report.accuracy.solarNumericalToleranceDeg}°
                    </span>
                  </div>
                )}
                <div className="provenance-row">
                  <span className="provenance-label">Timezone Context:</span>
                  <span className="provenance-value">
                    {result.report.accuracy.timeZoneId ?? 'None (Solar Only)'}
                  </span>
                </div>

                {/* Boundary Explanations */}
                <div style={{ marginTop: '8px', fontSize: '10px' }}>
                  <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>
                    BOUNDARY CROSSINGS & RESIDUALS:
                  </div>
                  {result.report.explanations.slice(0, 4).map((exp, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '4px 0',
                        borderTop: '1px solid var(--border-subtle)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <div>
                        [{i + 1} Start] {exp.startExplanation.reason} (
                        {formatUtcIso(exp.startExplanation.instant).slice(11, 19)}Z)
                        {exp.startExplanation.details?.residualDeg !== undefined && (
                          <span style={{ color: 'var(--accent-cyan)' }}>
                            {' '}
                            | residual: {exp.startExplanation.details.residualDeg.toExponential(2)}°
                          </span>
                        )}
                      </div>
                      <div>
                        [{i + 1} End] {exp.endExplanation.reason} (
                        {formatUtcIso(exp.endExplanation.instant).slice(11, 19)}Z)
                        {exp.endExplanation.details?.residualDeg !== undefined && (
                          <span style={{ color: 'var(--accent-cyan)' }}>
                            {' '}
                            | residual: {exp.endExplanation.details.residualDeg.toExponential(2)}°
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
