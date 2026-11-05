/**
 * @file useTemporalState.ts
 * Central reactive temporal state coordinator and animation loop.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Time,
  Instant,
  Place,
  Interval,
  InstantaneousSolarPosition,
  SolarState,
  CivilState,
} from 'time-2.0';
import type { PlaybackSpeed, SearchWindowDuration, LocationPreset } from '../types.js';
import { LOCATION_PRESETS } from './presets.js';
import { createSearchWindow } from '../utils/timeline.js';

export interface TemporalStateHook {
  readonly activeInstant: Instant;
  readonly selectedPlace: Place;
  readonly selectedLocationPreset: LocationPreset | null;
  readonly searchWindowDuration: SearchWindowDuration;
  readonly searchWindow: Interval;
  readonly isPlaying: boolean;
  readonly playbackSpeed: PlaybackSpeed;
  readonly solarPosition: InstantaneousSolarPosition;
  readonly solarState: SolarState;
  readonly civilState: CivilState | null;

  // Actions
  setActiveInstant: (instant: Instant) => void;
  setSelectedPlace: (place: Place) => void;
  selectLocationPreset: (presetId: string) => void;
  setSearchWindowDuration: (duration: SearchWindowDuration) => void;
  setPlaybackSpeed: (speed: PlaybackSpeed) => void;
  togglePlay: () => void;
  play: () => void;
  pause: () => void;
  stepForward: (seconds?: number) => void;
  stepBackward: (seconds?: number) => void;
  resetToNow: () => void;
}

export function useTemporalState(): TemporalStateHook {
  // 1. Core reactive state
  const [activeInstant, setActiveInstantState] = useState<Instant>(() => Time.now());
  const [selectedPlace, setSelectedPlaceState] = useState<Place>(() => LOCATION_PRESETS[0]!.place);
  const [searchWindowDuration, setSearchWindowDuration] = useState<SearchWindowDuration>('24h');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(60);

  // Keep ref to avoid stale closures in requestAnimationFrame
  const activeInstantRef = useRef<Instant>(activeInstant);
  activeInstantRef.current = activeInstant;

  const playbackSpeedRef = useRef<PlaybackSpeed>(playbackSpeed);
  playbackSpeedRef.current = playbackSpeed;

  const isPlayingRef = useRef<boolean>(isPlaying);
  isPlayingRef.current = isPlaying;

  const lastFrameTimeRef = useRef<number | null>(null);

  // Controlled instant setter
  const setActiveInstant = useCallback((instant: Instant) => {
    activeInstantRef.current = instant;
    setActiveInstantState(instant);
  }, []);

  const setSelectedPlace = useCallback((place: Place) => {
    setSelectedPlaceState(place);
  }, []);

  const selectLocationPreset = useCallback((presetId: string) => {
    const found = LOCATION_PRESETS.find((p) => p.id === presetId);
    if (found) {
      setSelectedPlaceState(found.place);
    }
  }, []);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const play = useCallback(() => {
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const stepForward = useCallback((seconds = 3600) => {
    setActiveInstant(activeInstantRef.current.add(Time.duration.seconds(seconds)));
  }, [setActiveInstant]);

  const stepBackward = useCallback((seconds = 3600) => {
    setActiveInstant(activeInstantRef.current.subtract(Time.duration.seconds(seconds)));
  }, [setActiveInstant]);

  const resetToNow = useCallback(() => {
    setActiveInstant(Time.now());
  }, [setActiveInstant]);

  // Animation frame loop using elapsed wall-clock time
  useEffect(() => {
    if (!isPlaying) {
      lastFrameTimeRef.current = null;
      return;
    }

    let animationFrameId: number;

    const tick = (now: number) => {
      if (!isPlayingRef.current) {
        return;
      }

      if (lastFrameTimeRef.current !== null) {
        const deltaWallMs = now - lastFrameTimeRef.current;
        // Cap max delta to 200ms to avoid huge jumps on tab switch/lag
        const clampedDeltaMs = Math.min(200, Math.max(0, deltaWallMs));
        const speed = playbackSpeedRef.current;
        const deltaSimNs = BigInt(Math.round(clampedDeltaMs * 1_000_000 * speed));

        if (deltaSimNs > 0n) {
          const nextInstant = Time.instant(
            activeInstantRef.current.epochNanoseconds + deltaSimNs
          );
          activeInstantRef.current = nextInstant;
          setActiveInstantState(nextInstant);
        }
      }

      lastFrameTimeRef.current = now;
      animationFrameId = requestAnimationFrame(tick);
    };

    lastFrameTimeRef.current = performance.now();
    animationFrameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying]);

  // Derived state: Search Window
  const searchWindow = useMemo(() => {
    return createSearchWindow(activeInstant, searchWindowDuration, 'centered');
  }, [activeInstant, searchWindowDuration]);

  // Derived state: Selected Location Preset if any
  const selectedLocationPreset = useMemo(() => {
    return (
      LOCATION_PRESETS.find(
        (p) =>
          Math.abs(p.place.latitude - selectedPlace.latitude) < 1e-4 &&
          Math.abs(p.place.longitude - selectedPlace.longitude) < 1e-4
      ) ?? null
    );
  }, [selectedPlace]);

  // Derived state: High-frequency Instantaneous Solar Position
  const solarPosition = useMemo(() => {
    return Time.solar.evaluatePosition(activeInstant, selectedPlace);
  }, [activeInstant, selectedPlace]);

  // Derived state: Full Solar State with diurnal events
  const solarState = useMemo(() => {
    return Time.solar.evaluate(activeInstant, selectedPlace);
  }, [activeInstant, selectedPlace]);

  // Derived state: Civil State (only if timezone available)
  const civilState = useMemo(() => {
    if (!selectedPlace.timeZoneId) {
      return null;
    }
    try {
      return Time.civil.evaluate(activeInstant, selectedPlace);
    } catch {
      return null;
    }
  }, [activeInstant, selectedPlace]);

  return {
    activeInstant,
    selectedPlace,
    selectedLocationPreset,
    searchWindowDuration,
    searchWindow,
    isPlaying,
    playbackSpeed,
    solarPosition,
    solarState,
    civilState,
    setActiveInstant,
    setSelectedPlace,
    selectLocationPreset,
    setSearchWindowDuration,
    setPlaybackSpeed,
    togglePlay,
    play,
    pause,
    stepForward,
    stepBackward,
    resetToNow,
  };
}
