/**
 * @file ConditionBuilderView.tsx
 * Guided human-readable condition builder compiling into ConditionAST and executing Time.resolve().
 */

import React, { useState, useMemo } from 'react';
import {
  Sliders,
  Clock,
  Sun,
  Code,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';
import { Time, Conditions } from 'time-2.0';
import type { ConditionAST, ResolutionResult } from 'time-2.0';
import { LOCATION_PRESETS } from '../state/presets.js';

interface ConditionBuilderViewProps {
  readonly onOpenGlossary: () => void;
}

type SunPresetOption = 'broad_daylight' | 'above_horizon' | 'golden_hour' | 'deep_night' | 'civil_twilight' | 'any';
type CivilPresetOption = 'business_hours' | 'morning' | 'afternoon' | 'evening' | 'any';
type WindowPresetOption = '1d' | '3d' | '7d';

export const ConditionBuilderView: React.FC<ConditionBuilderViewProps> = ({ onOpenGlossary }) => {
  const [selectedLocationId, setSelectedLocationId] = useState<string>('new_york');
  const [sunOption, setSunOption] = useState<SunPresetOption>('broad_daylight');
  const [civilOption, setCivilOption] = useState<CivilPresetOption>('business_hours');
  const [windowOption, setWindowOption] = useState<WindowPresetOption>('3d');
  const [minDurationMinutes, setMinDurationMinutes] = useState<number>(30);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [showAdvancedJson, setShowAdvancedJson] = useState<boolean>(false);

  const selectedPreset = useMemo(() => {
    return LOCATION_PRESETS.find((p) => p.id === selectedLocationId) ?? LOCATION_PRESETS[0]!;
  }, [selectedLocationId]);

  // Compile human selections into real serializable ConditionAST
  const compiledAST: ConditionAST = useMemo(() => {
    const operands: ConditionAST[] = [];

    // Sun rule
    if (sunOption === 'broad_daylight') {
      operands.push(Conditions.solar.elevation.gte(10));
    } else if (sunOption === 'above_horizon') {
      operands.push(Conditions.solar.elevation.gte(0));
    } else if (sunOption === 'golden_hour') {
      operands.push(Conditions.solar.elevation.between(-4, 6));
    } else if (sunOption === 'deep_night') {
      operands.push(Conditions.solar.elevation.lt(-18));
    } else if (sunOption === 'civil_twilight') {
      operands.push(Conditions.solar.elevation.between(-6, -0.833333));
    }

    // Civil rule
    if (civilOption === 'business_hours') {
      operands.push(Conditions.civil.hour.between(9, 17));
    } else if (civilOption === 'morning') {
      operands.push(Conditions.civil.hour.between(6, 12));
    } else if (civilOption === 'afternoon') {
      operands.push(Conditions.civil.hour.between(12, 18));
    } else if (civilOption === 'evening') {
      operands.push(Conditions.civil.hour.between(18, 22));
    }

    if (operands.length === 0) {
      return Conditions.solar.elevation.gte(-90); // trivial true
    }
    if (operands.length === 1) {
      return operands[0]!;
    }
    return Conditions.and(...operands);
  }, [sunOption, civilOption]);

  // Execute Time.resolve() live
  const resolution = useMemo<{ result: ResolutionResult | null; error: string | null }>(() => {
    try {
      const now = Time.now();
      const place = selectedPreset.place;
      const days = windowOption === '1d' ? 1 : windowOption === '3d' ? 3 : 7;
      const searchWindow = Time.interval(now, now.add(Time.duration.days(days)));

      const res = Time.resolve({
        place,
        within: searchWindow,
        where: compiledAST,
        policy: 'all',
        ...(minDurationMinutes > 0 ? { minDuration: Time.duration.minutes(minDurationMinutes) } : {}),
      });
      return { result: res, error: null };
    } catch (err) {
      return {
        result: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }, [selectedPreset, compiledAST, windowOption, minDurationMinutes]);

  // Generated TypeScript code snippet
  const generatedCode = useMemo(() => {
    const locName = selectedPreset.name.toLowerCase().replace(/\s+/g, '_');
    return `import { Time, Conditions } from 'time-2.0';

// 1. Define observer location (${selectedPreset.name})
const ${locName} = Time.place({
  latitude: ${selectedPreset.place.latitude},
  longitude: ${selectedPreset.place.longitude},
  timeZoneId: '${selectedPreset.place.timeZoneId}',
});

// 2. Define search window (${windowOption})
const now = Time.now();
const searchWindow = Time.interval(
  now,
  now.add(Time.duration.days(${windowOption === '1d' ? 1 : windowOption === '3d' ? 3 : 7}))
);

// 3. Declare condition query
const condition = ${
      sunOption !== 'any' && civilOption !== 'any'
        ? `Conditions.and(
  ${
    sunOption === 'broad_daylight'
      ? 'Conditions.solar.elevation.gte(10)'
      : sunOption === 'above_horizon'
      ? 'Conditions.solar.elevation.gte(0)'
      : sunOption === 'golden_hour'
      ? 'Conditions.solar.elevation.between(-4, 6)'
      : sunOption === 'deep_night'
      ? 'Conditions.solar.elevation.lt(-18)'
      : 'Conditions.solar.elevation.between(-6, -0.8333)'
  },
  ${
    civilOption === 'business_hours'
      ? 'Conditions.civil.hour.between(9, 17)'
      : civilOption === 'morning'
      ? 'Conditions.civil.hour.between(6, 12)'
      : civilOption === 'afternoon'
      ? 'Conditions.civil.hour.between(12, 18)'
      : 'Conditions.civil.hour.between(18, 22)'
  }
)`
        : sunOption !== 'any'
        ? `${
            sunOption === 'broad_daylight'
              ? 'Conditions.solar.elevation.gte(10)'
              : sunOption === 'above_horizon'
              ? 'Conditions.solar.elevation.gte(0)'
              : sunOption === 'golden_hour'
              ? 'Conditions.solar.elevation.between(-4, 6)'
              : sunOption === 'deep_night'
              ? 'Conditions.solar.elevation.lt(-18)'
              : 'Conditions.solar.elevation.between(-6, -0.8333)'
          }`
        : 'Conditions.civil.hour.between(9, 17)'
    };

// 4. Resolve into continuous half-open intervals
const { intervals, report } = Time.resolve({
  place: ${locName},
  within: searchWindow,
  where: condition,
  policy: 'all',
  minDuration: Time.duration.minutes(${minDurationMinutes}),
});

console.log(\`Matched \${intervals.intervals.length} intervals in \${report.executionTimeMs.toFixed(2)} ms\`);
for (const interval of intervals.intervals) {
  console.log(\`• \${interval.start.toISOString()} → \${interval.end.toISOString()} (\${interval.duration.totalMinutes} min)\`);
}`;
  }, [selectedPreset, windowOption, sunOption, civilOption, minDurationMinutes]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="space-y-8 py-2 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-slate-900 border border-slate-800">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-400 block mb-1">
            Declarative Temporal Query Engine
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
            Build Time Conditions & Find Matching Periods
          </h1>
          <p className="text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Formulate questions like <em>"When is it bright daylight during office hours?"</em> and let TIME 2.0 find continuous half-open intervals with sub-microdegree mathematical precision.
          </p>
        </div>

        <button
          onClick={onOpenGlossary}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium self-start md:self-auto transition-colors"
        >
          Glossary & Concepts
        </button>
      </div>

      {/* Main Grid: Form Builder on Left, Resolution Output on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Form Builder Controls */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-400" />
              <span>Define Condition Rules</span>
            </h2>

            {/* Location selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Observer Location:</label>
              <select
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                {LOCATION_PRESETS.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}, {loc.country}
                  </option>
                ))}
              </select>
            </div>

            {/* Rule 1: Solar condition */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>Sun Position Condition:</span>
              </label>
              <select
                value={sunOption}
                onChange={(e) => setSunOption(e.target.value as SunPresetOption)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                <option value="broad_daylight">Broad Daylight (Sun &ge; 10° above horizon)</option>
                <option value="above_horizon">Any Daylight (Sun &ge; 0° above horizon)</option>
                <option value="golden_hour">Golden Hour (Sun between -4° and 6°)</option>
                <option value="civil_twilight">Civil Twilight (Sun -6° to -0.83°)</option>
                <option value="deep_night">Complete Night Darkness (Sun &lt; -18°)</option>
                <option value="any">Any Sun Position (No solar restriction)</option>
              </select>
            </div>

            {/* Rule 2: Civil Time condition */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                <span>Local Civil Time Condition:</span>
              </label>
              <select
                value={civilOption}
                onChange={(e) => setCivilOption(e.target.value as CivilPresetOption)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                <option value="business_hours">Business Hours (09:00 - 17:00 local time)</option>
                <option value="morning">Morning Hours (06:00 - 12:00 local time)</option>
                <option value="afternoon">Afternoon Hours (12:00 - 18:00 local time)</option>
                <option value="evening">Evening Hours (18:00 - 22:00 local time)</option>
                <option value="any">Any Time of Day (24-hour cycle)</option>
              </select>
            </div>

            {/* Search Window Duration */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Search Window:</label>
                <select
                  value={windowOption}
                  onChange={(e) => setWindowOption(e.target.value as WindowPresetOption)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 font-medium"
                >
                  <option value="1d">Next 24 Hours</option>
                  <option value="3d">Next 3 Days</option>
                  <option value="7d">Next 7 Days</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Min Duration:</label>
                <select
                  value={minDurationMinutes}
                  onChange={(e) => setMinDurationMinutes(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 font-medium"
                >
                  <option value={0}>No minimum</option>
                  <option value={15}>&ge; 15 minutes</option>
                  <option value={30}>&ge; 30 minutes</option>
                  <option value={60}>&ge; 1 hour</option>
                  <option value={120}>&ge; 2 hours</option>
                </select>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-800/30 text-xs text-indigo-300">
              <strong>Query Intent:</strong> Find all continuous periods in {selectedPreset.name} where the Sun and your local clock satisfy both conditions simultaneously.
            </div>
          </div>
        </div>

        {/* Right Column: Resolution Results */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-100">Continuous Matching Intervals</h3>
                <span className="text-xs text-slate-400">
                  Resolved by Time.resolve() Interval Algebra Engine
                </span>
              </div>

              {resolution.result && (
                <div className="text-right">
                  <span className="text-xs font-mono text-emerald-400 font-semibold block">
                    {resolution.result.report.executionTimeMs.toFixed(1)} ms
                  </span>
                  <span className="text-[10px] text-slate-500">Execution time</span>
                </div>
              )}
            </div>

            {resolution.error ? (
              <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
                <div>
                  <strong className="block font-semibold">Resolution Error:</strong>
                  <p className="mt-0.5">{resolution.error}</p>
                </div>
              </div>
            ) : resolution.result?.intervals.intervals.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-slate-950 border border-slate-800 text-slate-400 space-y-2">
                <Clock className="w-8 h-8 mx-auto opacity-40 text-slate-500" />
                <h4 className="text-sm font-semibold text-slate-200">No Matching Periods Found</h4>
                <p className="text-xs max-w-md mx-auto">
                  The selected combination of conditions was never satisfied within this search window. Try relaxing the Sun elevation threshold or extending the search window.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>
                    Found <strong className="text-slate-100">{resolution.result?.intervals.intervals.length}</strong> valid time period(s):
                  </span>
                  <span>Strictly half-open [start, end)</span>
                </div>

                {/* Interval List */}
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {resolution.result?.intervals.intervals.map((iv, idx) => {
                    const startCiv = selectedPreset.place.timeZoneId
                      ? Time.civil.evaluate(iv.start, selectedPreset.place)
                      : null;
                    const endCiv = selectedPreset.place.timeZoneId
                      ? Time.civil.evaluate(iv.end, selectedPreset.place)
                      : null;
                    const durHours = Math.floor(iv.duration.totalMinutes / 60);
                    const durMins = Math.round(iv.duration.totalMinutes % 60);

                    return (
                      <div
                        key={idx}
                        className="p-4 rounded-xl bg-slate-950/80 border border-emerald-500/30 hover:border-emerald-500/60 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center font-mono">
                              {idx + 1}
                            </span>
                            <span className="text-sm font-bold text-slate-100 font-mono">
                              {startCiv
                                ? `${String(startCiv.month).padStart(2, '0')}/${String(startCiv.day).padStart(2, '0')} ${String(startCiv.hour).padStart(2, '0')}:${String(startCiv.minute).padStart(2, '0')}`
                                : iv.start.toISOString()}{' '}
                              &rarr;{' '}
                              {endCiv
                                ? `${String(endCiv.hour).padStart(2, '0')}:${String(endCiv.minute).padStart(2, '0')} ${endCiv.timeZoneId.split('/')[1]?.replace('_', ' ') ?? ''}`
                                : iv.end.toISOString()}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 pl-7">
                            Both solar and civil conditions held true for this entire period.
                          </p>
                        </div>

                        <span className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-300 font-mono text-xs font-semibold border border-emerald-500/20 whitespace-nowrap self-start sm:self-auto">
                          {durHours > 0 ? `${durHours}h ` : ''}{durMins}m
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Provenance Residuals */}
                {resolution.result && (
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 space-y-1">
                    <div className="flex justify-between">
                      <span>Models Consulted:</span>
                      <span className="font-mono text-slate-300 uppercase">
                        {resolution.result.report.modelsConsulted.join(', ')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Root Solver Precision:</span>
                      <span className="font-mono text-emerald-400">&lt; 10⁻⁵ degrees (&lt; 0.036 arcsec)</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Toggle Developer Code & JSON AST */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <button
                onClick={() => setShowAdvancedJson(!showAdvancedJson)}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1.5"
              >
                <Code className="w-3.5 h-3.5" />
                <span>{showAdvancedJson ? 'Hide Code & AST' : 'View TypeScript Code & JSON AST'}</span>
              </button>
            </div>

            {showAdvancedJson && (
              <div className="space-y-4 pt-2">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 relative space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">Generated TypeScript Code:</span>
                    <button
                      onClick={handleCopyCode}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 flex items-center gap-1 transition-colors"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="text-[11px] font-mono text-slate-300 bg-slate-900/90 p-3 rounded-lg overflow-x-auto max-h-56">
                    {generatedCode}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
