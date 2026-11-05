/**
 * @file SolarCurve.tsx
 * High-DPI Canvas 2D diurnal solar elevation and azimuth chart with twilight bands and event markers.
 */

import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Time, Instant, type SolarEventName } from '@chronoflux/core';
import type { TemporalStateHook } from '../state/useTemporalState.js';
import {
  setupHighDpiCanvas,
  elevationToY,
  azimuthToY,
  THEME,
  getSolarPhaseBandRgba,
} from '../utils/canvas-renderers.js';
import {
  instantToPixel,
  pixelToInstant,
  formatUtcIso,
} from '../utils/timeline.js';

interface SolarCurveProps {
  readonly state: TemporalStateHook;
}

interface ChartSample {
  readonly instant: Instant;
  readonly apparentElevationDeg: number;
  readonly geometricElevationDeg: number;
  readonly azimuthDeg: number | null;
  readonly isAzimuthIndeterminate: boolean;
  readonly phase: string;
}

interface ChartEventMarker {
  readonly eventName: SolarEventName;
  readonly instant: Instant;
  readonly label: string;
}

export const SolarCurve: React.FC<SolarCurveProps> = ({ state }) => {
  const {
    activeInstant,
    selectedPlace,
    searchWindow,
    solarPosition,
    setActiveInstant,
  } = state;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [showAzimuth, setShowAzimuth] = useState<boolean>(false);
  const [showGeometric, setShowGeometric] = useState<boolean>(true);
  const [hoverData, setHoverData] = useState<{
    x: number;
    y: number;
    instant: Instant;
    elevation: number;
    phase: string;
  } | null>(null);

  const isDraggingRef = useRef<boolean>(false);

  // 1. Compute horizon dip threshold for observer elevation
  const horizonDipDeg = (1.76 / 60) * Math.sqrt(Math.max(0, selectedPlace.elevationMeters ?? 0));
  const effectiveDaylightThresholdDeg = -0.833333 - horizonDipDeg;

  // 2. High-frequency curve sampling using lightweight evaluatePosition
  const samples = useMemo<ChartSample[]>(() => {
    const numSamples = 240; // High resolution without lagging
    const windowStartNs = searchWindow.start.epochNanoseconds;
    const windowEndNs = searchWindow.end.epochNanoseconds;
    const totalNs = windowEndNs - windowStartNs;

    const result: ChartSample[] = [];

    for (let i = 0; i <= numSamples; i++) {
      const frac = i / numSamples;
      const sampleNs = windowStartNs + BigInt(Math.round(frac * Number(totalNs)));
      const sampleInstant = Time.instant(sampleNs);

      const pos = Time.solar.evaluatePosition(sampleInstant, selectedPlace);

      result.push({
        instant: sampleInstant,
        apparentElevationDeg: pos.elevationDeg,
        geometricElevationDeg: pos.geometricElevationDeg,
        azimuthDeg: pos.azimuthDeg,
        isAzimuthIndeterminate: pos.isAzimuthIndeterminate,
        phase: pos.phase,
      });
    }

    return result;
  }, [searchWindow, selectedPlace]);

  // 3. Find discrete solar events within the search window
  const eventMarkers = useMemo<ChartEventMarker[]>(() => {
    const eventsToSearch: { name: SolarEventName; label: string }[] = [
      { name: 'sunrise', label: 'Sunrise' },
      { name: 'sunset', label: 'Sunset' },
      { name: 'solarNoon', label: 'Noon' },
      { name: 'solarMidnight', label: 'Midnight' },
    ];

    const markers: ChartEventMarker[] = [];

    for (const { name, label } of eventsToSearch) {
      let currentAfter = searchWindow.start;
      // Search up to 7 successive occurrences across multi-day windows
      for (let i = 0; i < 7; i++) {
        const eventInstant = Time.solar.nextEvent({
          event: name,
          place: selectedPlace,
          after: currentAfter,
        });

        if (!eventInstant || eventInstant.isAfter(searchWindow.end)) {
          break;
        }

        markers.push({
          eventName: name,
          instant: eventInstant,
          label,
        });

        // Advance 1 minute to find the next occurrence
        currentAfter = eventInstant.add(Time.duration.minutes(1));
      }
    }

    return markers;
  }, [searchWindow, selectedPlace]);

  // 4. Render chart onto Canvas
  const renderChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const setup = setupHighDpiCanvas(canvas);
    if (!setup) {
      return;
    }

    const { ctx, width, height } = setup;
    const padTop = 24;
    const padBottom = 28;
    const padLeft = 46;
    const padRight = 16;
    const plotWidth = width - padLeft - padRight;

    // Clear background
    ctx.fillStyle = THEME.surfacePrimary;
    ctx.fillRect(0, 0, width, height);

    // Draw Twilight Background Bands
    // 1. Day band: >= effectiveDaylightThresholdDeg up to +90°
    const yTop = padTop;
    const yDayHorizon = elevationToY(effectiveDaylightThresholdDeg, height, padTop, padBottom);
    const yCivil = elevationToY(-6, height, padTop, padBottom);
    const yNautical = elevationToY(-12, height, padTop, padBottom);
    const yAstronomical = elevationToY(-18, height, padTop, padBottom);
    const yBottom = height - padBottom;

    // Day
    ctx.fillStyle = getSolarPhaseBandRgba('day');
    ctx.fillRect(padLeft, yTop, plotWidth, Math.max(0, yDayHorizon - yTop));

    // Civil Twilight
    ctx.fillStyle = getSolarPhaseBandRgba('civil_twilight');
    ctx.fillRect(padLeft, yDayHorizon, plotWidth, Math.max(0, yCivil - yDayHorizon));

    // Nautical Twilight
    ctx.fillStyle = getSolarPhaseBandRgba('nautical_twilight');
    ctx.fillRect(padLeft, yCivil, plotWidth, Math.max(0, yNautical - yCivil));

    // Astronomical Twilight
    ctx.fillStyle = getSolarPhaseBandRgba('astronomical_twilight');
    ctx.fillRect(padLeft, yNautical, plotWidth, Math.max(0, yAstronomical - yNautical));

    // Night
    ctx.fillStyle = getSolarPhaseBandRgba('night');
    ctx.fillRect(padLeft, yAstronomical, plotWidth, Math.max(0, yBottom - yAstronomical));

    // Draw Horizontal Grid Lines & Elevation Labels
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.fillStyle = THEME.textMuted;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    const elevationTicks = [90, 60, 30, 0, -30, -60, -90];
    for (const deg of elevationTicks) {
      const y = elevationToY(deg, height, padTop, padBottom);
      ctx.strokeStyle = deg === 0 ? '#334155' : 'rgba(35, 47, 74, 0.4)';
      ctx.lineWidth = deg === 0 ? 1.5 : 1;
      ctx.setLineDash(deg === 0 ? [] : [2, 4]);

      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();

      ctx.fillText(`${deg}°`, padLeft - 8, y);
    }
    ctx.setLineDash([]);

    // Draw Apparent Horizon Line (effectiveDaylightThresholdDeg)
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padLeft, yDayHorizon);
    ctx.lineTo(width - padRight, yDayHorizon);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#f59e0b';
    ctx.textAlign = 'left';
    ctx.fillText(
      `Horizon (${effectiveDaylightThresholdDeg.toFixed(2)}°)`,
      padLeft + 8,
      yDayHorizon - 7
    );

    // Draw Geometric Elevation Curve (dashed gray if enabled)
    if (showGeometric && samples.length > 1) {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();

      samples.forEach((sample, idx) => {
        const x = padLeft + instantToPixel(sample.instant, searchWindow, plotWidth);
        const y = elevationToY(sample.geometricElevationDeg, height, padTop, padBottom);
        if (idx === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw Primary Apparent Elevation Curve (solid gold)
    if (samples.length > 1) {
      ctx.strokeStyle = THEME.solarDaylight;
      ctx.lineWidth = 2.5;
      ctx.beginPath();

      samples.forEach((sample, idx) => {
        const x = padLeft + instantToPixel(sample.instant, searchWindow, plotWidth);
        const y = elevationToY(sample.apparentElevationDeg, height, padTop, padBottom);
        if (idx === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
    }

    // Draw Azimuth Curve (optional, handling 0°/360° branch cut)
    if (showAzimuth && samples.length > 1) {
      ctx.strokeStyle = THEME.azimuth;
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      let lastAzimuth: number | null = null;
      let isDrawing = false;

      samples.forEach((sample) => {
        if (sample.isAzimuthIndeterminate || sample.azimuthDeg === null) {
          isDrawing = false;
          lastAzimuth = null;
          return;
        }

        const x = padLeft + instantToPixel(sample.instant, searchWindow, plotWidth);
        const y = azimuthToY(sample.azimuthDeg, height, padTop, padBottom);

        if (!isDrawing || lastAzimuth === null) {
          ctx.moveTo(x, y);
          isDrawing = true;
        } else {
          // Detect 0°/360° wraparound branch cut
          const delta = Math.abs(sample.azimuthDeg - lastAzimuth);
          if (delta > 180) {
            // Discontinuity: break stroke to prevent artificial vertical line
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        lastAzimuth = sample.azimuthDeg;
      });
      ctx.stroke();
    }

    // Draw Discrete Event Markers
    for (const marker of eventMarkers) {
      const x = padLeft + instantToPixel(marker.instant, searchWindow, plotWidth);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);

      ctx.beginPath();
      ctx.moveTo(x, padTop);
      ctx.lineTo(x, height - padBottom);
      ctx.stroke();

      ctx.fillStyle = THEME.textPrimary;
      ctx.textAlign = 'center';
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.fillText(marker.label, x, padTop - 6);
    }
    ctx.setLineDash([]);

    // Draw Active Instant Vertical Cursor (Cyan Scrubber)
    const activeX = padLeft + instantToPixel(activeInstant, searchWindow, plotWidth);
    ctx.strokeStyle = THEME.accentCyan;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(activeX, padTop - 12);
    ctx.lineTo(activeX, height - padBottom);
    ctx.stroke();

    // Scrubber Diamond Cap
    ctx.fillStyle = THEME.accentCyan;
    ctx.beginPath();
    ctx.arc(activeX, padTop - 10, 4, 0, Math.PI * 2);
    ctx.fill();

    // Time Axis Ticks at bottom
    ctx.fillStyle = THEME.textMuted;
    ctx.textAlign = 'center';
    ctx.font = '10px JetBrains Mono, monospace';

    const numTimeTicks = 6;
    for (let i = 0; i <= numTimeTicks; i++) {
      const frac = i / numTimeTicks;
      const x = padLeft + frac * plotWidth;
      const windowStartNs = searchWindow.start.epochNanoseconds;
      const windowEndNs = searchWindow.end.epochNanoseconds;
      const tickNs = windowStartNs + BigInt(Math.round(frac * Number(windowEndNs - windowStartNs)));
      const tickInstant = Time.instant(tickNs);
      const timeStr = tickInstant.toISOString().slice(11, 16);

      ctx.fillText(timeStr, x, height - 8);
    }
  }, [
    samples,
    eventMarkers,
    searchWindow,
    activeInstant,
    showGeometric,
    showAzimuth,
    effectiveDaylightThresholdDeg,
  ]);

  useEffect(() => {
    renderChart();
  }, [renderChart]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      renderChart();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [renderChart]);

  // Interactive Drag & Scrubbing
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    handlePointerMove(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const padLeft = 46;
    const padRight = 16;
    const plotWidth = rect.width - padLeft - padRight;
    const mouseX = e.clientX - rect.left - padLeft;

    if (isDraggingRef.current) {
      const newInstant = pixelToInstant(mouseX, searchWindow, plotWidth);
      setActiveInstant(newInstant);
    }

    // Tooltip data
    if (mouseX >= 0 && mouseX <= plotWidth) {
      const hoverInstant = pixelToInstant(mouseX, searchWindow, plotWidth);
      const pos = Time.solar.evaluatePosition(hoverInstant, selectedPlace);
      setHoverData({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        instant: hoverInstant,
        elevation: pos.elevationDeg,
        phase: pos.phase,
      });
    } else {
      setHoverData(null);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore release error if already released
    }
  };

  return (
    <div className="diagnostic-panel" ref={containerRef}>
      <div className="panel-header">
        <div className="panel-title-group">
          <span className="panel-title">Solar Elevation & Twilight Curve</span>
          <span className="panel-subtitle">
            h(t) Meeus / NOAA SPA (±{solarPosition.uncertaintyDeg.toFixed(3)}°)
          </span>
        </div>

        {/* View Toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            className={`btn-icon ${showGeometric ? 'active' : ''}`}
            onClick={() => setShowGeometric((prev) => !prev)}
            title="Toggle true geometric elevation curve"
          >
            Geometric
          </button>

          <button
            className={`btn-icon ${showAzimuth ? 'active' : ''}`}
            onClick={() => setShowAzimuth((prev) => !prev)}
            title="Toggle solar azimuth [0°, 360°) curve"
          >
            Azimuth
          </button>
        </div>
      </div>

      <div className="panel-body" style={{ padding: '12px', position: 'relative' }}>
        <div className="chart-container">
          <canvas
            ref={canvasRef}
            className="chart-canvas"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={() => setHoverData(null)}
            style={{ cursor: 'ew-resize' }}
          />

          {/* Hover Tooltip */}
          {hoverData && (
            <div
              style={{
                position: 'absolute',
                left: `${Math.min(hoverData.x + 12, 500)}px`,
                top: `${Math.max(10, hoverData.y - 45)}px`,
                background: 'rgba(15, 20, 32, 0.95)',
                backdropFilter: 'blur(6px)',
                border: '1px solid var(--border-bright)',
                borderRadius: '6px',
                padding: '6px 10px',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: '#fff',
                pointerEvents: 'none',
                zIndex: 20,
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              }}
            >
              <div>{formatUtcIso(hoverData.instant).slice(11, 19)} UTC</div>
              <div style={{ color: THEME.solarDaylight }}>
                Elevation: {hoverData.elevation.toFixed(2)}°
              </div>
              <div style={{ color: THEME.accentCyan, textTransform: 'capitalize' }}>
                {hoverData.phase.replace('_', ' ')}
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="chart-legend">
          <div className="legend-item">
            <span className="legend-dot" style={{ background: THEME.solarDaylight }}></span>
            <span>Daylight (h &ge; {effectiveDaylightThresholdDeg.toFixed(2)}°)</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ background: THEME.civilTwilight }}></span>
            <span>Civil Twilight [-6°, -0.83°)</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ background: THEME.nauticalTwilight }}></span>
            <span>Nautical Twilight [-12°, -6°)</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ background: THEME.astronomicalTwilight }}></span>
            <span>Astronomical Twilight [-18°, -12°)</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ background: THEME.night }}></span>
            <span>Night (&lt; -18°)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
