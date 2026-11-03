# Antigravity Workspace Guide (`antigravity.md`)

This file documents the Antigravity tooling configuration, slash command protocols, and orchestration workflows for the **ChronoFlux** repository.

---

## 1. Workspace Identity & Context

- **Project Name**: ChronoFlux
- **Workspace Path**: `c:\Users\ghana\Documents\antigravity\noble-pythagoras`
- **GitHub Repository**: `https://github.com/ghanashyam03/ChronoFlux.git`
- **Primary Branch**: `main`
- **Core Technology Stack**: TypeScript, Node.js (ESM), Vitest, fast-check (property-based testing)
- **Artifact Directory**: `C:\Users\ghana\.gemini\antigravity\brain\1664b0a0-4c81-4618-b7c3-8594bb1307d1`

---

## 2. Active Slash Commands & Protocols

### `/plan` (Planning Protocol)
- Every major architectural shift or phase transition must be planned and documented in an implementation plan artifact located in the artifact directory before modifying code.
- Current active architectural plan: [`planetary_time_system_plan.md`](file:///C:/Users/ghana/.gemini/antigravity/brain/1664b0a0-4c81-4618-b7c3-8594bb1307d1/planetary_time_system_plan.md).

### `/boost` (Orchestration & Delegation Protocol)
- Complex coding and deep investigation tasks utilize the **Delegation Routine**:
  - **Coding Tasks**: Delegated to `DeepCoder` (`TypeName='DeepCoder'`, `Workspace='inherit'`).
  - **Investigation Tasks**: Delegated to `DeepInvestigator` (`TypeName='DeepInvestigator'`, `Workspace='inherit'`).
- The orchestrator agent independently verifies code changes, runs tests, inspects branch coverage, and handles git synchronization.

### `/automation` (Continuous Execution Protocol)
- Used for running scheduled background pipelines, test runners, and long-running temporal verification suites.

---

## 3. Git & Continuous Integration Policy

- All code committed to `main` must pass the full test suite (`npm test`), coverage runner (`npm run test:coverage`), and build (`npm run build`).
- Every commit must follow conventional commit prefixes:
  - `feat(core):` new temporal primitives, models, or resolver components
  - `test(core):` unit, property-based, or golden vector tests
  - `docs:` documentation updates (`agent.md`, `antigravity.md`, `README.md`)
  - `fix(core):` bug fixes, invariant hardening, or mathematical corrections
- Automatic remote synchronization: After every successful phase milestone and test verification, changes must be pushed to `origin main`.

---

## 4. Architectural Distinctions: Precision, Resolution, Accuracy

All agents and contributors must strictly distinguish between three temporal dimensions:

1. **Timestamp Representation Precision**:
   - The data structure format and mathematical granularity used internally by ChronoFlux.
   - ChronoFlux uses **exact signed 64-bit+ BigInt nanoseconds ($10^{-9}\text{ s}$)**.
   - Guarantees exact integer arithmetic, zero numerical drift, and algebraic closure across $\pm 100,000,000$ days ($\pm 273,790$ years).

2. **Clock Resolution**:
   - The finest measurable step or tick rate of the clock source feeding timestamps into the system.
   - Examples: `Date.now()` ($1\text{ ms}$), `performance.now()` ($1\text{–}100\ \mu\text{s}$), `process.hrtime.bigint()` ($1\text{ ns}$).
   - High representation precision enables lossless ingestion of high-resolution clocks without pretending a low-resolution clock has more information than it provides.

3. **Clock Accuracy (Measurement Accuracy)**:
   - The degree to which a physical clock source reading matches official UTC standard time (maintained by BIPM/NIST).
   - Constrained by physical oscillator drift and network synchronization protocols (NTP: $\pm 1\text{–}50\text{ ms}$, PTP: $\pm 1\ \mu\text{s}$, GPS: $\pm 10\text{ ns}$).
   - Precision describes storage capability; accuracy describes physical ground truth.

---

## 5. Current Status & Phase Tracking

| Milestone | Status | Deliverables |
| :--- | :--- | :--- |
| **Phase 1: Temporal Foundations** | **COMPLETED** | - `Instant` (BigInt nanoseconds, millisecond rounding modes, Date/Temporal adapters)<br>- `Duration` (signed nanoseconds, SI units, ISO-8601 formatting)<br>- `Place` (WGS84 validation, contextual timezone separation)<br>- `Interval` (half-open $[start, end)$, 13 Allen relationships)<br>- `IntervalSet` (canonical disjoint normalization, set algebra)<br>- 140/140 Vitest tests passing with property-based testing. |
| **Phase 1.1: Correctness & Invariant Hardening** | **COMPLETED** | - **Runtime Immutability**: `Object.freeze` on all instances and backing arrays (`IntervalSet.intervals`).<br>- **Exact Numerical Inputs**: Elimination of silent `Math.trunc()`; safe integer enforcement on `number`; BigInt/decimal string/scientific notation support; explicit `RoundingMode` policy for fractional units.<br>- **Leap-Second Semantics**: Authentic IERS leap second calendar validation (27 historical events), non-zero UTC offset rejection, strict rejection option, and RFC 3339 compatibility mode.<br>- **Allen API Naming**: Generic intersection via `intersects()`; canonical 13 relations via `relationTo()`; symmetric helper methods including `isEquals()`.<br>- 178/178 tests passing with 98.22% line coverage and 0 build errors. |
| **Phase 2: Solar & Civil Models** | **COMPLETED** | - `TemporalModel<TState>` and `ModelMetadata` interfaces with formal accuracy bounds.<br>- Astronomical Solar Model (`src/core/models/solar/`): Meeus / NOAA algorithms, elevation, azimuth, zenith, solar noon/midnight, and Saemundsson / Bennett refraction.<br>- Twilight regimes: civil, nautical, astronomical, night, day.<br>- Polar edge case handlers: Polar Day (`polar_day`, Midnight Sun) and Polar Night (`polar_night`) in Tromsø (69.65°N) and Svalbard (78.22°N), plus North and South Pole (±90°) equinox sunrise/sunset resolution.<br>- Civil Time Model (`src/core/models/civil/`): IANA time zone integration, UTC offsets, DST detection, pre-1970 negative nanosecond floor division, 2-digit year safety, and TC39 disambiguation (`compatible`, `earlier`, `later`, `reject`).<br>- Golden vector validation across 50 NOAA reference points (< 0.02° error) and 220/220 passing tests (97.61% line coverage). |
| **Phase 2.1: Scientific & Semantic Correctness Audit** | **COMPLETED** | - **Geometric Elevation Semantics**: Rigorous convention defining primary coordinates on geometric solar elevation $h_{\text{geom}}$; harmonized direct-sunlight ($h_{\text{geom}} \ge -0.8333^\circ$), twilights, and polar day/night.<br>- **Complete Solar Event API**: Implemented `nauticalDawn`, `nauticalDusk`, `astronomicalDawn`, and `astronomicalDusk` across all 10 standard solar transitions.<br>- **Civil-Time Correctness**: Eliminated silent UTC fallback when `Place.timeZoneId` is omitted (throws descriptive `TypeError`); introduced pluggable `TimeZoneLookupProvider`; robust non-heuristic DST classification distinguishing physical UTC offset from DST.<br>- **Accuracy & Uncertainty Decomposition**: Dynamic event-time uncertainty ($\Delta t = \Delta h / |dh/dt|$) expanding at high latitudes and stationary transits; separated numerical ($\pm 0.01^\circ$), atmospheric refraction ($\pm 0.05^\circ$), event-time, and horizon dip.<br>- **Safeguarded Root-Finding**: Hybrid bracketed Newton-Raphson/bisection solver; boundary tests across Arctic/Antarctic circles ($66.0^\circ, 66.564^\circ, 67.0^\circ, -68.0^\circ$); explicit indeterminate azimuth handling at zenith/nadir/poles; elevation residual verification.<br>- **Performance & Reproducibility**: High-throughput `solar.evaluatePosition`; diurnal cycle event caching; civil time database runtime provenance exposure; fractional `searchLimitDays` hardening.<br>- 251/251 tests passing with 97.19% line coverage and 0 build errors. |
| **Phase 2.2: Numerical Reliability & Temporal Semantics** | **COMPLETED** | - **Polar Root-Finding**: Genuine bracketed Brent-Dekker solver with explicit convergence status and residual verification ($|h(t) - \theta| < 10^{-5\circ}$) in `math.ts`.<br>- **Exact Cache Key Precision**: Coordinate and elevation stringification without lossy truncation (`${lat},${lon},${elev}:${noonSeconds}`).<br>- **Uncertainty Semantics**: Separated instantaneous angular uncertainty $\Delta h(t)$, crossing sensitivity $|dh/dt|$ (`crossingSensitivityDegPerMin`), and event-crossing uncertainties (`sunriseUncertaintyMinutes`, `sunsetUncertaintyMinutes`) evaluated at actual event instants.<br>- **Polar Regime vs Solar Phase**: Decoupled diurnal `polarRegime` (`'polar_day' | 'polar_night' | 'none'`) from instantaneous illumination `phase` (`'day' | 'civil_twilight' | 'nautical_twilight' | 'astronomical_twilight' | 'night'`). Locations in polar night correctly report twilight.<br>- **Astronomical Time-Scale Policy**: Explicit UTC, UT1, TAI, TT, and $\Delta T$ documentation with extensible `AstronomicalTimeScale` interface and `StandardAstronomicalTimeScale` provider (`timescale.ts`).<br>- **Validity Enforcement**: Explicit `isWithinValidityRange` and `isAccuracyDegraded` flags (1800-2100 CE) with quadratic numerical error expansion when extrapolated.<br>- **Civil DST Classification**: Preserved exact IANA offset with `dstConfidence: 'authoritative' | 'heuristic' | 'unknown'`.<br>- **Reproducible Performance Benchmarks**: Measured ~4.1 µs/op for `evaluatePosition` (245k ops/sec) and ~13.8 µs/op for cached `evaluate` (72k ops/sec); 275/275 tests passing with 97.52% line coverage. |
| **Phase 3: Conditions & Resolver** | **COMPLETED** | - **Typed Condition AST & Fluent Builder** (`src/core/resolver/ast.ts`, `builder.ts`): JSON-serializable AST node definitions with comparison and logical operators; typed properties for Solar and Civil; unit preservation (`deg`, `rad`, `hours`, `minutes`, `seconds`); runtime-immutable `Conditions` builder.<br>- **Continuous Solar Solver** (`src/core/resolver/solver-solar.ts`): Diurnal extrema partitioning, bracketed Brent-Dekker solver ($|h(t) - \theta| < 10^{-5\circ}$), continuous bisection root-finding for azimuth ($< 10^{-5\circ}$), half-open intervals, continuous Midnight Sun and empty Polar Night handling.<br>- **Discrete Civil Solver** (`src/core/resolver/solver-civil.ts`): IANA timezone calendar iteration, DST disambiguation, `minute` and `second` resolution, `hour.neq`, `hour.between` up to 24, safe date handling, and sub-second binary search DST transition detection.<br>- **Algebraic Combinator** (`src/core/resolver/engine.ts`): Exact Allen interval set algebra ($AND = \cap$, $OR = \cup$, $NOT = \text{complement}(W)$).<br>- **Intent Policies & Provenance Reports** (`src/core/resolver/intent.ts`, `report.ts`): Selection policies (`all`, `earliest`, `latest`, `longest`), non-negative `minDuration` constraint filtering, boundary explanation provenance preserving numerical residuals across inverted, complement, and bounded interval conditions.<br>- **Developer Facade**: `ChronoFlux.resolve(...)` and `ChronoFlux.conditions`.<br>- 370/370 passing tests across 18 test files with 91.93% line coverage and 0 build errors. |
| **Phase 3.1: Correctness Hardening** | **COMPLETED** | - **Civil Timezone Contract**: Removed silent UTC fallback; requires explicit `timeZoneId` or registered `timeZoneLookupProvider`; solar-only queries resolve cleanly without timezone.<br>- **DST Repeated-Hour Correctness & HourBlock Partitioning**: Partitions fall-back transition days into contiguous `HourBlock`s; synthesizes both EDT/EST occurrences for `hour`, `minute`, and `second` into canonical `IntervalSet` without boundary leakage or duration stretching.<br>- **Azimuth Wrap Provenance**: North 360°/0° branch cut wraps labeled as `azimuth_wrap` (`isWrapBoundary: true`, no residual), continuous crossings bracketed with verified residuals (< 1e-4°); verified across near-zenith (Singapore) and midnight sun (Tromsø) queries.<br>- **AST & Operator Matrix**: Strict bounds checking (`RangeError`), unit validation (`TypeError`), non-finite number rejection (`TypeError`), and property-operator matrix.<br>- **Accuracy Metadata**: Domain-specific report accuracy.<br>- 391/391 tests passing, 93.67% coverage, 0 build errors. |
| **Phase 4: Developer SDK & CI** | **COMPLETED** | - **Root Public API & Types**: Re-exported all core types (`ResolutionResult`, `ResolutionReport`, `IntervalExplanation`, `BoundaryExplanation`, `SolarState`, `CivilState`, `PlaceOptions`, `DurationFields`, `AllenRelation`, `ConditionAST`, `AtomicConditionNode`, `LogicalConditionNode`, `ComparisonOperator`, `LogicalOperator`, `SolarProperty`, `CivilProperty`, `AngleUnit`, `TimeUnit`, `InstantJSON`, `DurationJSON`, `PlaceJSON`, `IntervalJSON`, `IntervalSetJSON`, `InstantParseOptions`, `LeapSecondPolicy`, `SolarEventName`, `SolarEventInstant`, `SolarTransitionInstant`, `CivilTransitionInfo`, etc.) at package root.<br>- **Package Configuration**: Whitelisted `files: ["dist", "README.md", "LICENSE"]`, `engines: { "node": ">=18.0.0" }`, MIT `LICENSE`, zero production dependencies.<br>- **Tarball & External Consumer**: Clean `chronoflux-core-0.1.0.tgz` archive verified via independent ESM JavaScript (`consumer.js`) and strict TypeScript (`consumer.ts`) without source-tree dependencies.<br>- **GitHub Actions CI**: Matrix workflow (`.github/workflows/ci.yml`) on Node.js 18.x, 20.x, and 22.x.<br>- **Developer Documentation & Examples**: 8 comprehensive guides in `docs/` and 6 runnable TypeScript examples in `examples/`; API Reference Summary table in `README.md`.<br>- **Hardening & Regression**: Discrete civil integer validation on `in` array items, categorical enum validation, half-open calendar `between` semantics, tarball integrity assertions, `ChronoFlux.instant()` polymorphic ergonomics.<br>- 407/407 passing tests across 19 test files with 93.71% coverage and 0 build errors. |
| **Phase 5: Diagnostic Visualizer** | Queued | - Spacetime ribbon & elevation curve visualizer<br>- Interactive developer query console |
| **Phase 6: Extended Models** | Queued | - Environmental, grid energy, and computational time |
