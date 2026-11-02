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
- **Leap Second Policy**: Following standard Unix and TC39 `Temporal` conventions, epoch nanoseconds count nominal SI seconds from `1970-01-01T00:00:00Z` ignoring leap seconds. Astronomical time scales (TAI, TT, UT1) can be layered as adapters.

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

## 3. Core Primitives (Layer 1 Contracts)

All primitives are located in `src/core/primitives/`:

| Primitive | Class / Interface | Canonical Storage | Key Invariants |
| :--- | :--- | :--- | :--- |
| **Instant** | `Instant` | `readonly epochNanoseconds: bigint` | Immutable. Exact comparisons (`equals`, `isBefore`, `isAfter`). Rounding modes for millisecond conversions (`trunc`, `floor`, `ceil`, `halfExpand`). Safe serialization to decimal strings and ISO-8601 UTC strings. |
| **Duration** | `Duration` | `readonly nanoseconds: bigint` | Signed integer nanoseconds. Units: `nanoseconds`, `microseconds`, `milliseconds`, `seconds`, `minutes`, `hours`, `days`. Fixed elapsed time only (no calendar months/years). ISO-8601 duration formatting. |
| **Place** | `Place` | `latitude`, `longitude`, `elevationMeters?` | WGS84 coordinate bounds: $\text{lat} \in [-90, +90]$, $\text{lon} \in [-180, +180]$. Contextual `timeZoneId` kept separate from coordinate geometry. |
| **Interval** | `Interval` | `[start: Instant, end: Instant)` | Half-open: includes `start`, excludes `end`. Requires `start < end` (zero/negative durations rejected; empty sets represented by `IntervalSet.empty()`). Evaluates all 13 Allen relationships. |
| **IntervalSet**| `IntervalSet` | `readonly intervals: readonly Interval[]` | Canonical sorted, disjoint intervals with adjacent interval merging. Set algebra: union ($\cup$), intersection ($\cap$), difference ($\setminus$), and bounded complement. Point containment via binary search. |

### Allen's 13 Interval Relationships
Every pair of non-empty intervals $A$ and $B$ satisfies exactly one of the 13 Allen relations (`AllenRelation`):
1. `before` / `after`
2. `meets` / `metBy`
3. `overlaps` / `overlappedBy`
4. `starts` / `startedBy`
5. `during` / `contains`
6. `finishes` / `finishedBy`
7. `equals`

---

## 4. Coding Standards & Agent Rules

1. **Precision & Types**:
   - Always use `bigint` for timestamps and durations.
   - Never use `Math.floor` or floating-point division on nanoseconds. Use integer BigInt division and modulo (`/` and `%`).
   - Treat `Instant`, `Duration`, `Place`, `Interval`, and `IntervalSet` as deeply immutable.
2. **Error Handling**:
   - Throw descriptive `RangeError` or `TypeError` on invalid inputs (e.g. out-of-range coordinates, zero-length intervals, unparseable ISO strings).
3. **Property-Based Testing**:
   - Use `fast-check` alongside standard Vitest unit tests to stress-test boundary conditions, inverse properties, and algebraic laws (associativity, distributivity, De Morgan's laws).
4. **Git Discipline**:
   - Make atomic, descriptive commits following Conventional Commits (`feat(core): ...`, `test(core): ...`, `docs: ...`).
   - Remote origin: `https://github.com/ghanashyam03/ChronoFlux.git`.
   - Ensure `npm test` and `npm run build` pass with zero warnings before pushing.

---

## 5. Development Commands

```bash
# Run test suite
npm test

# Run tests in watch mode
npm run test:watch

# Build TypeScript output
npm run build

# Run linter
npm run lint
```

---

## 6. Implementation Roadmap Status

- [x] **Phase 1 — Temporal Foundations**: Canonical nanosecond `Instant`, `Duration`, `Place`, `Interval`, `IntervalSet`, 13 Allen relationships, fast-check property testing, and comprehensive test suite (132/132 tests passing).
- [ ] **Phase 2 — Solar & Civil Temporal Models**: Astronomical mechanics (Meeus/NOAA equations), elevation, azimuth, twilight regimes, polar night/midnight sun, and IANA timezone translation.
- [ ] **Phase 3 — Temporal Conditions & Resolver**: Typed Condition AST, continuous root-finding/bisection, and explainable interval synthesis.
- [ ] **Phase 4 — Developer SDK & Benchmarks**: Golden vector NOAA validation and public facade packaging.
- [ ] **Phase 5 — Visual Diagnostic Suite**: Interactive spacetime ribbon, solar curves, and developer query console.
- [ ] **Phase 6 — Extended Models**: Environmental, energy/grid, and computational models.
