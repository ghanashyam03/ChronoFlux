# TIME 2.0 — Agent Guide (`agent.md`)

This document serves as the canonical orientation, architecture guide, and operational instructions for all AI agents working on the **TIME 2.0** (`time-2.0`) codebase.

---

## 1. Project Mission & Core Philosophy

**TIME 2.0 is a general-purpose temporal foundation that software can use wherever it currently uses time.**

TIME 2.0 does not replace standard clocks or rename UTC. It provides:
1. A globally consistent, high-resolution temporal core.
2. Extensible models for evaluating temporal state (physical, civil, environmental) at any instant and place.
3. A declarative temporal condition and intent resolver based on Allen's Interval Algebra.
4. An interactive, multi-layered visual diagnostic and educational suite.

### Guiding Principles
- **No Gimmicks**: TIME 2.0 is not a toy clock face. Visualizations belong strictly to Layer 6 as diagnostic, educational, and inspection tools.
- **Canonical High Resolution**: Internal instants and durations are stored as exact signed integer nanoseconds using JavaScript `bigint`. No floating-point arithmetic is permitted for canonical timestamps or durations.
- **Separation of Concerns**:
  - `Instant` $\neq$ `Civil Time` $\neq$ `Solar State`.
  - An `Instant` is an unambiguous point on the timeline.
  - A `Place` is a physical geographic coordinate (WGS84). Time zones are contextual, not intrinsic to a coordinate.
  - A Daylight Saving Time (DST) shift changes civil representation, never the underlying instant or elapsed duration.
- **Precision vs. Resolution vs. Accuracy**:
  - **Timestamp Representation Precision**: The numerical granularity of TIME 2.0's data structures is exact signed BigInt nanoseconds ($10^{-9}\text{ s}$). This guarantees zero arithmetic drift, zero rounding errors in temporal arithmetic, and exact transitivity across a $\pm 100,000,000$ day range ($\pm 273,790$ years).
  - **Clock Resolution**: The smallest detectable increment provided by an underlying hardware or runtime clock source (e.g. $1\text{ ms}$ for `Date.now()`, $1\text{–}100\ \mu\text{s}$ for `performance.now()`, $1\text{ ns}$ for `process.hrtime.bigint()`). High representation precision allows TIME 2.0 to ingest any clock resolution without quantization loss, but does not magically upgrade a low-resolution clock.
  - **Clock Accuracy (Measurement Accuracy)**: The degree of conformance between a clock reading and true standard time (UTC/BIPM atomic clock standard), governed by physical oscillators and network sync protocols (e.g. NTP $\pm 1\text{–}50\text{ ms}$, PTP $\pm 1\ \mu\text{s}$, GPS $\pm 10\text{ ns}$). High representation precision must never be conflated with physical sensor accuracy.
- **Leap Second Policy**: TIME 2.0 operates on a leap-second-free Unix epoch timeline (86,400 SI seconds per nominal day). For ISO-8601 parsing, second `:60` is accepted only on authentic historical IERS leap second dates at UTC 23:59:60Z and clamped to second 59 per RFC 3339 / POSIX compatibility mode (`leapSecondPolicy: 'compatible'`).
  - *Justification for Compatibility Mode*: RFC 3339 Section 5.6 allows leap seconds as `:60`. To maintain interoperability with existing timestamp feeds and preserve backward compatibility, the core parser defaults to `compatible` mode. Second 60 is strictly validated against the 27 authentic IERS historical dates; non-zero UTC offsets and arbitrary calendar dates are strictly rejected with a `RangeError`.
  - *Strict Rejection*: Core parsing also supports strict rejection mode (`leapSecondPolicy: 'reject'` or `'strict'`), which strictly forbids second 60 per TIME 2.0's leap-second-free Instant model.

---

## 2. System Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 6: Visual Diagnostic Suite (Spacetime Ribbon, Globe)  │
├─────────────────────────────────────────────────────────────┤
│ Layer 5: Developer SDK & Interoperability Facade (Time)     │
├─────────────────────────────────────────────────────────────┤
│ Layer 4: Data Providers (tzdb, NOAA/NREL ephemeris)         │
├─────────────────────────────────────────────────────────────┤
│ Layer 3: Temporal Resolver (Conditions, Root-Finding, AST)  │
├─────────────────────────────────────────────────────────────┤
│ Layer 2: Temporal Models (Solar, Civil, Planetary)          │
├─────────────────────────────────────────────────────────────┤
│ Layer 1: Temporal Core (Instant, Duration, Place, Interval)  │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Core Primitives (Layer 1 Contracts — Hardened Phase 1.1)

All primitives are located in `src/core/primitives/`:

| Primitive | Class / Interface | Canonical Storage | Key Invariants |
| :--- | :--- | :--- | :--- |
| **Instant** | `Instant` | `readonly epochNanoseconds: bigint` | Deeply immutable (`Object.freeze`). Safe integers required for numeric inputs; BigInt, decimal strings, and scientific notation (`1e-8`) supported for arbitrary precision. Fractional-unit conversions require explicit `RoundingMode`. Validated ISO-8601 parser with authentic IERS leap-second date verification and strict rejection mode. High-precision sub-nanosecond ISO strings handled gracefully. Rounding modes for millisecond conversions (`trunc`, `floor`, `ceil`, `halfExpand`). Safe serialization to decimal strings and ISO-8601 UTC strings. |
| **Duration** | `Duration` | `readonly nanoseconds: bigint` | Deeply immutable (`Object.freeze`). Signed integer nanoseconds. Units: `nanoseconds`, `microseconds`, `milliseconds`, `seconds`, `minutes`, `hours`, `days`. Fixed elapsed time only (no calendar months/years). No silent `Math.trunc()`: fractional units require explicit `RoundingMode`. Exact decimal and scientific notation strings and numbers supported in factories and `multiply()`. Division requires safe integer divisor. ISO-8601 duration formatting. |
| **Place** | `Place` | `latitude`, `longitude`, `elevationMeters?` | Deeply immutable (`Object.freeze`). WGS84 coordinate bounds: $\text{lat} \in [-90, +90]$, $\text{lon} \in [-180, +180]$. Contextual `timeZoneId` kept separate from coordinate geometry. |
| **Interval** | `Interval` | `[start: Instant, end: Instant)` | Deeply immutable (`Object.freeze`). Half-open: includes `start`, excludes `end`. Requires `start < end` (zero/negative durations rejected; empty sets represented by `IntervalSet.empty()`). Evaluates general non-empty intersection via `intersects()`. Canonical Allen evaluation via `relationTo()`. Consistent symmetric predicate helpers across all 13 Allen relationships (`isBefore`/`before`, `isAfter`/`after`, `isMeets`/`meets`, `isMetBy`/`metBy`, `isOverlaps`/`overlapsRelation`, `isOverlappedBy`/`overlappedBy`, `isStarts`/`starts`, `isStartedBy`/`startedBy`, `isDuring`/`during`, `isContainsInterval`/`containsInterval`, `isFinishes`/`finishes`, `isFinishedBy`/`finishedBy`, `isEquals`). |
| **IntervalSet**| `IntervalSet` | `readonly intervals: readonly Interval[]` | Deeply immutable: both the set instance and its backing `intervals` array are frozen (`Object.freeze`). Canonical sorted, disjoint intervals with adjacent interval merging. Set algebra: union ($\cup$), intersection ($\cap$), difference ($\setminus$), and bounded complement. Point containment via $O(\log N)$ binary search. |

### Generic Intersection vs. Allen's 13 Interval Relationships
- **Generic Intersection**: `intervalA.intersects(intervalB)` evaluates whether $A \cap B \neq \emptyset$ (i.e. $\max(s_A, s_B) < \min(e_A, e_B)$). `overlaps()` is retained as an alias.
- **Allen's 13 Relations**: For any two non-empty, half-open intervals $A$ and $B$, exactly one mutually exclusive relationship holds (`intervalA.relationTo(intervalB)`):
  1. `before` / `after`
  2. `meets` / `metBy`
  3. `overlaps` / `overlappedBy` (Allen's directional overlap: $s_A < s_B < e_A < e_B$)
  4. `starts` / `startedBy`
  5. `during` / `contains`
  6. `finishes` / `finishedBy`
  7. `equals` (tested via `isEquals()`)

---

## 4. Coding Standards & Agent Rules

1. **Precision & Types**:
   - Always use `bigint` for timestamps and durations.
   - Never use `Math.floor`, `Math.trunc`, or floating-point division on nanoseconds.
   - Require safe integers (`Number.isSafeInteger`) for JS `number` inputs; require explicit `RoundingMode` for fractional conversions.
   - Ensure all domain primitives are runtime-immutable via `Object.freeze`.
2. **Error Handling**:
   - Throw descriptive `RangeError` or `TypeError` on invalid inputs (e.g. out-of-range coordinates, zero-length intervals, unparseable ISO strings, fractional units without rounding mode).
3. **Property-Based Testing**:
   - Use `fast-check` alongside standard Vitest unit tests to stress-test boundary conditions, inverse properties, and algebraic laws (associativity, distributivity, De Morgan's laws).
4. **Git Discipline**:
   - Make atomic, descriptive commits following Conventional Commits (`feat(core): ...`, `test(core): ...`, `docs: ...`, `fix(core): ...`).
   - Remote origin: `https://github.com/ghanashyam03/TIME-2.0.git`.
   - Ensure `npm test`, `npm run test:coverage`, and `npm run build` pass with zero warnings before pushing.

---

## 5. Development Commands

```bash
# Run test suite (433 tests across 20 suites)
npm test

# Run tests in watch mode
npm run test:watch

# Run test coverage (> 93% line coverage)
npm run test:coverage

# Build core TypeScript output
npm run build

# Start visual diagnostic application dev server
npm run dev:visualizer

# Build visualizer for production
npm run build:visualizer

# Typecheck visual diagnostic suite
npm run typecheck:visualizer
```

---

## 6. Implementation Roadmap Status

- [x] **Phase 1 — Temporal Foundations**: Canonical nanosecond `Instant`, `Duration`, `Place`, `Interval`, `IntervalSet`, 13 Allen relationships, fast-check property testing.
- [x] **Phase 1.1 — Correctness and Invariant Hardening**:
  - Runtime immutability across all primitives and backing arrays (`Object.freeze`).
  - Exact numerical input enforcement (safe integer checks, BigInt/string support, elimination of silent `Math.trunc()`, explicit `RoundingMode` policies for fractional units).
  - Explicit leap-second semantics with authentic IERS date validation, non-zero offset rejection, and RFC 3339 compatibility mode.
  - Allen API naming separation (`intersects()` for generic intersection, `relationTo()` canonical for 13 relations, symmetric helper methods).
  - Comprehensive regression test suite (178/178 tests passing with 98.22% line coverage).
- [x] **Phase 2 — Solar & Civil Temporal Models**:
  - `TemporalModel<TState>` extensible interface and `ModelMetadata` with formal accuracy profile, resolution, margin of error, and validity range.
  - High-precision Astronomical Solar Model (`src/core/models/solar/`) implementing Jean Meeus (*Astronomical Algorithms*, 2nd ed.) and NOAA Solar Calculator formulations.
  - Geometric and apparent solar elevation, azimuth, zenith, solar noon/midnight, and Saemundsson / Bennett atmospheric refraction.
  - Twilight regimes: civil ([-6°, -0.833°)), nautical ([-12°, -6°)), astronomical ([-18°, -12°)), night (< -18°), day (>= -0.833°).
  - Robust Polar edge cases: Polar Day (`polar_day`, Midnight Sun) and Polar Night (`polar_night`) in Tromsø (69.65°N) and Svalbard (78.22°N) with zero NaN/crashes, plus exact annual equinox sunrise/sunset resolution at the North and South Poles (±90° latitude).
  - Solar event locator API (`Time.solar.nextEvent` and `findTransitions`).
  - Civil Time Model (`src/core/models/civil/`) with IANA time zone support, UTC offsets, DST detection, pre-1970 negative nanosecond floor division, 2-digit year safety, and TC39-compliant DST transition disambiguation (`compatible`, `earlier`, `later`, `reject`).
  - Comprehensive golden vector validation (50 NOAA benchmarks, < 0.02° error) and 220/220 passing unit tests (97.61% line coverage).
- [x] **Phase 2.1 — Scientific & Semantic Correctness Audit**:
  - Harmonized astronomical solar coordinate convention: primary calculations, twilight boundaries, direct sunlight ($h_{\text{geom}} \ge -0.8333^\circ$), and polar regimes strictly anchored to geometric solar elevation $h_{\text{geom}}$.
  - Complete 10-event solar API: added `nauticalDawn`, `nauticalDusk`, `astronomicalDawn`, and `astronomicalDusk` with full polar condition handling.
  - Civil-time correctness: eliminated silent UTC fallback when `Place.timeZoneId` is omitted (throws `TypeError`); added pluggable `TimeZoneLookupProvider`; robust non-heuristic DST classification evaluating 12-month annual offset profiles.
  - Dynamic uncertainty decomposition: dynamic event-time uncertainty $\Delta t = \Delta h / |dh/dt|$; granular separation of ephemeris numerical error, atmospheric refraction uncertainty, dynamic event-time uncertainty, and observer horizon dip.
  - Safeguarded root-finding: bracketed hybrid Newton-Raphson/bisection solver; verified across polar circle latitudes ($66.0^\circ, 66.564^\circ, 67.0^\circ, -68.0^\circ$); explicit indeterminate azimuth indicators at zenith, nadir, and geographic poles; elevation residual verification.
  - Performance & reproducibility: instantaneous position evaluation (`solar.evaluatePosition`), bounded diurnal cycle event cache (up to 50x speedup), civil time database runtime provenance exposure, and fractional `searchLimitDays` hardening.
  - 251/251 passing tests with 97.19% line coverage and 0 build errors.
- [x] **Phase 2.2 — Numerical Reliability & Temporal Semantics**:
  - Polar root-finding: genuine bracketed Brent-Dekker solver with explicit convergence status and residual verification ($|h(t) - \theta| < 10^{-5\circ}$) in `math.ts`.
  - Exact diurnal cache key precision: coordinate and observer elevation stringification (`${lat},${lon},${elev}:${noonSeconds}`) without lossy truncation.
  - Uncertainty semantics: separated instantaneous angular uncertainty $\Delta h(t)$, threshold-crossing sensitivity $|dh/dt|$ (`crossingSensitivityDegPerMin`), and physical event-crossing uncertainties (`sunriseUncertaintyMinutes`, `sunsetUncertaintyMinutes`) evaluated at actual event instants.
  - Polar regime decoupled from solar illumination phase: diurnal `polarRegime` (`'none' | 'polar_day' | 'polar_night'`) independent from instantaneous `phase` (`'day' | 'civil_twilight' | 'nautical_twilight' | 'astronomical_twilight' | 'night'`). Polar night correctly reports twilight when elevation is between -6° and -0.833°.
  - Astronomical time-scale policy: documented relationship between Unix Instant, UTC, UT1, TAI, and TT; extensible `AstronomicalTimeScale` interface and `StandardAstronomicalTimeScale` provider (`timescale.ts`) computing $\Delta T(t)$.
  - Validity enforcement: explicit `isWithinValidityRange` (1800-2100 CE) and `isAccuracyDegraded` flags with quadratic ephemeris error expansion when extrapolated.
  - Civil DST classification: preserved exact IANA offset while qualifying DST determination with `dstConfidence: 'authoritative' | 'heuristic' | 'unknown'`.
  - Reproducible performance benchmarks: structured methodology featuring explicit JIT warmups (500 ops for `evaluatePosition`, 50 ops for cold diurnal solves, 200 ops for warm-cache hits), host environment diagnostics (`process.platform`, `process.arch`, Node/V8 versions), and cross-platform regression bounds (< 25 µs/op for instantaneous position, < 1,500 µs/op for cold diurnal solves, < 60 µs/op for warm hits, with relaxed thresholds under coverage instrumentation).
- [x] **Phase 2.2.1 — Contract & Verification Closure**:
  - Event metadata preservation: ensured complete uncertainty breakdown and accuracy metadata are retained across diurnal cache retrieval.
  - Polar cache collision immunity: fixed collision between distinct elevated polar queries.
  - Elevation-adjusted phase consistency: harmonized twilight classifications and direct sunlight flags to the elevation-depressed horizon threshold.
- [x] **Phase 2.2.2 — Final Scientific & Contract Closure**:
  - Full-model polar crossing uncertainty: implemented 30-second numerical central difference derivative $\frac{dh}{dt} \approx \frac{h(t+\Delta t) - h(t-\Delta t)}{2\Delta t}$ capturing both diurnal rotation and seasonal declination drift ($\sim 0.4^\circ/\text{day}$) across polar and near-polar equinox transitions (North Pole, South Pole, Alert, Svalbard, Tromsø).
  - Explicit crossing classification: categorized crossings into `well_conditioned`, `grazing`, and `ill_conditioned` ($|dh/dt| < 10^{-7\circ}/\text{s}$) with second-derivative curvature governing grazing transitions.
  - Canonical astronomical time-scale contract: `BaseAstronomicalTimeScale` base class automatically deriving `toTerrestrialJulianDay`, `toUt1JulianDay`, and `toTerrestrialJulianCentury` from `getDeltaT` and `getDut1`; mutual-recursion-immune delegation; strict `validateAstronomicalTimeScale` ($10^{-7}$ day tolerance); provider metadata documenting DUT1 = 0 as an operational civil broadcast approximation; propagation of provider uncertainty into `combinedCoordinateUncertaintyDeg` and event-time uncertainties.
  - Elevation datum & horizon dip semantics: documented `Place.elevationMeters` as orthometric height above mean sea level (MSL / geoid) assuming an unobstructed geometric sea horizon, explicitly excluding topographical viewsheds and architectural obstructions. Documented elevation-adjusted threshold $\theta_{\text{eff}} = -0.8333^\circ - d_{\text{dip}}$ across `Place`, `SolarState`, `SolarPhase`, and `PolarRegime`.
  - Multi-century accuracy validation: added 25 global reference vectors across Tokyo, Cairo, New York, Sydney, and Quito (1850, 1900, 1950, 2026, 2075 CE) with documented provenance, distinguishing assumed numerical error (±0.01°) from empirical accuracy (< 0.02°).
  - Contract & metadata consistency: enforced exact equality `SolarEventInstant.uncertaintyMinutes === uncertainty.eventTimeUncertaintyMinutes`; clarified `dstConfidence: 'authoritative'`; documented `MAX_SAFE_POLAR_BRACKET_WIDTH_NS` (< Number.MAX_SAFE_INTEGER).
  - Full verification suite: clean TypeScript build, 318 passing tests with >97% coverage.
- [x] **Phase 3 — Temporal Conditions & Resolver**:
  - **Typed Condition AST & Fluent Builder** (`src/core/resolver/ast.ts`, `builder.ts`): Pure JSON-serializable AST node definitions with comparison (`gt`, `gte`, `lt`, `lte`, `eq`, `neq`, `between`, `in`) and logical operators (`and`, `or`, `not`). Typed properties for Solar (`elevation`, `azimuth`, `zenith`, `phase`, `isDirectSunlight`, `polarRegime`) and Civil (`hour`, `minute`, `second`, `dayOfWeek`, `day`, `month`, `year`, `isDaylightSaving`). Unit preservation (`deg`, `rad`, `hours`, `minutes`, `seconds`). Fluent `Conditions` builder API (`Conditions.solar.elevation.gte(10)`, `Conditions.civil.hour.between(9, 17)`, `Conditions.and(...)`, etc.) with runtime-immutable frozen nodes.
  - **Continuous Monotonic Branch Root-Finding Solar Engine** (`src/core/resolver/solver-solar.ts`): Partitions diurnal cycles by transit extrema (solar noon and midnight) into strictly monotonic ascending and descending branches. Bracketed Brent-Dekker root-finding solving $h(t^*) - \theta = 0$ with relative nanoseconds in safe-integer range and residual verification ($|h(t^*) - \theta| < 10^{-5\circ}$). Continuous bisection root-finding for azimuth crossings ($< 10^{-5\circ}$ accuracy). Half-open interval generation $[t_{\text{start}}, t_{\text{end}})$ clipped to search window. Continuous full-window intervals for Polar Day / Midnight Sun (Svalbard in June); empty `IntervalSet` for Polar Night (Tromsø in December); tangential grazes handled cleanly without oscillation.
  - **Discrete Civil Calendar Interval Solver** (`src/core/resolver/solver-civil.ts`): Iterates calendar days within search window in target IANA timezone. Synthesizes exact half-open intervals using verified `Time.civil.resolve()` with DST disambiguation, supporting `hour` (`neq`, `between` up to 24), `minute` (all operators and hour compositions), `second`, and sub-second binary search DST transition detection.
  - **IntervalSet Algebraic Combinator & Engine** (`src/core/resolver/engine.ts`): Exact Allen interval algebra: $AND = \cap$ (`intersect()`), $OR = \cup$ (`union()`), $NOT = \text{complement}(W)$. Preserves mathematical closure and half-open semantics.
  - **Temporal Intent Policy & Duration Filters** (`src/core/resolver/intent.ts`): Selection policies (`'all'`, `'earliest'`, `'latest'`, `'longest'`) with `totalMatchesFound` preservation and non-negative `minDuration` constraint filtering.
  - **Explainable Resolution Reports** (`src/core/resolver/report.ts`): Detailed `ResolutionReport` documenting query string, search window, place, models consulted, execution time, accuracy metadata, and start/end boundary explanations with model, reason, condition description, and residuals. Preserves numerical residuals across inverted, complement, and bounded interval conditions.
  - **Developer Facade Integration** (`src/index.ts`): `Time.resolve({ place, within, where, policy, minDuration }): ResolutionResult` and `Time.conditions`.
  - **Full Verification Suite**: 370/370 passing tests across 18 test files with 91.93% statement coverage and 0 TypeScript build errors.
- [x] **Phase 3.1 — Correctness Hardening**:
  - **Civil Timezone Contract Enforcement**: Eliminated silent UTC fallbacks across `solver-civil.ts`, `engine.ts`, and `report.ts`. Explicit `place.timeZoneId` or registered geographic `timeZoneLookupProvider` strictly required when resolving civil conditions (`node.domain === 'civil'`); throws exact `TypeError: Civil condition resolution requires an explicit timeZoneId on Place or a registered geographic timezone lookup provider`. Solar-only conditions resolve cleanly on places without timezone IDs and omit civil details from `ResolutionReport`.
  - **DST Repeated-Hour Disambiguation Correctness & HourBlock Partitioning**: Fall-back transition days (e.g. `America/New_York` Nov 1, 2026, `Australia/Sydney` April 5, 2026) detect offset shifts between day boundaries and partition the day into contiguous `HourBlock`s (`getHourBlocksForDay`). Ambiguous repeated hours synthesize both physical occurrences (`'earlier'` and `'later'`) into canonical `IntervalSet` for ambiguous wall-clock queries (`hour`, `minute`, `second`, `between`), supporting boolean disambiguation (`AND isDaylightSaving`). Strict minute and second containment prevents cross-hour leakage (e.g. `minute == 59` strictly 60 seconds, `hour < 1` strictly 1 hour).
  - **Azimuth Wrap & Continuous Crossing Provenance**: Rigorous 0°/360° North branch cut handling in `solver-solar.ts` and `report.ts`. Distinguishes geometric azimuth wrap boundaries (`isWrapBoundary: true`, `boundaryCategory: 'azimuth_wrap'`, reason mentioning wrap, omitting residual) from continuous threshold crossings ($A(t) = \theta$, with validated residual $< 10^{-4\circ}$). Verified across near-zenith passes (Singapore) and high-latitude midnight sun sweeps (Tromsø).
  - **Continuous Comparison Semantics Documentation**: Explicit mathematical documentation of measure-zero boundary point semantics ($eq \to \emptyset$, $neq \to W$, $gt$ vs $gte$ open/closed boundary equivalence under continuous measure theory).
  - **AST Validation & Property-Operator Matrix**: Strict validation enforcing property-operator compatibility (`eq`/`neq`/`in` for categorical/boolean; relational for numeric), non-finite number rejection (`TypeError` for `NaN`/`Infinity`), bounds enforcement (`RangeError` on civil properties), and unit validation (`TypeError` on incompatible units). Supported `polarRegime.in(...)` in solar solver.
  - **Model-Specific Accuracy Metadata**: Model-domain accuracy reporting in `ResolutionReport.accuracy` (omitting solar tolerance when civil-only and reporting civil integer exactness).
  - **Regression Test Suite & Metrics**: 391/391 passing tests across 18 test files, 93.67% statement coverage, 90.08% branch coverage, 96.5% function coverage, 0 TypeScript build errors.
- [x] **Phase 4 — Developer SDK & Package Integration**:
  - **Public API Audit & Clean Type Exports** (`src/index.ts`, `src/core/index.ts`): Re-exported and audited all public types (`ResolutionResult`, `ResolutionReport`, `IntervalExplanation`, `BoundaryExplanation`, `SolarState`, `CivilState`, `PlaceOptions`, `DurationFields`, `AllenRelation`, `ConditionAST`, `AtomicConditionNode`, `LogicalConditionNode`, `ComparisonOperator`, `LogicalOperator`, `SolarProperty`, `CivilProperty`, `AngleUnit`, `TimeUnit`, `InstantJSON`, `DurationJSON`, `PlaceJSON`, `IntervalJSON`, `IntervalSetJSON`, `InstantParseOptions`, `LeapSecondPolicy`, `SolarEventName`, `SolarEventInstant`, `SolarTransitionInstant`, `CivilTransitionInfo`, etc.) at the package root level. Enhanced JSDoc comments across all public methods, builder interfaces, and resolution report interfaces. Supported both named and default `Time` imports, plus polymorphic `Time.instant()` accepting `Instant` instances and TC39 Temporal `{ epochNanoseconds: bigint }` objects. Backwards compatibility alias `export const ChronoFlux = Time;`.
  - **Package Integrity & Configuration** (`package.json`, `LICENSE`): Renamed package to `time-2.0`. Configured `files: ["dist", "README.md", "LICENSE"]`, `engines: { "node": ">=18.0.0" }`, git repository metadata, `prepack: "npm run build"`, and standard MIT License. Preserved the zero-production-dependency invariant (`dependencies: {}`).
  - **Tarball Whitelist & External Consumer Verification** (`test-consumer/`): Verified package archive (`time-2.0-0.1.0.tgz`, 136.4 kB) contains strictly `dist/`, `README.md`, `LICENSE`, and `package.json` without source or dev files. Verified external consumer in ESM JavaScript (`consumer.js`) and strict TypeScript (`consumer.ts` with `tsconfig.json`) importing the package tarball and confirming end-to-end execution without source-tree dependencies.
  - **GitHub Actions CI Matrix** (`.github/workflows/ci.yml`): Multi-version matrix pipeline on Node.js `18.x`, `20.x`, and `22.x` on `ubuntu-latest`, executing `npm ci`, `npm run build`, `npm test`, `npm run test:coverage`, `npm pack`, and external consumer smoke tests with `time-2.0-*.tgz`.
  - **Documentation & Runnable Examples** (`docs/`, `examples/`, `README.md`): Authored comprehensive guides in `docs/` (`installation.md`, `quickstart.md`, `primitives.md`, `solar.md`, `civil.md`, `resolver.md`, `provenance.md`, `accuracy-and-limitations.md`). Authored 6 practical runnable TypeScript examples in `examples/` (`01-solar-daylight.ts`, `02-civil-business-hours.ts`, `03-solar-and-civil.ts`, `04-polar-regimes.ts`, `05-dst-recurring.ts`, `06-multi-location.ts`).
  - **Focused Correctness Hardening & Regression Suite** (`tests/phase4-sdk.test.ts`, `ast.ts`): Enforced integer validation on discrete civil properties; enforced categorical enum validation; verified half-open `between` semantics on calendar properties; asserted package archive integrity.
  - **Full Verification Suite**: 407/407 passing tests across 19 test files with 93.71% statement coverage, 90.14% branch coverage, 96.51% function coverage, and 0 TypeScript build errors.
- [x] **Phase 5 — Visual Diagnostic Suite & Transformation**:
  - **Complete Product Transformation**: Rebranded from ChronoFlux to **TIME 2.0 (`time-2.0`)**, with unified primary facade `Time` and full backwards-compatibility alias `ChronoFlux = Time`.
  - **5-View Visual Suite with Glassmorphic Design**:
    - **Home**: Plain-language overview, interactive 3-step sandbox (`Time.now()`, `Time.solar.evaluatePosition()`, `Time.resolve()`), and feature highlights.
    - **Explore & Learn**: 6 interactive educational questions explaining temporal fundamentals (Midnight Sun, DST Fall-Back, Nautical vs Civil Twilight, etc.).
    - **Visualize**: Interactive 3D WebGL Earth globe with day/night terminator line, real-time subsolar ray point, and High-DPI canvas diurnal elevation/azimuth chart with twilight bands.
    - **Build Conditions**: Visual query preset builder with 6 real-world presets, custom AST constructor, and live `ResolutionReport` inspector.
    - **Docs & Glossary**: 3-layer in-app documentation viewer and 12-term interactive searchable modal glossary.
  - **Tailwind CSS & Styling Pipeline**: Full Tailwind CSS integration via PostCSS in dev and production build, verified across responsive layouts.
  - **Phase 5 Verification Suite** (`tests/phase5-visualizer.test.ts`): 26 tests verifying state hooks, presets, subsolar calculations, timeline conversions, glossary definitions, educational questions, and facade backwards compatibility.
  - **Full Test Matrix**: 433/433 passing tests across 20 test suites with 0 failures and 0 TypeScript build errors.
- [ ] **Phase 6 — Extended Models**: Environmental, energy/grid, and computational models.
