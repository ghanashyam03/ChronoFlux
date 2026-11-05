/**
 * @file canvas-renderers.ts
 * Canvas 2D high-DPI rendering and color utilities for astronomical charts.
 */

import type { SolarPhase, PolarRegimeType } from '@chronoflux/core';

export const THEME = {
  bg: '#080b11',
  surfacePrimary: '#0f1420',
  surfaceSecondary: '#161e31',
  border: '#232f4a',
  textPrimary: '#f8fafc',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  accentCyan: '#38bdf8',
  solarDaylight: '#fbbf24',
  solarApparent: '#f59e0b',
  solarGeometric: '#94a3b8',
  civilTwilight: '#6366f1',
  nauticalTwilight: '#3b82f6',
  astronomicalTwilight: '#1e3a8a',
  night: '#0a0d18',
  azimuth: '#38bdf8',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
};

/**
 * Initializes a Canvas element with physical devicePixelRatio scaling to prevent blurriness.
 */
export function setupHighDpiCanvas(
  canvas: HTMLCanvasElement
): { ctx: CanvasRenderingContext2D; width: number; height: number; dpr: number } | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  if (rect.width === 0 || rect.height === 0) {
    return null;
  }

  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);

  ctx.resetTransform();
  ctx.scale(dpr, dpr);

  return { ctx, width: rect.width, height: rect.height, dpr };
}

/**
 * Maps an elevation in degrees [-90, +90] to canvas Y coordinate.
 */
export function elevationToY(
  elevationDeg: number,
  canvasHeight: number,
  paddingTop = 25,
  paddingBottom = 25
): number {
  const plotHeight = canvasHeight - paddingTop - paddingBottom;
  // Normalized: +90° = 0 (top), -90° = 1 (bottom)
  const norm = (90 - elevationDeg) / 180;
  const clampedNorm = Math.max(0, Math.min(1, norm));
  return paddingTop + clampedNorm * plotHeight;
}

/**
 * Maps an azimuth in degrees [0, 360] to canvas Y coordinate.
 */
export function azimuthToY(
  azimuthDeg: number,
  canvasHeight: number,
  paddingTop = 25,
  paddingBottom = 25
): number {
  const plotHeight = canvasHeight - paddingTop - paddingBottom;
  // 360° = top, 0° = bottom
  const norm = (360 - azimuthDeg) / 360;
  const clampedNorm = Math.max(0, Math.min(1, norm));
  return paddingTop + clampedNorm * plotHeight;
}

/**
 * Resolves styling color for a given SolarPhase.
 */
export function getSolarPhaseColor(phase: SolarPhase): string {
  switch (phase) {
    case 'day':
      return THEME.solarDaylight;
    case 'civil_twilight':
      return THEME.civilTwilight;
    case 'nautical_twilight':
      return THEME.nauticalTwilight;
    case 'astronomical_twilight':
      return THEME.astronomicalTwilight;
    case 'night':
      return THEME.night;
    default:
      return THEME.textMuted;
  }
}

/**
 * Resolves background band styling color for a given SolarPhase.
 */
export function getSolarPhaseBandRgba(phase: SolarPhase): string {
  switch (phase) {
    case 'day':
      return 'rgba(251, 191, 36, 0.12)';
    case 'civil_twilight':
      return 'rgba(99, 102, 241, 0.18)';
    case 'nautical_twilight':
      return 'rgba(59, 130, 246, 0.22)';
    case 'astronomical_twilight':
      return 'rgba(30, 58, 138, 0.30)';
    case 'night':
      return 'rgba(8, 11, 17, 0.65)';
    default:
      return 'rgba(8, 11, 17, 0.5)';
  }
}

/**
 * Resolves label for a given PolarRegimeType.
 */
export function getPolarRegimeLabel(regime: PolarRegimeType): string {
  switch (regime) {
    case 'polar_day':
      return 'Polar Day (Midnight Sun)';
    case 'polar_night':
      return 'Polar Night';
    case 'none':
      return 'Diurnal Cycle';
    default:
      return 'Standard';
  }
}

/**
 * Resolves color badge for a given PolarRegimeType.
 */
export function getPolarRegimeBadgeColor(regime: PolarRegimeType): string {
  switch (regime) {
    case 'polar_day':
      return THEME.solarApparent;
    case 'polar_night':
      return THEME.astronomicalTwilight;
    case 'none':
      return THEME.border;
    default:
      return THEME.border;
  }
}
