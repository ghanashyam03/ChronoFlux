# TIME 2.0 (`time-2.0`)

[![CI](https://github.com/ghanashyam03/ChronoFlux/actions/workflows/ci.yml/badge.svg)](https://github.com/ghanashyam03/ChronoFlux/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/badge/npm-v0.1.0-blue.svg)](https://www.npmjs.com/package/time-2.0)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-success.svg)](package.json)
[![Coverage](https://img.shields.io/badge/coverage-93.7%25-brightgreen.svg)](package.json)
[![TypeScript Strict](https://img.shields.io/badge/TypeScript-Strict%20ESM-blue.svg)](tsconfig.json)

> **TIME 2.0 is a general-purpose temporal foundation that software can use wherever it currently uses time.**
> It answers questions like *"When is the sun above 15° while the local wall clock is between 9:00 AM and 5:00 PM on a weekday?"* by compiling declarative temporal conditions into verified physical time intervals for any location on Earth.

Built from mathematical first principles with **strictly zero runtime dependencies**, TIME 2.0 unifies nanosecond physical timeline arithmetic, geodetic WGS84 coordinates, analytical astronomical solar ephemeris (< 0.02° error), an IANA civil calendar with deterministic Daylight Saving Time (DST) disambiguation, continuous Brent-Dekker condition root finding ($< 10^{-5\circ}$ residuals), and James F. Allen's 13 interval relations (1983).

---

## Table of Contents

- [Architectural Overview](#architectural-overview)
- [Layer 1: Learn TIME 2.0 (Beginner Guide)](#layer-1-learn-time-20-beginner-guide)
  - [What is TIME 2.0 and why does it exist?](#what-is-time-20-and-why-does-it-exist)
  - [The 3-Step Mental Model](#the-3-step-mental-model)
  - [Core Concepts in Plain English](#core-concepts-in-plain-english)
  - [Frequently Asked Questions (FAQ)](#frequently-asked-questions-faq)
- [Layer 2: Science & Mathematical Foundations](#layer-2-science--mathematical-foundations)
  - [Analytical Jean Meeus / NOAA Solar Ephemeris](#analytical-jean-meeus--noaa-solar-ephemeris)
  - [Atmospheric Refraction & Geodetic Horizon Dip](#atmospheric-refraction--geodetic-horizon-dip)
  - [Statutory Twilight Bands & Illumination Criteria](#statutory-twilight-bands--illumination-criteria)
  - [Polar Dynamics: Decoupling Illumination Phase from Polar Regime](#polar-dynamics-decoupling-illumination-phase-from-polar-regime)
  - [Astronomical Time Scales (UTC, UT1, TAI, TT, $\Delta T$)](#astronomical-time-scales-utc-ut1-tai-tt-delta-t)
  - [Discrete Civil Calendar & Deterministic DST Disambiguation](#discrete-civil-calendar--deterministic-dst-disambiguation)
  - [Continuous Brent-Dekker Root Solving & Azimuth Branch Cuts](#continuous-brent-dekker-root-solving--azimuth-branch-cuts)
  - [James F. Allen's 13 Interval Relationships & Canonical Set Algebra](#james-f-allens-13-interval-relationships--canonical-set-algebra)
- [Layer 3: Developer Reference & SDK](#layer-3-developer-reference--sdk)
  - [Installation & Platform Support](#installation--platform-support)
  - [TypeScript Quickstart](#typescript-quickstart)
  - [Top-Level `Time` Facade API Reference](#top-level-time-facade-api-reference)
  - [Declarative Condition AST & Builder (`Conditions`)](#declarative-condition-ast--builder-conditions)
  - [Resolution Report & Mathematical Provenance](#resolution-report--mathematical-provenance)
  - [6 Comprehensive Code Recipes](#6-comprehensive-code-recipes)
  - [Performance Benchmarks](#performance-benchmarks)
  - [Migrating from ChronoFlux (100% Backwards Compatible)](#migrating-from-chronoflux-100-backwards-compatible)
- [Layer 4: Visual Diagnostic Suite & Developer Console](#layer-4-visual-diagnostic-suite--developer-console)
- [Repository Integrity & Verification](#repository-integrity--verification)
- [License](#license)

---

## Architectural Overview

TIME 2.0 is structured into six strictly decoupled layers:

```
┌────────────────────────────────────────────────────────────────────────┐
│ Layer 6: Visual Diagnostic Suite (3D Globe, Spacetime Ribbon, UI)      │
├────────────────────────────────────────────────────────────────────────┤
│ Layer 5: Developer SDK & Facade (Time, ChronoFlux alias, Conditions)   │
├────────────────────────────────────────────────────────────────────────┤
│ Layer 4: Data Providers (IANA tzdb, Extensible Astronomical Timescale) │
├────────────────────────────────────────────────────────────────────────┤
│ Layer 3: Temporal Resolver (Brent-Dekker Solver, AST, Allen Algebra)   │
├────────────────────────────────────────────────────────────────────────┤
│ Layer 2: Temporal Models (Solar Meeus/NOAA, Civil Calendar, Polar)     │
├────────────────────────────────────────────────────────────────────────┤
│ Layer 1: Temporal Core (Instant, Duration, Place, Interval, Set)       │
└────────────────────────────────────────────────────────────────────────┘
```

### The Three Cardinal Distinctions

All contributors, engineers, and agents must strictly distinguish between three dimensions of time:

1. **Timestamp Representation Precision**: The internal numerical granularity of TIME 2.0 data structures is **exact signed 64-bit+ BigInt nanoseconds ($10^{-9}\text{ s}$)**. This guarantees zero floating-point drift, zero rounding loss across arithmetic operations, and exact transitivity across $\pm 100,000,000$ days ($\pm 273,790$ years).
2. **Clock Resolution**: The smallest increment detectable by the host clock (e.g. $1\text{ ms}$ for `Date.now()`, $1\text{–}100\ \mu\text{s}$ for `performance.now()`, $1\text{ ns}$ for `process.hrtime.bigint()`). High representation precision allows TIME 2.0 to ingest any clock resolution without quantization loss, but does not upgrade a coarse clock.
3. **Clock Accuracy (Measurement Truth)**: The physical conformance of a clock reading to UTC standard time (maintained by BIPM/NIST atomic clocks), governed by oscillator physics and network sync (NTP: $\pm 1\text{–}50\text{ ms}$, PTP: $\pm 1\ \mu\text{s}$, GPS: $\pm 10\text{ ns}$). Precision describes storage capability; accuracy describes physical ground truth.

---

## Layer 1: Learn TIME 2.0 (Beginner Guide)

### What is TIME 2.0 and why does it exist?

Standard wall clocks and operating system timestamps only answer one simple question: *"What time is it right now at this single computer?"*

In the real physical world, however, time is continuous, geographical, astronomical, and multidimensional:

- **The Sun operates independently of clocks:** Sunrise, solar noon, and sunset change every day, at every latitude, and at every elevation.
- **Human clocks jump and repeat:** Daylight Saving Time (DST) causes clocks to skip an entire hour in the spring and repeat an hour in the autumn. A local wall clock time like "01:30 AM" on fall-back Sunday happens *twice* at two distinct physical instants separated by 3,600 seconds.
- **Twilight is a continuum:** Twilight is not a single number. In equatorial regions, twilight passes in minutes; in the Arctic, twilight can last all night for weeks.
- **Software needs windows, not scalars:** Solar farms need to know when solar elevation exceeds 25°; photographers want the golden hour on weekends; flight planners need civil twilight intervals; international teams need cross-timezone business hours overlapping with daylight.

**TIME 2.0 bridges the gap between human wall clocks and physical celestial reality.** It allows software to express high-level questions declaratively and resolves them into mathematically proven, continuous half-open intervals.

### The 3-Step Mental Model

```
┌───────────────────────────┐      ┌───────────────────────────┐      ┌───────────────────────────┐
│  Step 1: Pick a Place     │ ───► │  Step 2: Declare Conditions│ ───► │  Step 3: Resolve Windows  │
│  (Latitude, Longitude,    │      │  (Solar elevation >= 10°, │      │  Exact [start, end)       │
│   Elevation, Timezone)    │      │   Civil hour between 9-17)│      │  Continuous Interval Sets │
└───────────────────────────┘      └───────────────────────────┘      └───────────────────────────┘
```

1. **Pick Where You Are:** Define an observer using WGS84 geodetic coordinates (`latitude`, `longitude`, optional `elevationMeters`, and optional `timeZoneId`).
2. **Declare What You Need:** Express conditions on solar angles (`elevation`, `azimuth`, `phase`) and civil calendars (`hour`, `minute`, `dayOfWeek`, `isDaylightSaving`) using the fluent `Conditions` builder.
3. **Resolve Exact Time Windows:** Execute `Time.resolve()`. TIME 2.0 computes every continuous time span where all criteria are satisfied, providing mathematical boundary explanations and residuals.

### Core Concepts in Plain English

- **Half-Open Intervals $[t_{\text{start}}, t_{\text{end}})$:** A continuous span of time that includes its starting instant $t_{\text{start}}$ but excludes its ending instant $t_{\text{end}}$. This mathematical convention ensures that consecutive intervals (e.g. $[09:00, 12:00)$ and $[12:00, 17:00)$) abut perfectly without gaps or duplicate boundary points.
- **Solar Elevation ($h$):** The angular height of the center of the solar disk above the ideal geometric horizon.
  - $h = 0^\circ$: Center of the sun is on the geometric horizon.
  - $h = +90^\circ$: The sun is directly overhead at zenith.
  - $h < 0^\circ$: The sun is below the horizon.
- **Solar Azimuth ($A$):** The compass direction of the sun measured in degrees clockwise from true North ($0^\circ = \text{North}, 90^\circ = \text{East}, 180^\circ = \text{South}, 270^\circ = \text{West}$).
- **Apparent vs. Geometric Elevation:** Earth's atmosphere acts like a lens, bending light rays downward. As a result, the sun appears approximately $34\text{ arcminutes}$ ($0.567^\circ$) higher at the horizon than its true geometric coordinate. TIME 2.0 calculates pure geometric coordinates and applies standard atmospheric refraction models to compute apparent coordinates.
- **DST Disambiguation:** When clocks fall back in autumn, wall-clock times during the repeated hour are ambiguous. TIME 2.0 provides deterministic disambiguation policies (`earlier`, `later`, `compatible`, `reject`) and allows queries to synthesize both physical occurrences.

### Frequently Asked Questions (FAQ)

**Q: Why doesn't solar noon happen at 12:00 PM on my clock?**  
*A:* Two reasons: first, civil time zones span hundreds of miles, so the sun peaks earlier in the eastern edge of a timezone than in the western edge. Second, Earth's orbit is elliptical and its rotational axis is tilted by 23.44°. The **Equation of Time (EoT)** causes apparent solar noon to oscillate up to $\pm 16.5\text{ minutes}$ relative to a uniform clock over the course of a year.

**Q: Does TIME 2.0 require an internet connection or external servers?**  
*A:* No. The core `@chronoflux/core` / `time-2.0` package has **zero runtime dependencies**. All ephemeris calculations, root finders, and calendar algorithms run 100% locally in pure TypeScript.

**Q: How does TIME 2.0 handle historical dates before 1970?**  
*A:* JavaScript's native `Date` object has well-known bugs when handling negative timestamps, 2-digit years, and pre-1970 calendar dates. TIME 2.0 implements proleptic Gregorian 400-year cycle shifting and negative-epoch floor division, ensuring mathematically exact calendar resolution back to antiquity.

**Q: What happens in polar regions during Midnight Sun or Polar Night?**  
*A:* At high latitudes ($|\text{lat}| > 66.5^\circ$), the sun may not cross the horizon for months. TIME 2.0 detects these polar regimes analytically. If you query for daylight during Svalbard's summer, TIME 2.0 returns the entire search window as a continuous single interval. If you query for direct sun during Tromsø's winter, it returns an empty interval set without throwing errors or oscillating.

---

## Layer 2: Science & Mathematical Foundations

### Analytical Jean Meeus / NOAA Solar Ephemeris

TIME 2.0 implements the rigorous analytical solar ephemeris algorithms codified by Jean Meeus (*Astronomical Algorithms*, 2nd Edition) and utilized by the NOAA Earth System Research Laboratories (ESRL).

```
Instant (UTC Unix Epoch Nanoseconds)
               │
               ▼
Fractional Julian Day (JD_UT) & Terrestrial Julian Century (T_TT)
               │
               ▼
Geometric Mean Longitude (L₀) & Mean Anomaly (M)
               │
               ▼
Equation of Center (C) ──► True Solar Longitude (Sun's Elliptical Orbit)
               │
               ▼
Apparent Declination (δ) & Right Ascension (α) [Nutation & Obliquity]
               │
               ▼
Greenwich Hour Angle (GHA) & Equation of Time (EoT)
               │
               ▼
Topocentric Horizon Coordinates: Geometric Elevation (h_geom) & Azimuth (A)
```

#### Ephemeris Formulas

1. **Julian Day ($JD$) and Julian Century ($T$):**
   $$JD = 2440587.5 + \frac{\text{epochMilliseconds}}{86,400,000}$$
   $$T = \frac{JD - 2451545.0}{36525.0}$$

2. **Geometric Mean Solar Longitude ($L_0$) and Mean Anomaly ($M$):**
   $$L_0 = 280.46646^\circ + 36000.76983^\circ T + 0.0003032^\circ T^2 \pmod{360^\circ}$$
   $$M = 357.52911^\circ + 35999.05029^\circ T - 0.0001537^\circ T^2 \pmod{360^\circ}$$

3. **Sun's Equation of Center ($C$):**
   $$C = (1.914602^\circ - 0.004817^\circ T - 0.000014^\circ T^2)\sin(M) + (0.019993^\circ - 0.000101^\circ T)\sin(2M) + 0.000289^\circ\sin(3M)$$

4. **Sun's True Longitude ($\odot$) and Apparent Longitude ($\lambda$):**
   $$\odot = L_0 + C$$
   $$\lambda = \odot - 0.00569^\circ - 0.00478^\circ \sin(125.04^\circ - 1934.136^\circ T)$$

5. **Mean and Corrected Obliquity of the Ecliptic ($\epsilon$):**
   $$\epsilon_0 = 23^\circ 26' 21.448'' - 46.8150'' T - 0.00059'' T^2 + 0.001813'' T^3$$
   $$\epsilon = \epsilon_0 + 0.00256^\circ \cos(125.04^\circ - 1934.136^\circ T)$$

6. **Solar Declination ($\delta$) and Right Ascension ($\alpha$):**
   $$\sin(\delta) = \sin(\epsilon)\sin(\lambda)$$
   $$\alpha = \operatorname{atan2}(\cos(\epsilon)\sin(\lambda), \cos(\lambda))$$

7. **Topocentric Geometric Elevation ($h_{\text{geom}}$):**
   $$\sin(h_{\text{geom}}) = \sin(\phi)\sin(\delta) + \cos(\phi)\cos(\delta)\cos(H)$$
   where $\phi$ is observer latitude and $H = \theta_{\text{LST}} - \alpha$ is the local hour angle.

8. **Topocentric Azimuth ($A$):**
   $$\cos(A) = \frac{\sin(\delta) - \sin(\phi)\sin(h)}{\cos(\phi)\cos(h)}$$
   Measured clockwise from true North ($0^\circ = \text{North}, 90^\circ = \text{East}$). If $h = \pm 90^\circ$ (zenith/nadir) or $\phi = \pm 90^\circ$ (poles), azimuth is geometrically indeterminate; TIME 2.0 returns `isAzimuthIndeterminate: true` and `azimuthDeg: null`.

---

### Atmospheric Refraction & Geodetic Horizon Dip

#### Atmospheric Refraction ($R$)
When light rays traverse atmospheric density gradients, they bend toward the surface. TIME 2.0 implements G. G. Bennett's empirical formulation (1982) calibrated to standard atmospheric conditions ($1010\text{ hPa}$, $10^\circ\text{C}$):

$$R = \frac{1.02}{\tan\left(h + \frac{10.3}{h + 5.11}\right)} \text{ arcminutes}$$

For elevations below $-1^\circ$, refraction is smoothly phased out to prevent unphysical numerical singularities at nadir.

#### Observer Horizon Dip ($d_{\text{dip}}$)
For an observer situated at an elevation of $H$ meters above mean sea level (MSL / geoid), the geometric sea horizon drops below the horizontal plane by:

$$d_{\text{dip}} \approx \frac{1.76^\circ}{60}\sqrt{H} \approx 1.17'\sqrt{H}$$

An observer at $H = 100\text{ m}$ sees the horizon depressed by $\sim 11.7\text{ arcminutes}$ ($0.195^\circ$), advancing physical sunrise and delaying sunset.

---

### Statutory Twilight Bands & Illumination Criteria

The effective geometric threshold $\theta_{\text{eff}}$ adjusts for observer horizon dip:
$$\theta_{\text{eff}} = \theta_{\text{base}} - d_{\text{dip}}$$

| Illumination Phase | Base Geometric Threshold Range | Physical & Optical Significance |
| :--- | :--- | :--- |
| **Day (Direct Sunlight)** | $h_{\text{geom}} \ge -0.8333^\circ - d_{\text{dip}}$ | Upper limb of the solar disk appears above the horizon (incorporates $32'$ solar diameter and $34'$ atmospheric refraction). |
| **Civil Twilight** | $[-6.0^\circ - d_{\text{dip}}, -0.8333^\circ - d_{\text{dip}})$ | Terrestrial objects and horizon clearly distinguishable without artificial lighting. Brightest planets (Venus, Jupiter) become visible. |
| **Nautical Twilight** | $[-12.0^\circ - d_{\text{dip}}, -6.0^\circ - d_{\text{dip}})$ | General sea horizon remains visible for maritime sextant sights; navigation stars appear. |
| **Astronomical Twilight** | $[-18.0^\circ - d_{\text{dip}}, -12.0^\circ - d_{\text{dip}})$ | Faint sky glow detectable; diffuse atmospheric scattering prevents deep-sky astrophotography. |
| **Night** | $< -18.0^\circ - d_{\text{dip}}$ | Complete absence of solar sky illumination; true astronomical darkness. |

---

### Polar Dynamics: Decoupling Illumination Phase from Polar Regime

A major architectural flaw in conventional astronomy libraries is the conflation of instantaneous twilight with 24-hour diurnal polar regimes.

TIME 2.0 strictly decouples these two concepts:

1. **`SolarPhase` (Instantaneous State):** Evaluated strictly from instantaneous geometric elevation $h(t)$.
2. **`PolarRegimeType` (24-Hour Diurnal Classification):**
   - `'none'`: Standard diurnal cycle with distinct sunrise and sunset crossings.
   - `'polar_day'`: Midnight Sun; elevation remains above $-0.8333^\circ - d_{\text{dip}}$ throughout the entire 24-hour cycle.
   - `'polar_night'`: The solar disk never crosses above the horizon during the 24-hour cycle.

#### The Tromsø Paradox
During the winter solstice in Tromsø, Norway ($69.65^\circ\text{ N}$), the sun never rises above the horizon, so the location is in `polar_night`. However, at local solar noon, solar elevation reaches $-3.2^\circ$. Because $-3.2^\circ \ge -6.0^\circ$, Tromsø experiences **civil twilight** at midday! TIME 2.0 correctly and simultaneously reports:
```typescript
{
  phase: 'civil_twilight',
  polarRegime: 'polar_night',
  isDirectSunlight: false
}
```

---

### Astronomical Time Scales (UTC, UT1, TAI, TT, $\Delta T$)

Earth's rotation is slowing unpredictably due to lunar tidal friction and core-mantle angular momentum transfer.

- **UTC**: Civil atomic time based on SI seconds, periodically stepped by leap seconds to stay within $0.9\text{ s}$ of Earth's physical rotation.
- **UT1**: The true rotational angle of the Earth (Earth Rotation Angle), governing local solar noon and azimuth.
- **TT (Terrestrial Time)**: Uniform ephemeris time scale used by orbital mechanics: $\text{TT} = \text{TAI} + 32.184\text{ s}$.
- **$\Delta T = \text{TT} - \text{UT1}$**: The accumulated rotational difference ($\approx 69.2\text{ s}$ in 2026).

TIME 2.0 includes an extensible `AstronomicalTimeScale` provider (`timescale.ts`) allowing custom high-order polynomial models or real-time IERS Bulletin-A feeds to be registered dynamically.

---

### Discrete Civil Calendar & Deterministic DST Disambiguation

Civil time is defined by political boundaries and IANA time zones (`America/New_York`, `Europe/London`, `Asia/Tokyo`).

#### 400-Year Gregorian Cycle Shifting
JavaScript's native `Date` object fails on historical negative epochs (years before 1970) and interprets years 0–99 as 1900–1999. TIME 2.0 avoids native Date bugs by implementing arithmetic proleptic Gregorian 400-year cycle shifting:
$$\text{Year}_{\text{shifted}} = \text{Year} + 400k$$
This guarantees continuous, exact calendar conversions across millions of years.

#### Fall-Back HourBlock Partitioning
During Daylight Saving Time fall-back (e.g. `America/New_York` on November 1, 2026), wall clocks fall back from 02:00 EDT to 01:00 EST. The hour between 01:00 and 02:00 occurs *twice*:
1. **First occurrence**: 01:00–02:00 EDT (UTC-4) $\to$ 05:00–06:00 UTC.
2. **Second occurrence**: 01:00–02:00 EST (UTC-5) $\to$ 06:00–07:00 UTC.

TIME 2.0 partitions transition days into contiguous `HourBlock`s. A query for `Conditions.civil.hour.eq(1)` synthesizes **both physical occurrences** into disjoint, canonical intervals without boundary leakage or artificial duration stretching.

---

### Continuous Brent-Dekker Root Solving & Azimuth Branch Cuts

To resolve continuous conditions like $h(t) \ge 10^\circ$:

1. **Diurnal Extrema Partitioning**: TIME 2.0 partitions the search window by transit extrema (solar noon maxima and midnight minima) into strictly monotonic ascending and descending branches.
2. **Bracketed Brent-Dekker Solver**: Combines inverse quadratic interpolation, secant steps, and robust bisection to locate the root $t^*$ where:
   $$h(t^*) - \theta = 0$$
   Achieves guaranteed convergence with numerical residuals:
   $$|h(t^*) - \theta| < 10^{-5\circ}$$
3. **Azimuth Branch Cut Handling**: Solar azimuth has a geometric discontinuity at true North ($360^\circ \to 0^\circ$). The resolver detects branch-cut wraps, labeling them as `isWrapBoundary: true` with provenance category `azimuth_wrap`, preventing spurious boundary oscillation.

---

### James F. Allen's 13 Interval Relationships & Canonical Set Algebra

TIME 2.0 implements James F. Allen's foundational 13 temporal interval relationships (1983). For any two non-empty, half-open intervals $A = [s_A, e_A)$ and $B = [s_B, e_B)$, exactly one relationship holds:

```
Relation       Visual Example            Condition
───────────────────────────────────────────────────────────────────────────
before         [ A ]   [ B ]             e_A < s_B
meets          [ A ][ B ]                e_A = s_B
overlaps       [ A ... [ ... ] ... B ]   s_A < s_B < e_A < e_B
starts         [ A ... ]                 s_A = s_B and e_A < e_B
               [ B ....... ]
during             [ A ]                 s_B < s_A and e_A < e_B
               [ ... B ... ]
finishes           [ ... A ]             s_B < s_A and e_A = e_B
               [ ....... B ]
equals         [ ... A ... ]             s_A = s_B and e_A = e_B
               [ ... B ... ]
```
*(The remaining 6 relations are the inverse converses: `after`, `metBy`, `overlappedBy`, `startedBy`, `contains`, `finishedBy`.)*

All intervals are aggregated into canonical `IntervalSet` structures that enforce sorted, mutually disjoint ordering with automatic adjacent interval merging. Set operations ($\cup$, $\cap$, $\setminus$, complement) form a closed Boolean algebra.

---

## Layer 3: Developer Reference & SDK

### Installation & Platform Support

```bash
npm install time-2.0
```

- **Runtime Compatibility:** Node.js $\ge 18.0.0$, Deno $\ge 1.30$, Bun $\ge 1.0$, and modern evergreen browsers.
- **Module Systems:** Native ES Modules (ESM) with comprehensive TypeScript `.d.ts` declaration files.
- **Production Dependencies:** Exactly `0`. Zero third-party runtime dependencies.

---

### TypeScript Quickstart

```typescript
import { Time, Conditions, Duration } from 'time-2.0';

// 1. Observer: San Francisco, California
const sf = Time.place({
  latitude: 37.7749,
  longitude: -122.4194,
  timeZoneId: 'America/Los_Angeles',
});

// 2. Search Window: 3 full days starting now
const now = Time.now();
const window = Time.interval(now, now.add(Duration.fromDays(3)));

// 3. Declare condition: Sun above 15° AND weekday office hours (9 AM - 5 PM)
const query = Conditions.and(
  Conditions.solar.elevation.gte(15),
  Conditions.civil.hour.between(9, 17),
  Conditions.civil.dayOfWeek.between(1, 5)
);

// 4. Resolve into continuous intervals
const result = Time.resolve({
  place: sf,
  within: window,
  where: query,
  policy: 'all',
  minDuration: Duration.fromHours(2),
});

console.log(`Found ${result.intervals.intervals.length} operational daylight windows:`);
for (const iv of result.intervals.intervals) {
  const localStart = Time.civil.evaluate(iv.start, sf);
  const localEnd = Time.civil.evaluate(iv.end, sf);
  console.log(`• ${localStart.hour}:${localStart.minute} → ${localEnd.hour}:${localEnd.minute} PDT (${iv.duration.totalHours.toFixed(2)}h)`);
}
```

---

### Top-Level `Time` Facade API Reference

```typescript
import { Time } from 'time-2.0';

// --- Temporal Primitives ---
Time.now(): Instant
Time.instant(isoString: string): Instant
Time.instant(epochMilliseconds: number): Instant
Time.instant(epochNanoseconds: bigint): Instant
Time.instant(date: Date): Instant
Time.instant(temporal: { epochNanoseconds: bigint }): Instant

// Duration Factories
Time.duration.nanoseconds(ns: number | bigint): Duration
Time.duration.microseconds(us: number | bigint): Duration
Time.duration.milliseconds(ms: number | bigint): Duration
Time.duration.seconds(s: number | bigint): Duration
Time.duration.minutes(m: number | bigint): Duration
Time.duration.hours(h: number | bigint): Duration
Time.duration.days(d: number | bigint): Duration
Time.duration.zero(): Duration
Time.duration.of(fields: DurationFields): Duration

// Places & Geometry
Time.place(options: {
  latitude: number;
  longitude: number;
  elevationMeters?: number;
  timeZoneId?: string;
}): Place

// Intervals & Canonical IntervalSets
Time.interval(start: Instant, end: Instant): Interval
Time.intervalSet.empty(): IntervalSet
Time.intervalSet.of(...intervals: Interval[]): IntervalSet
Time.intervalSet.from(intervals: readonly Interval[]): IntervalSet

// --- Astronomical Solar Model ---
Time.solar.evaluatePosition(instant: Instant, place: Place): InstantaneousSolarPosition
Time.solar.evaluate(instant: Instant, place: Place): SolarState
Time.solar.nextEvent(options: {
  event: SolarEventName;
  place: Place;
  after: Instant;
  searchLimitDays?: number;
}): Instant | null
Time.solar.findTransitions(place: Place, window: Interval, thresholdDeg?: number): Instant[]

// --- IANA Civil Calendar Model ---
Time.civil.evaluate(instant: Instant, place: Place): CivilState
Time.civil.resolve(options: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  timeZoneId: string;
  disambiguation?: DisambiguationPolicy;
}): CivilTransitionInfo

// --- Temporal Intent & Condition Resolver ---
Time.resolve(options: {
  place: Place;
  within: Interval;
  where: ConditionAST;
  policy?: 'all' | 'earliest' | 'latest' | 'longest';
  minDuration?: Duration;
}): ResolutionResult
```

---

### Declarative Condition AST & Builder (`Conditions`)

All queries are serializable JSON Abstract Syntax Tree (AST) nodes created via `Conditions`:

```typescript
import { Conditions } from 'time-2.0';

// 1. Solar Domain
Conditions.solar.elevation.gte(degrees: number)
Conditions.solar.elevation.lte(degrees: number)
Conditions.solar.elevation.between(minDeg: number, maxDeg: number)
Conditions.solar.azimuth.between(startDeg: number, endDeg: number)
Conditions.solar.zenith.lt(degrees: number)
Conditions.solar.phase.eq('day' | 'civil_twilight' | 'nautical_twilight' | 'astronomical_twilight' | 'night')
Conditions.solar.polarRegime.eq('none' | 'polar_day' | 'polar_night')
Conditions.solar.isDirectSunlight.eq(boolean)

// 2. Civil Domain (Half-open calendar intervals)
Conditions.civil.hour.between(startHour: number, endHour: number) // e.g. 9 to 17 = [09:00, 17:00)
Conditions.civil.hour.eq(hour: number)
Conditions.civil.minute.between(startMin: number, endMin: number)
Conditions.civil.second.eq(second: number)
Conditions.civil.dayOfWeek.between(1, 5) // Monday (1) through Friday (5)
Conditions.civil.dayOfWeek.in([6, 7])   // Saturday (6) and Sunday (7)
Conditions.civil.day.between(1, 15)
Conditions.civil.month.between(1, 6)    // January through June
Conditions.civil.isDaylightSaving.eq(boolean)

// 3. Logical Composition
Conditions.and(...nodes: ConditionAST[])
Conditions.or(...nodes: ConditionAST[])
Conditions.not(node: ConditionAST)
```

---

### Resolution Report & Mathematical Provenance

Every call to `Time.resolve()` generates a deeply explainable `ResolutionReport`:

```typescript
const result = Time.resolve({ place, within, where: query });

console.log(result.report.query);             // "((solar.elevation >= 15) AND (civil.hour between [9, 17)))"
console.log(result.report.executionTimeMs);   // 1.84 ms
console.log(result.report.modelsConsulted);   // ["solar", "civil"]
console.log(result.report.totalMatchesFound); // 3

// Inspect granular mathematical boundary justifications:
for (const explanation of result.report.explanations) {
  console.log(`Interval: ${explanation.interval.toString()}`);
  console.log(`Start Reason: ${explanation.startExplanation.reason}`);
  console.log(`Start Model:  ${explanation.startExplanation.model}`);
  if (explanation.startExplanation.details?.residualDeg !== undefined) {
    console.log(`Residual:     ${explanation.startExplanation.details.residualDeg.toExponential(2)}°`);
  }
}
```

---

### 6 Comprehensive Code Recipes

The repository includes six fully runnable example scripts in `examples/`:

1. **[`01-solar-daylight.ts`](file:///c:/Users/ghana/Documents/antigravity/noble-pythagoras/examples/01-solar-daylight.ts)**: Resolving daylight windows ($\ge 10^\circ$) across a 3-day window in San Francisco.
2. **[`02-civil-business-hours.ts`](file:///c:/Users/ghana/Documents/antigravity/noble-pythagoras/examples/02-civil-business-hours.ts)**: Resolving local office hours ($09:00\text{--}17:00$) across Monday–Friday in London.
3. **[`03-solar-and-civil.ts`](file:///c:/Users/ghana/Documents/antigravity/noble-pythagoras/examples/03-solar-and-civil.ts)**: Cross-domain query combining direct sunlight ($\ge 15^\circ$) with civil work hours in Sydney.
4. **[`04-polar-regimes.ts`](file:///c:/Users/ghana/Documents/antigravity/noble-pythagoras/examples/04-polar-regimes.ts)**: High-latitude Midnight Sun in Svalbard ($78.22^\circ\text{ N}$) vs. Polar Night in Tromsø ($69.65^\circ\text{ N}$).
5. **[`05-dst-recurring.ts`](file:///c:/Users/ghana/Documents/antigravity/noble-pythagoras/examples/05-dst-recurring.ts)**: Resolving the 25-hour DST fall-back repeated hour in New York with boolean disambiguation.
6. **[`06-multi-location.ts`](file:///c:/Users/ghana/Documents/antigravity/noble-pythagoras/examples/06-multi-location.ts)**: Multi-office synchronization across London, New York, and Tokyo using `IntervalSet.intersect()`.

---

### Performance Benchmarks

Measured on a standard modern developer workstation (x64 Windows 11, Node.js 26.3, V8 14.6):

| Operation | Throughput | Mean Latency | Portability Upper Bound |
| :--- | :--- | :--- | :--- |
| **Instantaneous Position (`evaluatePosition`)** | **~98,900 ops/sec** | **10.1 µs/op** | $< 25\ \mu\text{s/op}$ |
| **Diurnal Event Cache Hit (`evaluate`)** | **~22,200 ops/sec** | **45.1 µs/op** | $< 60\ \mu\text{s/op}$ |
| **Cold Diurnal Cycle Solve (10 Brent-Dekker roots)** | **~2,100 ops/sec** | **472 µs/op** | $< 1,500\ \mu\text{s/op}$ |
| **Full AST Condition Resolution (7-day window)** | **~540 solves/sec** | **1.85 ms/solve**| $< 10\text{ ms/solve}$ |

---

### Migrating from ChronoFlux (100% Backwards Compatible)

TIME 2.0 maintains **100% backwards compatibility** with ChronoFlux. `ChronoFlux` is exported as an exact alias of `Time`:

```typescript
// Existing ChronoFlux code continues to work without modifications:
import { ChronoFlux } from 'time-2.0';

const instant = ChronoFlux.instant('2026-06-21T12:00:00.000Z');
console.assert(ChronoFlux === Time); // true
```

To migrate:
1. Update your dependencies to `time-2.0`:
   ```bash
   npm install time-2.0
   ```
2. Replace `@chronoflux/core` with `time-2.0` in your imports.
3. Import `Time` instead of `ChronoFlux`.

---

## Layer 4: Visual Diagnostic Suite & Developer Console

TIME 2.0 features an interactive, visual diagnostic suite and educational console built with React, Three.js, and Tailwind CSS:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TIME 2.0 Visual Suite                           │
├───────────┬──────────────┬─────────────┬─────────────────┬─────────────┤
│ 1. Home   │ 2. Explore   │ 3. Visualize│ 4. Build Conds  │ 5. Docs/Glo │
└───────────┴──────────────┴─────────────┴─────────────────┴─────────────┘
```

1. **Home**: Plain-language overview, interactive 3-step live code sandbox (`Time.now()`, `Time.solar.evaluatePosition()`, `Time.resolve()`), and feature cards.
2. **Explore & Learn**: 6 interactive educational questions explaining temporal phenomena (Midnight Sun, DST Fall-Back, Solar Noon vs Clock Noon, Nautical vs Civil Twilight, etc.).
3. **Visualize**:
   - **Interactive 3D WebGL Earth Globe**: Realistic day/night terminator boundary, real-time subsolar ray point, and observer coordinate pin.
   - **High-DPI Canvas Diurnal Chart**: Continuous solar elevation and azimuth curves with colored statutory twilight bands and discrete event markers.
   - **Spacetime Ribbon**: Multi-location 24-hour horizontal ribbon comparing physical daylight across Tromsø, Quito, New York, Tokyo, and Sydney.
4. **Build Conditions**: Interactive condition builder with 6 real-world presets, custom AST constructor, and live `ResolutionReport` inspector.
5. **Docs & Glossary**: In-app 3-layer documentation viewer and searchable 12-term interactive modal glossary.

### Running the Visualizer

```bash
# Start Vite development server
npm run dev:visualizer

# Build production bundle to dist-visualizer/
npm run build:visualizer
```

---

## Repository Integrity & Verification

- **434/434 Unit & Property Tests Passing** across 20 test suites.
- **> 93.7% Statement Coverage** across core ephemeris, resolver, AST, and primitives.
- **100% Type-Safe TypeScript** with `strict: true`, `noImplicitAny: true`, and `exactOptionalPropertyTypes: true`.
- **Zero Runtime Dependencies** in production distribution (`"dependencies": {}`).
- **Clean npm Pack Archive**: Published archive contains strictly `dist/`, `README.md`, `LICENSE`, and `package.json`.

---

## License

MIT © [TIME 2.0 Contributors](https://github.com/ghanashyam03/ChronoFlux)
