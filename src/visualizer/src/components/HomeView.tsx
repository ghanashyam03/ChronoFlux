/**
 * @file HomeView.tsx
 * Welcoming introductory view explaining TIME 2.0 simply for first-time visitors.
 */

import React, { useState, useMemo } from 'react';
import {
  Sun,
  Layers,
  Code,
  ArrowRight,
  Clock,
  Globe2,
  Sliders,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { Time } from 'time-2.0';
import { LOCATION_PRESETS } from '../state/presets.js';
import type { AppTab } from '../types.js';

interface HomeViewProps {
  readonly onNavigate: (tab: AppTab) => void;
  readonly onSelectLocation: (presetId: string) => void;
  readonly onOpenGlossary: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onNavigate,
  onSelectLocation,
  onOpenGlossary,
}) => {
  const [trialCityId, setTrialCityId] = useState<string>('new_york');

  const selectedPreset = useMemo(() => {
    return LOCATION_PRESETS.find((p) => p.id === trialCityId) ?? LOCATION_PRESETS[0]!;
  }, [trialCityId]);

  // Compute live today's solar metrics for the trial city using the real engine
  const liveStats = useMemo(() => {
    const now = Time.now();
    const place = selectedPreset.place;
    const solarState = Time.solar.evaluate(now, place);
    const pos = Time.solar.evaluatePosition(now, place);
    const civil = place.timeZoneId ? Time.civil.evaluate(now, place) : null;

    return {
      elevationDeg: pos.elevationDeg.toFixed(1),
      azimuthDeg: pos.azimuthDeg != null ? pos.azimuthDeg.toFixed(1) : 'N/A',
      phase: solarState.phase.replace('_', ' ').toUpperCase(),
      polarRegime: solarState.polarRegime.replace('_', ' ').toUpperCase(),
      sunrise: solarState.sunrise
        ? (place.timeZoneId ? Time.civil.evaluate(solarState.sunrise, place) : null)
        : null,
      sunset: solarState.sunset
        ? (place.timeZoneId ? Time.civil.evaluate(solarState.sunset, place) : null)
        : null,
      daylightMinutes:
        solarState.sunrise && solarState.sunset
          ? Math.round(
              Number(
                solarState.sunset.epochNanoseconds - solarState.sunrise.epochNanoseconds
              ) / 60_000_000_000
            )
          : null,
      localClock: civil
        ? `${String(civil.hour).padStart(2, '0')}:${String(civil.minute).padStart(2, '0')} ${civil.timeZoneId.split('/')[1]?.replace('_', ' ') ?? ''}`
        : 'UTC',
    };
  }, [selectedPreset]);

  return (
    <div className="space-y-12 py-4 max-w-6xl mx-auto">
      {/* 1. Hero Section */}
      <section className="text-center space-y-6 pt-4 pb-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold tracking-wide uppercase">
          <Sparkles className="w-3.5 h-3.5" />
          Introducing TIME 2.0
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-100 tracking-tight max-w-4xl mx-auto leading-tight">
          Find <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-indigo-300 to-indigo-400">when something happens</span> by combining time, location, and conditions.
        </h1>

        <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed font-normal">
          Tell TIME 2.0 what conditions you care about, choose a location and time range, and discover exactly when those conditions are satisfied.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <button
            onClick={() => onNavigate('explore')}
            className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all shadow-lg shadow-indigo-600/20 hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
          >
            <span>Explore Sunrise, Daylight & Seasons</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => onNavigate('visualize')}
            className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700/80 text-slate-200 font-medium text-sm transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
          >
            <Globe2 className="w-4 h-4 text-slate-400" />
            <span>Open 3D Diagnostic Visualizer</span>
          </button>

          <button
            onClick={() => onNavigate('build')}
            className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700/80 text-slate-200 font-medium text-sm transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
          >
            <Sliders className="w-4 h-4 text-slate-400" />
            <span>Build a Custom Time Condition</span>
          </button>
        </div>
      </section>

      {/* 2. Interactive "Try It Live" Card */}
      <section className="p-6 sm:p-8 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-wider">
              <Sun className="w-4 h-4" />
              Live Interactive Preview
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold text-slate-100 tracking-tight mt-1">
              What is the Sun doing right now in your city?
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Select any location to see real calculations executed live by the underlying engine.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label htmlFor="trial-city" className="text-xs text-slate-400 font-medium">
              Choose location:
            </label>
            <select
              id="trial-city"
              value={trialCityId}
              onChange={(e) => {
                setTrialCityId(e.target.value);
                onSelectLocation(e.target.value);
              }}
              className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            >
              {LOCATION_PRESETS.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}, {loc.country}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Live Calculation Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6">
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-xs font-medium text-slate-400 block mb-1">Local Civil Time</span>
            <span className="text-xl font-bold font-mono text-slate-100">{liveStats.localClock}</span>
            <span className="text-xs text-slate-500 block mt-1">Current wall-clock</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-xs font-medium text-slate-400 block mb-1">Current Sun Height</span>
            <span className="text-xl font-bold font-mono text-amber-300">{liveStats.elevationDeg}°</span>
            <span className="text-xs text-slate-500 block mt-1">
              {Number(liveStats.elevationDeg) >= 0 ? 'Above horizon' : 'Below horizon'}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-xs font-medium text-slate-400 block mb-1">Sky Lighting State</span>
            <span className="text-lg font-bold text-indigo-300">{liveStats.phase}</span>
            <span className="text-xs text-slate-500 block mt-1">
              {liveStats.polarRegime !== 'NONE' ? `Polar Regime: ${liveStats.polarRegime}` : 'Diurnal cycle'}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-xs font-medium text-slate-400 block mb-1">Total Daylight Today</span>
            <span className="text-xl font-bold font-mono text-emerald-300">
              {liveStats.daylightMinutes !== null
                ? `${Math.floor(liveStats.daylightMinutes / 60)}h ${liveStats.daylightMinutes % 60}m`
                : liveStats.polarRegime === 'POLAR_DAY'
                ? '24 hours (Midnight Sun)'
                : '0 hours (Polar Night)'}
            </span>
            <span className="text-xs text-slate-500 block mt-1">Sunrise to sunset span</span>
          </div>
        </div>

        <div className="mt-6 p-4 rounded-xl bg-indigo-950/20 border border-indigo-800/30 flex items-center justify-between flex-wrap gap-3">
          <p className="text-xs sm:text-sm text-indigo-200">
            <strong>How this works:</strong> TIME 2.0 computed the exact solar elevation and sunset time for {selectedPreset.name} using real NOAA astronomical ephemeris equations accurate to within 0.02 degrees.
          </p>
          <button
            onClick={() => onNavigate('explore')}
            className="text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 whitespace-nowrap"
          >
            <span>Learn how to ask deeper questions</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      {/* 3. Designed for Every User */}
      <section className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
            Designed for Beginners, Students, and Engineers
          </h2>
          <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto">
            The complexity lives inside the engine. The experience presented to you remains simple.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Ordinary User */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                <Sun className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-slate-100">Everyday Questions</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Find what time the Sun rises, how long daylight lasts, when twilight ends, and how day length shifts across seasons.
              </p>
            </div>
            <button
              onClick={() => onNavigate('explore')}
              className="mt-6 w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Explore Guided Questions</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Card 2: Visual Diagnostic & Researcher */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                <Globe2 className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-slate-100">Visual Diagnostics</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Interact with the 3D illuminated Earth globe, inspect diurnal elevation curves with twilight zones, and compare global timelines.
              </p>
            </div>
            <button
              onClick={() => onNavigate('visualize')}
              className="mt-6 w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Launch 3D Visualizer</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Card 3: Software Developer */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                <Code className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-slate-100">Software Developer SDK</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Zero dependencies. Compose declarative queries with Allen interval algebra, microdegree root solving, and verified provenance.
              </p>
            </div>
            <button
              onClick={() => onNavigate('docs')}
              className="mt-6 w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Read Developer Docs</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* 4. Architectural Foundations */}
      <section className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-slate-100 tracking-tight">Four Engineering Pillars</h2>
          <p className="text-sm text-slate-400">
            Built from mathematical first principles with zero runtime production dependencies.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
              <Clock className="w-4 h-4" />
              <span>Nanosecond Precision</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              64-bit integer nanosecond timeline relative to Unix epoch (± 100M days), eliminating floating-point drift.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
              <Sun className="w-4 h-4" />
              <span>Solar Ephemeris</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Meeus/NOAA solar mechanics with Bennett atmospheric refraction and geometric horizon dip ($&lt; 0.02^\circ$ error).
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
              <Calendar className="w-4 h-4" />
              <span>Civil Calendar & DST</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Deterministic IANA timezone conversions with disambiguation across fall-back repeated hours and spring gaps.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-purple-400 font-semibold text-sm">
              <Layers className="w-4 h-4" />
              <span>Condition Resolver</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Continuous Brent-Dekker root finding with residual verification (&lt; 10⁻⁵°) and full mathematical provenance.
            </p>
          </div>
        </div>

        <div className="text-center pt-4">
          <button
            onClick={onOpenGlossary}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium underline underline-offset-4"
          >
            Need help with any terminology? Open the Plain-Language Glossary &rarr;
          </button>
        </div>
      </section>
    </div>
  );
};
