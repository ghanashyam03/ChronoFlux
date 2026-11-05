/**
 * @file RibbonView.tsx
 * Multi-location continuous spacetime ribbon comparing physical daylight and civil legal time globally.
 */

import React, { useMemo } from 'react';
import { Time, Place, type SolarPhase } from '@chronoflux/core';
import type { TemporalStateHook } from '../state/useTemporalState.js';
import { LOCATION_PRESETS } from '../state/presets.js';
import {
  getSolarPhaseColor,
  getPolarRegimeLabel,
  getPolarRegimeBadgeColor,
} from '../utils/canvas-renderers.js';
import {
  getTimelineFraction,
  pixelToInstant,
} from '../utils/timeline.js';

interface RibbonViewProps {
  readonly state: TemporalStateHook;
}

interface RibbonLocationRow {
  readonly id: string;
  readonly name: string;
  readonly place: Place;
  readonly currentPhase: SolarPhase;
  readonly currentElevationDeg: number;
  readonly polarRegime: string;
  readonly civilTimeStr: string;
  readonly offsetStr: string;
  readonly isDst: boolean;
  readonly segments: readonly {
    readonly phase: SolarPhase;
    readonly startFrac: number;
    readonly endFrac: number;
  }[];
}

export const RibbonView: React.FC<RibbonViewProps> = ({ state }) => {
  const {
    activeInstant,
    searchWindow,
    selectedPlace,
    setSelectedPlace,
    setActiveInstant,
  } = state;

  // Render 5 global reference locations: Tromsø, Quito, New York, Tokyo, Sydney
  const referencePresets = useMemo(() => {
    return LOCATION_PRESETS.filter((p) =>
      ['tromso', 'quito', 'new_york', 'tokyo', 'sydney'].includes(p.id)
    );
  }, []);

  const rows = useMemo<RibbonLocationRow[]>(() => {
    const numSamples = 96; // 15-minute resolution across 24h
    const windowStartNs = searchWindow.start.epochNanoseconds;
    const windowEndNs = searchWindow.end.epochNanoseconds;
    const totalNs = windowEndNs - windowStartNs;

    return referencePresets.map((preset) => {
      const place = preset.place;

      // 1. Current State
      const pos = Time.solar.evaluatePosition(activeInstant, place);
      const fullSolar = Time.solar.evaluate(activeInstant, place);
      let civilTimeStr = 'N/A';
      let offsetStr = 'UTC';
      let isDst = false;

      if (place.timeZoneId) {
        try {
          const civil = Time.civil.evaluate(activeInstant, place);
          civilTimeStr = `${String(civil.hour).padStart(2, '0')}:${String(civil.minute).padStart(2, '0')}`;
          const offsetHours = civil.utcOffsetMinutes / 60;
          offsetStr = `UTC${offsetHours >= 0 ? '+' : ''}${offsetHours}h`;
          isDst = civil.isDaylightSaving;
        } catch {
          // ignore
        }
      }

      // 2. Timeline Segments across Search Window
      const rawSamples: { phase: SolarPhase; frac: number }[] = [];
      for (let i = 0; i <= numSamples; i++) {
        const frac = i / numSamples;
        const sampleNs = windowStartNs + BigInt(Math.round(frac * Number(totalNs)));
        const sampleInstant = Time.instant(sampleNs);
        const samplePos = Time.solar.evaluatePosition(sampleInstant, place);
        rawSamples.push({ phase: samplePos.phase, frac });
      }

      // Group into contiguous blocks
      const segments: { phase: SolarPhase; startFrac: number; endFrac: number }[] = [];
      if (rawSamples.length > 0) {
        let currentPhase = rawSamples[0]!.phase;
        let startFrac = 0;

        for (let i = 1; i < rawSamples.length; i++) {
          const s = rawSamples[i]!;
          if (s.phase !== currentPhase) {
            segments.push({
              phase: currentPhase,
              startFrac,
              endFrac: s.frac,
            });
            currentPhase = s.phase;
            startFrac = s.frac;
          }
        }
        segments.push({
          phase: currentPhase,
          startFrac,
          endFrac: 1,
        });
      }

      return {
        id: preset.id,
        name: preset.name,
        place,
        currentPhase: pos.phase,
        currentElevationDeg: pos.elevationDeg,
        polarRegime: fullSolar.polarRegime,
        civilTimeStr,
        offsetStr,
        isDst,
        segments,
      };
    });
  }, [referencePresets, searchWindow, activeInstant]);

  // Cursor position
  const cursorFrac = getTimelineFraction(activeInstant, searchWindow);

  return (
    <div className="diagnostic-panel">
      <div className="panel-header">
        <div className="panel-title-group">
          <span className="panel-title">Multi-Location Spacetime Ribbon</span>
          <span className="panel-subtitle">
            Synchronized UTC Physical Timeline across Contrasting Global Biomes
          </span>
        </div>
      </div>

      <div className="panel-body">
        <div className="ribbon-container">
          {rows.map((row) => {
            const isSelected =
              Math.abs(row.place.latitude - selectedPlace.latitude) < 1e-4 &&
              Math.abs(row.place.longitude - selectedPlace.longitude) < 1e-4;

            return (
              <div
                key={row.id}
                className="ribbon-row"
                style={{
                  borderColor: isSelected ? 'var(--accent-cyan)' : 'var(--border-color)',
                  background: isSelected ? 'rgba(56, 189, 248, 0.05)' : undefined,
                  cursor: 'pointer',
                }}
                onClick={() => setSelectedPlace(row.place)}
                title={`Click to select ${row.name} as active observer location`}
              >
                {/* Meta Column */}
                <div className="ribbon-meta">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="ribbon-name">{row.name}</span>
                    {row.polarRegime !== 'none' && (
                      <span
                        className="badge-pill"
                        style={{
                          background: 'rgba(245, 158, 11, 0.15)',
                          color: getPolarRegimeBadgeColor(row.polarRegime as any),
                          border: `1px solid ${getPolarRegimeBadgeColor(row.polarRegime as any)}`,
                        }}
                      >
                        {getPolarRegimeLabel(row.polarRegime as any).split(' ')[0]}
                      </span>
                    )}
                  </div>
                  <div className="ribbon-sub">
                    {row.civilTimeStr} ({row.offsetStr}
                    {row.isDst ? ' DST' : ''}) | {row.currentElevationDeg.toFixed(1)}°
                  </div>
                </div>

                {/* Timeline Ribbon Bar */}
                <div
                  className="ribbon-timeline"
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    const newInstant = pixelToInstant(clickX, searchWindow, rect.width);
                    setActiveInstant(newInstant);
                  }}
                  title="Click to scrub timeline to this instant"
                >
                  {/* Phase Segments */}
                  {row.segments.map((seg, idx) => (
                    <div
                      key={idx}
                      style={{
                        position: 'absolute',
                        left: `${seg.startFrac * 100}%`,
                        width: `${(seg.endFrac - seg.startFrac) * 100}%`,
                        top: 0,
                        bottom: 0,
                        background: getSolarPhaseColor(seg.phase),
                        opacity: seg.phase === 'day' ? 0.9 : 0.6,
                      }}
                      title={`${seg.phase.replace('_', ' ')}: ${(seg.startFrac * 100).toFixed(0)}% - ${(seg.endFrac * 100).toFixed(0)}%`}
                    />
                  ))}

                  {/* Synchronized Vertical Cursor */}
                  <div
                    className="ribbon-cursor"
                    style={{ left: `${cursorFrac * 100}%` }}
                  />
                </div>

                {/* Status Column */}
                <div className="ribbon-status">
                  <span
                    style={{
                      color: getSolarPhaseColor(row.currentPhase),
                      fontWeight: 600,
                      textTransform: 'capitalize',
                    }}
                  >
                    {row.currentPhase.replace('_', ' ')}
                  </span>
                  <span className="text-muted">
                    h: {row.currentElevationDeg.toFixed(2)}°
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
