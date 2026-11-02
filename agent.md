# ChronoFlux — Agent Guide (`agent.md`)

This document serves as the canonical orientation, architecture guide, and operational instructions for all AI agents working on the **ChronoFlux** codebase.

---

## 1. Project Mission & Core Philosophy

**ChronoFlux is a general-purpose temporal foundation that software can use wherever it currently uses time.**

ChronoFlux does not replace standard clocks or rename UTC. It provides:
1. A globally consistent, high-resolution temporal core.
2. Extensible models for evaluating temporal state (physical, civil, environmental) at any instant and place.
3. A declarative temporal condition and intent resolver based on Allen's Interval Algebra.

### Guiding Principles
- **No Gimmicks**: ChronoFlux is not a decorative 3D globe or a toy clock face. Visualizations belong strictly to Layer 6 as diagnostic and inspection tools.
- **Canonical High Resolution**: Internal instants and durations are stored as exact signed integer nanoseconds using JavaScript `bigint`. No floating-point arithmetic is permitted for canonical timestamps or durations.
- **Separation of Concerns**:
  - `Instant` $\neq$ `Civil Time` $\neq$ `Solar State`.
  - An `Instant` is an unambiguous point on the timeline.
  - A `Place` is a physical geographic coordinate (WGS84). Time zones are contextual, not intrinsic to a coordinate.
  - A Daylight Saving Time (DST) shift changes civil representation, never the underlying instant or elapsed duration.
- **Precision vs. Resolution vs. Accuracy**:
  - **Timestamp Representation Precision**: The numerical granularity of ChronoFlux's data structures is exact signed BigInt nanoseconds ($10^{-9}\text{ s}$). This guarantees zero arithmetic drift, zero rounding errors in temporal arithmetic, and exact transitivity across a $\pm 100,000,000$ day range ($\pm 273,790$ years).
  - **Clock Resolution**: The smallest detectable increment provided by an underlying hardware or runtime clock source (e.g. $1\text{ ms}$ for `Date.now()`, $1\text{–}100\ \mu\text{s}$ for `performance.now()`, $1\text{ ns}$ for `process.hrtime.bigint()`). High representation precision allows ChronoFlux to ingest any clock resolution without quantization loss, but does not magically upgrade a low-resolution clock.
  - **Clock Accuracy (Measurement Accuracy)**: The degree of conformance between a clock reading and true standard time (UTC/BIPM atomic clock standard), governed by physical oscillators and network sync protocols (e.g. NTP $\pm 1\text{–}50\text{ ms}$, PTP $\pm 1\ \mu\text{s}$, GPS $\pm 10\text{ ns}$). High representation precision must never be conflated with physical sensor accuracy.
- **Leap Second Policy**: ChronoFlux operates on a leap-second-free Unix epoch timeline (86,400 SI seconds per nominal day). For ISO-8601 parsing, second `:60` is accepted only on authentic historical IERS leap second dates at UTC 23:59:60Z and clamped to second 59 per RFC 3339 / POSIX compatibility mode (`leapSecondPolicy: 'compatible'`).
  - *Justification for Compatibility Mode*: RFC 3339 Section 5.6 allows leap seconds as `:60`. To maintain interoperability with existing timestamp feeds and preserve backward compatibility with the existing Phase 1 test suite, the core parser defaults to `compatible` mode. Second 60 is strictly validated against the 27 authentic IERS historical dates; non-zero UTC offsets and arbitrary calendar dates are strictly rejected with a `RangeError`.
  - *Strict Rejection*: Core parsing also supports strict rejection mode (`leapSecondPolicy: 'reject'` or `'strict'`), which strictly forbids second 60 per ChronoFlux's leap-second-free Instant model.

---

## 2. System Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 6: Visualizer & DevTools (Diagnostics, 3D Globe, UI)   │
├─────────────────────────────────────────────────────────────┤
│ Layer 5: Developer SDK & Interoperability Facade            │
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
   - Remote origin: `https://github.com/ghanashyam03/ChronoFlux.git`.
   - Ensure `npm test`, `npm run test:coverage`, and `npm run build` pass with zero warnings before pushing.

---

## 5. Development Commands

```bash
# Run test suite
npm test

# Run tests in watch mode
npm run test:watch

# Run test coverage
npm run test:coverage

# Build TypeScript output
npm run build
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
- [ ] **Phase 2 — Solar & Civil Temporal Models**: Astronomical mechanics (Meeus/NOAA equations), elevation, azimuth, twilight regimes, polar night/midnight sun, and IANA timezone translation.
- [ ] **Phase 3 — Temporal Conditions & Resolver**: Typed Condition AST, continuous root-finding/bisection, and explainable interval synthesis.
- [ ] **Phase 4 — Developer SDK & Benchmarks**: Golden vector NOAA validation and public facade packaging.
- [ ] **Phase 5 — Visual Diagnostic Suite**: Interactive spacetime ribbon, solar curves, and developer query console.
- [ ] **Phase 6 — Extended Models**: Environmental, energy/grid, and computational models.
