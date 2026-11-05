/**
 * @file timeline.ts
 * Nanosecond-safe timeline mapping and transformation utilities.
 */

import { Time, Duration, Instant, Interval } from 'time-2.0';
import type { SearchWindowDuration } from '../types.js';

/**
 * Calculates the normalized fraction [0, 1] of an instant within a search window.
 * Uses bounded relative nanosecond difference to preserve safe integer precision.
 */
export function getTimelineFraction(instant: Instant, searchWindow: Interval): number {
  const windowNs = searchWindow.end.epochNanoseconds - searchWindow.start.epochNanoseconds;
  if (windowNs <= 0n) {
    return 0;
  }
  const relNs = instant.epochNanoseconds - searchWindow.start.epochNanoseconds;
  const fraction = Number(relNs) / Number(windowNs);
  return Math.max(0, Math.min(1, fraction));
}

/**
 * Maps an Instant to an X pixel coordinate within a given container width.
 */
export function instantToPixel(instant: Instant, searchWindow: Interval, width: number): number {
  if (width <= 0) {
    return 0;
  }
  const fraction = getTimelineFraction(instant, searchWindow);
  return fraction * width;
}

/**
 * Maps an X pixel coordinate back to a physical TIME 2.0 Instant within the search window.
 */
export function pixelToInstant(pixelX: number, searchWindow: Interval, width: number): Instant {
  if (width <= 0) {
    return searchWindow.start;
  }
  const clampedX = Math.max(0, Math.min(width, pixelX));
  const fraction = clampedX / width;
  const windowNs = searchWindow.end.epochNanoseconds - searchWindow.start.epochNanoseconds;
  const offsetNs = BigInt(Math.round(fraction * Number(windowNs)));
  return Time.instant(searchWindow.start.epochNanoseconds + offsetNs);
}

/**
 * Converts a half-open Interval [start, end) into a pixel bounding box [startX, endX].
 */
export function intervalToPixelRange(
  interval: Interval,
  searchWindow: Interval,
  width: number
): { startX: number; endX: number; width: number } {
  const startX = instantToPixel(interval.start, searchWindow, width);
  const endX = instantToPixel(interval.end, searchWindow, width);
  const clampedStartX = Math.max(0, Math.min(width, startX));
  const clampedEndX = Math.max(0, Math.min(width, endX));
  const span = Math.max(1, clampedEndX - clampedStartX);
  return {
    startX: clampedStartX,
    endX: clampedEndX,
    width: span,
  };
}

/**
 * Creates a canonical search window Interval anchored to an active instant.
 * Centers the active instant or anchors it to the start of the current civil day.
 */
export function createSearchWindow(
  anchor: Instant,
  duration: SearchWindowDuration,
  mode: 'centered' | 'anchored' = 'centered'
): Interval {
  let dur: Duration;
  switch (duration) {
    case '24h':
      dur = Time.duration.hours(24);
      break;
    case '48h':
      dur = Time.duration.hours(48);
      break;
    case '7d':
      dur = Time.duration.days(7);
      break;
    default:
      dur = Time.duration.hours(24);
  }

  if (mode === 'anchored') {
    return Time.interval(anchor, anchor.add(dur));
  }

  // Centered mode: half duration before anchor, half after
  const halfNs = dur.nanoseconds / 2n;
  const halfDur = Time.duration.nanoseconds(halfNs);
  const start = anchor.subtract(halfDur);
  const end = anchor.add(halfDur);
  return Time.interval(start, end);
}

/**
 * Formats an Instant into human-readable UTC ISO representation with millisecond precision.
 */
export function formatUtcIso(instant: Instant): string {
  return instant.toISOString();
}

/**
 * Formats an Instant into local civil representation if a timeZoneId is provided.
 */
export function formatCivilDateTime(instant: Instant, timeZoneId?: string): string {
  if (!timeZoneId) {
    return 'UTC (No Timezone)';
  }
  try {
    const date = instant.toDate();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZoneId,
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZoneName: 'short',
    });
    return formatter.format(date);
  } catch {
    return 'Invalid Timezone';
  }
}

/**
 * Formats a Duration into human-readable hours, minutes, seconds.
 */
export function formatDurationFriendly(duration: Duration): string {
  const totalSecs = Math.abs(duration.totalSeconds);
  const hours = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  const parts: string[] = [];
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (mins > 0 || hours > 0) {
    parts.push(`${mins}m`);
  }
  parts.push(`${secs.toFixed(secs % 1 === 0 ? 0 : 1)}s`);
  return parts.join(' ');
}

/**
 * Formats latitude and longitude coordinates with cardinal suffixes.
 */
export function formatCoordinate(lat: number, lon: number): string {
  const latStr = `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}`;
  const lonStr = `${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? 'E' : 'W'}`;
  return `${latStr}, ${lonStr}`;
}
