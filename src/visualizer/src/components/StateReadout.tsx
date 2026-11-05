/**
 * @file StateReadout.tsx
 * Scientific metrics card displaying exact TIME 2.0 astronomical and civil states.
 */

import React from 'react';
import type { TemporalStateHook } from '../state/useTemporalState.js';
import {
  getSolarPhaseColor,
  getPolarRegimeLabel,
  getPolarRegimeBadgeColor,
} from '../utils/canvas-renderers.js';
import { formatCoordinate } from '../utils/timeline.js';

interface StateReadoutProps {
  readonly state: TemporalStateHook;
}

export const StateReadout: React.FC<StateReadoutProps> = ({ state }) => {
  const { selectedPlace, solarPosition, solarState, civilState } = state;

  const azimuthDisplay = solarPosition.isAzimuthIndeterminate || solarPosition.azimuthDeg === null
    ? 'Indeterminate (Zenith/Pole)'
    : `${solarPosition.azimuthDeg.toFixed(2)}°`;

  const offsetHours = civilState ? civilState.utcOffsetMinutes / 60 : 0;
  const offsetStr = offsetHours >= 0 ? `+${offsetHours}` : `${offsetHours}`;

  return (
    <div className="diagnostic-panel">
      <div className="panel-header">
        <div className="panel-title-group">
          <span className="panel-title">Astronomical & Civil State</span>
        </div>
        <span className="panel-subtitle">
          {formatCoordinate(selectedPlace.latitude, selectedPlace.longitude)}
        </span>
      </div>

      <div className="panel-body">
        <div className="metrics-grid">
          {/* 1. Apparent Solar Elevation */}
          <div className="metric-box">
            <span className="metric-label">Apparent Elevation</span>
            <span className="metric-value text-gold">
              {solarPosition.elevationDeg.toFixed(3)}°
            </span>
            <span className="metric-sub">
              Refraction: +{solarPosition.atmosphericRefractionDeg.toFixed(3)}°
            </span>
          </div>

          {/* 2. Geometric Solar Elevation */}
          <div className="metric-box">
            <span className="metric-label">Geometric Elevation</span>
            <span className="metric-value">
              {solarPosition.geometricElevationDeg.toFixed(3)}°
            </span>
            <span className="metric-sub">Without atmospheric bending</span>
          </div>

          {/* 3. Solar Azimuth */}
          <div className="metric-box">
            <span className="metric-label">Solar Azimuth</span>
            <span className="metric-value text-cyan">{azimuthDisplay}</span>
            <span className="metric-sub">Zenith: {solarPosition.zenithDeg.toFixed(2)}°</span>
          </div>

          {/* 4. Solar Phase */}
          <div className="metric-box">
            <span className="metric-label">Instantaneous Phase</span>
            <span
              className="metric-value"
              style={{ color: getSolarPhaseColor(solarPosition.phase) }}
            >
              {solarPosition.phase.replace('_', ' ').toUpperCase()}
            </span>
            <span className="metric-sub">
              {solarPosition.isDirectSunlight ? 'Direct sunlight present' : 'Sun below optical horizon'}
            </span>
          </div>

          {/* 5. Diurnal Polar Regime */}
          <div className="metric-box">
            <span className="metric-label">Diurnal Polar Regime</span>
            <span
              className="metric-value"
              style={{ color: getPolarRegimeBadgeColor(solarState.polarRegime) }}
            >
              {getPolarRegimeLabel(solarState.polarRegime)}
            </span>
            <span className="metric-sub">Evaluated for diurnal cycle</span>
          </div>

          {/* 6. Declination & Hour Angle */}
          <div className="metric-box">
            <span className="metric-label">Declination / Hour Angle</span>
            <span className="metric-value">
              δ: {solarPosition.declinationDeg.toFixed(2)}° | H: {solarPosition.hourAngleDeg.toFixed(2)}°
            </span>
            <span className="metric-sub">
              EoT: {solarPosition.equationOfTimeMinutes.toFixed(2)} min | RA: {solarPosition.rightAscensionDeg.toFixed(1)}°
            </span>
          </div>

          {/* 7. Civil Time & DST */}
          <div className="metric-box">
            <span className="metric-label">Local Civil Time</span>
            <span className="metric-value text-cyan">
              {civilState
                ? `${String(civilState.hour).padStart(2, '0')}:${String(civilState.minute).padStart(2, '0')}:${String(civilState.second).padStart(2, '0')}`
                : 'No Timezone'}
            </span>
            <span className="metric-sub">
              {civilState
                ? `${civilState.timeZoneId} (UTC${offsetStr}h) | DST: ${civilState.isDaylightSaving ? 'Active' : 'Standard'}`
                : 'Explicit timezone required'}
            </span>
          </div>

          {/* 8. Model Accuracy & Uncertainty */}
          <div className="metric-box">
            <span className="metric-label">Model Uncertainty</span>
            <span className="metric-value">
              ±{solarPosition.uncertaintyDeg.toFixed(3)}°
            </span>
            <span className="metric-sub">
              Sensitivity: ±{solarPosition.uncertaintyMinutes.toFixed(2)} min (
              {solarPosition.isWithinValidityRange ? 'Meeus 1800-2100' : 'Degraded'}
              )
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
