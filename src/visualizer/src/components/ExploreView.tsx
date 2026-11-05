/**
 * @file ExploreView.tsx
 * Simple Mode guided 4-step exploration workflow and 6 interactive engine questions.
 */

import React, { useState, useMemo } from 'react';
import {
  Sun,
  Moon,
  Sparkles,
  ArrowRight,
  HelpCircle,
  Eye,
  Sunset,
  Sunrise,
  Layers,
  Info,
} from 'lucide-react';
import { Time, Instant } from 'time-2.0';
import { LOCATION_PRESETS, DATE_PRESETS, INTERACTIVE_QUESTIONS } from '../state/presets.js';
import type { InteractiveQuestion } from '../types.js';

interface ExploreViewProps {
  readonly onOpenGlossary: () => void;
  readonly onNavigateToVisualizer: () => void;
}

type QuestionCategory =
  | 'sunrise_sunset'
  | 'daylight_duration'
  | 'twilights'
  | 'darkness'
  | 'comparison'
  | 'sun_motion';

export const ExploreView: React.FC<ExploreViewProps> = ({
  onOpenGlossary,
  onNavigateToVisualizer,
}) => {
  // 1. Wizard State
  const [selectedCategory, setSelectedCategory] = useState<QuestionCategory>('sunrise_sunset');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('new_york');
  const [selectedCompareLocationId, setSelectedCompareLocationId] = useState<string>('tromso');
  const [selectedDatePresetId, setSelectedDatePresetId] = useState<string>('summer_solstice');
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);

  // Active location preset
  const locationPreset = useMemo(() => {
    return LOCATION_PRESETS.find((p) => p.id === selectedLocationId) ?? LOCATION_PRESETS[0]!;
  }, [selectedLocationId]);

  const compareLocationPreset = useMemo(() => {
    return LOCATION_PRESETS.find((p) => p.id === selectedCompareLocationId) ?? LOCATION_PRESETS[1]!;
  }, [selectedCompareLocationId]);

  // Active date preset
  const datePreset = useMemo(() => {
    return DATE_PRESETS.find((p) => p.id === selectedDatePresetId) ?? DATE_PRESETS[0]!;
  }, [selectedDatePresetId]);

  // Calculate live results using the real Time engine
  const calculationResults = useMemo(() => {
    const instant = datePreset.instant;
    const place = locationPreset.place;
    const solarState = Time.solar.evaluate(instant, place);
    const solarPos = Time.solar.evaluatePosition(instant, place);
    const civil = place.timeZoneId ? Time.civil.evaluate(instant, place) : null;

    // Format solar events
    const formatEvent = (evtInstant: Instant | null) => {
      if (!evtInstant) return null;
      if (!place.timeZoneId) return evtInstant.toISOString();
      const c = Time.civil.evaluate(evtInstant, place);
      const ampm = c.hour >= 12 ? 'PM' : 'AM';
      const h12 = c.hour % 12 === 0 ? 12 : c.hour % 12;
      return `${String(h12).padStart(2, '0')}:${String(c.minute).padStart(2, '0')}:${String(c.second).padStart(2, '0')} ${ampm} ${c.timeZoneId.split('/')[1]?.replace('_', ' ') ?? ''}`;
    };

    // Calculate daylight duration
    let daylightMinutes = 0;
    if (solarState.sunrise && solarState.sunset) {
      const durNs = solarState.sunset.epochNanoseconds - solarState.sunrise.epochNanoseconds;
      daylightMinutes = Math.max(0, Math.round(Number(durNs) / 60_000_000_000));
    } else if (solarState.polarRegime === 'polar_day') {
      daylightMinutes = 24 * 60;
    } else if (solarState.polarRegime === 'polar_night') {
      daylightMinutes = 0;
    }

    // Secondary location calculations if in comparison mode
    let compareDaylightMinutes = 0;
    let compareState = null;
    if (selectedCategory === 'comparison') {
      compareState = Time.solar.evaluate(instant, compareLocationPreset.place);
      if (compareState.sunrise && compareState.sunset) {
        const durNs = compareState.sunset.epochNanoseconds - compareState.sunrise.epochNanoseconds;
        compareDaylightMinutes = Math.max(0, Math.round(Number(durNs) / 60_000_000_000));
      } else if (compareState.polarRegime === 'polar_day') {
        compareDaylightMinutes = 24 * 60;
      }
    }

    // Twilight events via nextEvent
    const civilDawn = Time.solar.nextEvent({ event: 'civilDawn', after: instant, place });
    const civilDusk = Time.solar.nextEvent({ event: 'civilDusk', after: instant, place });
    const nauticalDawn = Time.solar.nextEvent({ event: 'nauticalDawn', after: instant, place });
    const nauticalDusk = Time.solar.nextEvent({ event: 'nauticalDusk', after: instant, place });
    const astronomicalDawn = Time.solar.nextEvent({ event: 'astronomicalDawn', after: instant, place });
    const astronomicalDusk = Time.solar.nextEvent({ event: 'astronomicalDusk', after: instant, place });

    return {
      place,
      solarState,
      solarPos,
      civil,
      sunriseFormatted: formatEvent(solarState.sunrise),
      sunsetFormatted: formatEvent(solarState.sunset),
      noonFormatted: formatEvent(solarState.solarNoon),
      midnightFormatted: formatEvent(solarState.solarMidnight),
      civilDawnFormatted: formatEvent(civilDawn),
      civilDuskFormatted: formatEvent(civilDusk),
      nauticalDawnFormatted: formatEvent(nauticalDawn),
      nauticalDuskFormatted: formatEvent(nauticalDusk),
      astronomicalDawnFormatted: formatEvent(astronomicalDawn),
      astronomicalDuskFormatted: formatEvent(astronomicalDusk),
      daylightHours: Math.floor(daylightMinutes / 60),
      daylightRemainingMinutes: daylightMinutes % 60,
      totalDaylightMinutes: daylightMinutes,
      compareDaylightHours: Math.floor(compareDaylightMinutes / 60),
      compareDaylightRemainingMinutes: compareDaylightMinutes % 60,
      compareState,
    };
  }, [locationPreset, compareLocationPreset, datePreset, selectedCategory]);

  // Handle clicking one of the 6 Interactive Questions
  const handleApplyQuestion = (q: InteractiveQuestion) => {
    setSelectedQuestionId(q.id);
    setSelectedLocationId(q.locationId);
    if (q.datePresetId) {
      setSelectedDatePresetId(q.datePresetId);
    }
    if (q.questionType === 'sunrise_sunset') setSelectedCategory('sunrise_sunset');
    else if (q.questionType === 'daylight_duration') setSelectedCategory('daylight_duration');
    else if (q.questionType === 'darkness') setSelectedCategory('darkness');
    else if (q.questionType === 'comparison') setSelectedCategory('comparison');
    else if (q.questionType === 'polar') setSelectedCategory('sunrise_sunset');
    else if (q.questionType === 'seasons') setSelectedCategory('daylight_duration');
  };

  return (
    <div className="space-y-10 py-2 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-slate-900 border border-slate-800">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400 block mb-1">
            Simple Mode &bull; Guided Time Exploration
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
            Explore Sunlight, Darkness & Daily Time Cycles
          </h1>
          <p className="text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Answer everyday questions about daylight, twilights, and solar positions in 4 simple steps. No prior astronomy or programming knowledge needed.
          </p>
        </div>

        <button
          onClick={onOpenGlossary}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-2 self-start md:self-auto transition-colors"
        >
          <HelpCircle className="w-4 h-4 text-indigo-400" />
          <span>Plain-Language Glossary</span>
        </button>
      </div>

      {/* 6 Clickable Real-Engine Interactive Questions */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Interactive Real-Engine Questions (Click to Solve)</span>
          </h2>
          <span className="text-xs text-slate-400">All 6 questions calculated live</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {INTERACTIVE_QUESTIONS.map((q) => {
            const isSelected = selectedQuestionId === q.id;
            return (
              <button
                key={q.id}
                onClick={() => handleApplyQuestion(q)}
                className={`p-4 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between ${
                  isSelected
                    ? 'bg-indigo-950/40 border-indigo-500 shadow-md ring-1 ring-indigo-500/30'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">{q.title}</h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {q.subtitle}
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-indigo-400 pt-2 border-t border-slate-800/80">
                  <span className="capitalize">{q.questionType.replace('_', ' ')}</span>
                  <span className="font-semibold flex items-center gap-1">
                    Calculate &rarr;
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 4-Step Guided Workflow */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Steps 1, 2, 3 (Inputs) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Step 1 */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                1
              </span>
              <h3 className="text-sm font-semibold text-slate-100">What would you like to explore?</h3>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              {[
                { id: 'sunrise_sunset', label: 'Sunrise & Sunset', icon: Sunrise },
                { id: 'daylight_duration', label: 'Daylight Length', icon: Sun },
                { id: 'twilights', label: 'Twilight Periods', icon: Sunset },
                { id: 'darkness', label: 'Dark Sky / Stars', icon: Moon },
                { id: 'comparison', label: 'Compare 2 Cities', icon: Layers },
                { id: 'sun_motion', label: 'Sun Position (Height)', icon: Eye },
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = selectedCategory === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSelectedCategory(item.id as QuestionCategory);
                      setSelectedQuestionId(null);
                    }}
                    className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all text-xs font-medium ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                  2
                </span>
                <h3 className="text-sm font-semibold text-slate-100">Choose a location</h3>
              </div>
              <span className="text-[11px] text-slate-400">Earth location</span>
            </div>

            <div className="space-y-2">
              <select
                value={selectedLocationId}
                onChange={(e) => {
                  setSelectedLocationId(e.target.value);
                  setSelectedQuestionId(null);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                {LOCATION_PRESETS.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}, {loc.country} ({loc.place.latitude > 0 ? `${loc.place.latitude}°N` : `${Math.abs(loc.place.latitude)}°S`})
                  </option>
                ))}
              </select>

              {selectedCategory === 'comparison' && (
                <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                  <label className="text-xs text-indigo-400 font-medium">Compare against second city:</label>
                  <select
                    value={selectedCompareLocationId}
                    onChange={(e) => setSelectedCompareLocationId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    {LOCATION_PRESETS.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}, {loc.country} ({loc.place.latitude > 0 ? `${loc.place.latitude}°N` : `${Math.abs(loc.place.latitude)}°S`})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Plain language explanation of why location matters */}
              <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800 text-[11px] text-slate-400 leading-relaxed flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Why location matters:</strong> Latitude determines how high the Sun rises and how drastically day length changes across seasons. Longitude and your timezone determine what your clock reads when the Sun peaks at noon.
                </span>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                  3
                </span>
                <h3 className="text-sm font-semibold text-slate-100">Choose a date / season</h3>
              </div>
              <span className="text-[11px] text-slate-400">Earth season</span>
            </div>

            <div className="space-y-2">
              <select
                value={selectedDatePresetId}
                onChange={(e) => {
                  setSelectedDatePresetId(e.target.value);
                  setSelectedQuestionId(null);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                {DATE_PRESETS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} &bull; {d.description}
                  </option>
                ))}
              </select>

              <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800 text-[11px] text-slate-400 leading-relaxed flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Why dates matter:</strong> Earth is tilted at 23.44°. As Earth orbits the Sun, the tilt shifts which hemisphere receives direct sunlight. In June, the Northern Hemisphere gets long days; in December, the Southern Hemisphere gets long days.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Step 4 (Results Calculated Live) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
                  4
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-100">Calculated Answer</h3>
                  <span className="text-xs text-slate-400">
                    Results for {locationPreset.name} on {datePreset.name}
                  </span>
                </div>
              </div>

              <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">
                Verified Engine Result
              </span>
            </div>

            {/* Answer Display based on Selected Exploration Category */}
            {selectedCategory === 'sunrise_sunset' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-5 rounded-xl bg-slate-950/80 border border-amber-500/30">
                    <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold uppercase">
                      <Sunrise className="w-4 h-4" />
                      Sunrise
                    </div>
                    <div className="text-2xl font-bold font-mono text-slate-100 mt-2">
                      {calculationResults.sunriseFormatted ?? 'No Sunrise (Polar Regime)'}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Moment the upper limb of the Sun breaks the horizon.
                    </p>
                  </div>

                  <div className="p-5 rounded-xl bg-slate-950/80 border border-indigo-500/30">
                    <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase">
                      <Sunset className="w-4 h-4" />
                      Sunset
                    </div>
                    <div className="text-2xl font-bold font-mono text-slate-100 mt-2">
                      {calculationResults.sunsetFormatted ?? 'No Sunset (Polar Regime)'}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Moment the upper limb of the Sun sinks below the horizon.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 text-xs text-slate-300 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Solar Noon (Sun at peak height):</span>
                    <span className="font-mono text-slate-200">{calculationResults.noonFormatted ?? 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Solar Midnight (Sun at lowest point):</span>
                    <span className="font-mono text-slate-200">{calculationResults.midnightFormatted ?? 'N/A'}</span>
                  </div>
                </div>
              </div>
            )}

            {selectedCategory === 'daylight_duration' && (
              <div className="space-y-6">
                <div className="p-6 rounded-xl bg-gradient-to-br from-amber-950/30 via-slate-950/80 to-slate-950 border border-amber-500/30 text-center space-y-2">
                  <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                    Total Daylight Available
                  </span>
                  <div className="text-4xl sm:text-5xl font-extrabold font-mono text-amber-300">
                    {calculationResults.daylightHours}h {calculationResults.daylightRemainingMinutes}m
                  </div>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    {calculationResults.totalDaylightMinutes === 1440
                      ? 'The Sun stays above the horizon for all 24 hours (Midnight Sun).'
                      : calculationResults.totalDaylightMinutes === 0
                      ? 'The Sun never rises above the horizon today (Polar Night).'
                      : `From sunrise at ${calculationResults.sunriseFormatted?.split(' ')[0]} until sunset at ${calculationResults.sunsetFormatted?.split(' ')[0]}.`}
                  </p>
                </div>

                {/* Daylight progress bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Daylight Fraction of 24 Hours:</span>
                    <span className="font-mono text-slate-200">
                      {((calculationResults.totalDaylightMinutes / 1440) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-4 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800 flex">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-500"
                      style={{ width: `${(calculationResults.totalDaylightMinutes / 1440) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {selectedCategory === 'twilights' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-300 leading-relaxed">
                  <strong>Twilight</strong> is the natural light scattering in the upper atmosphere when the Sun is just below the horizon.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-sky-500/30">
                    <h4 className="text-xs font-semibold text-sky-400">Civil Twilight</h4>
                    <span className="text-[11px] text-slate-400 block mt-0.5">Sun 0° to -6°</span>
                    <div className="mt-2 text-xs text-slate-200 space-y-1">
                      <div>Dawn: <span className="font-mono">{calculationResults.civilDawnFormatted?.split(' ')[0] ?? 'N/A'}</span></div>
                      <div>Dusk: <span className="font-mono">{calculationResults.civilDuskFormatted?.split(' ')[0] ?? 'N/A'}</span></div>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-2 block">Enough light for outdoor sports & walking without lamps.</span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950/60 border border-blue-500/30">
                    <h4 className="text-xs font-semibold text-blue-400">Nautical Twilight</h4>
                    <span className="text-[11px] text-slate-400 block mt-0.5">Sun -6° to -12°</span>
                    <div className="mt-2 text-xs text-slate-200 space-y-1">
                      <div>Dawn: <span className="font-mono">{calculationResults.nauticalDawnFormatted?.split(' ')[0] ?? 'N/A'}</span></div>
                      <div>Dusk: <span className="font-mono">{calculationResults.nauticalDuskFormatted?.split(' ')[0] ?? 'N/A'}</span></div>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-2 block">Horizon is visible at sea; bright stars appear.</span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950/60 border border-indigo-500/30">
                    <h4 className="text-xs font-semibold text-indigo-400">Astronomical Twilight</h4>
                    <span className="text-[11px] text-slate-400 block mt-0.5">Sun -12° to -18°</span>
                    <div className="mt-2 text-xs text-slate-200 space-y-1">
                      <div>Dawn: <span className="font-mono">{calculationResults.astronomicalDawnFormatted?.split(' ')[0] ?? 'N/A'}</span></div>
                      <div>Dusk: <span className="font-mono">{calculationResults.astronomicalDuskFormatted?.split(' ')[0] ?? 'N/A'}</span></div>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-2 block">Sky appears fully dark to casual eye; faint glow for telescopes.</span>
                  </div>
                </div>
              </div>
            )}

            {selectedCategory === 'darkness' && (
              <div className="space-y-4">
                <div className="p-5 rounded-xl bg-slate-950 border border-indigo-800/40 text-center space-y-2">
                  <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                    Complete Night Sky Darkness
                  </span>
                  <div className="text-3xl font-extrabold font-mono text-indigo-300">
                    {calculationResults.astronomicalDuskFormatted
                      ? `${calculationResults.astronomicalDuskFormatted.split(' ')[0]} → ${calculationResults.astronomicalDawnFormatted?.split(' ')[0] ?? 'Dawn'}`
                      : 'No Full Darkness Today'}
                  </div>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    During this window, the Sun is below -18° (Astronomical Twilight has ended). The sky has zero natural sunlight scatter, making it optimal for stargazing and astrophotography.
                  </p>
                </div>
              </div>
            )}

            {selectedCategory === 'comparison' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center">
                    <h4 className="text-sm font-semibold text-slate-200">{locationPreset.name}</h4>
                    <span className="text-xs text-slate-400">{locationPreset.country}</span>
                    <div className="text-2xl font-bold font-mono text-amber-300 mt-2">
                      {calculationResults.daylightHours}h {calculationResults.daylightRemainingMinutes}m
                    </div>
                    <span className="text-[11px] text-slate-500 mt-1 block">Daylight length</span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center">
                    <h4 className="text-sm font-semibold text-slate-200">{compareLocationPreset.name}</h4>
                    <span className="text-xs text-slate-400">{compareLocationPreset.country}</span>
                    <div className="text-2xl font-bold font-mono text-indigo-300 mt-2">
                      {calculationResults.compareDaylightHours}h {calculationResults.compareDaylightRemainingMinutes}m
                    </div>
                    <span className="text-[11px] text-slate-500 mt-1 block">Daylight length</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300 leading-relaxed">
                  <strong>Comparison Takeaway:</strong> On {datePreset.name},{' '}
                  {calculationResults.totalDaylightMinutes > (calculationResults.compareDaylightHours * 60 + calculationResults.compareDaylightRemainingMinutes)
                    ? `${locationPreset.name} enjoys ${Math.abs(calculationResults.daylightHours - calculationResults.compareDaylightHours)} more hours of sunlight than ${compareLocationPreset.name} because of Earth's tilt.`
                    : `${compareLocationPreset.name} enjoys more sunlight than ${locationPreset.name}.`}
                </div>
              </div>
            )}

            {selectedCategory === 'sun_motion' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-xs text-slate-400">Current Elevation</span>
                    <div className="text-3xl font-bold font-mono text-amber-300 mt-1">
                      {calculationResults.solarPos.elevationDeg.toFixed(2)}°
                    </div>
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      {calculationResults.solarPos.elevationDeg >= 0 ? 'Above horizon' : 'Below horizon'}
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-xs text-slate-400">Current Compass Direction</span>
                    <div className="text-3xl font-bold font-mono text-indigo-300 mt-1">
                      {calculationResults.solarPos.azimuthDeg != null ? `${calculationResults.solarPos.azimuthDeg.toFixed(1)}°` : 'Indeterminate'}
                    </div>
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      Clockwise from North (Azimuth)
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  Want to see the entire 24-hour arc rendered smoothly with an interactive timeline scrubber? Launch the 3D Diagnostic Visualizer below.
                </p>
              </div>
            )}

            {/* Link to advanced visualization */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">Want to see the full mathematical chart and 3D globe?</span>
              <button
                onClick={onNavigateToVisualizer}
                className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5"
              >
                <span>Launch 3D Diagnostic View</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
