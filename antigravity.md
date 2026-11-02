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

- All code committed to `main` must pass the full test suite (`npm test`).
- Every commit must follow conventional commit prefixes:
  - `feat(core):` new temporal primitives, models, or resolver components
  - `test(core):` unit, property-based, or golden vector tests
  - `docs:` documentation updates (`agent.md`, `antigravity.md`, `README.md`)
  - `fix(core):` bug fixes or mathematical corrections
- Automatic remote synchronization: After every successful phase milestone and test verification, changes must be pushed to `origin main`.

---

## 4. Current Status & Phase Tracking

| Milestone | Status | Deliverables |
| :--- | :--- | :--- |
| **Phase 1: Temporal Foundations** | **COMPLETED** | - `Instant` (BigInt nanoseconds, millisecond rounding modes, Date/Temporal adapters)<br>- `Duration` (signed nanoseconds, SI units, ISO-8601 formatting)<br>- `Place` (WGS84 validation, contextual timezone separation)<br>- `Interval` (half-open $[start, end)$, 13 Allen relationships)<br>- `IntervalSet` (canonical disjoint normalization, set algebra)<br>- 132/132 Vitest tests passing with property-based testing. |
| **Phase 2: Solar & Civil Models** | **NEXT** | - Jean Meeus / NOAA astronomical equations<br>- Solar elevation, azimuth, zenith, twilight regimes<br>- Polar night & midnight sun handlers<br>- IANA civil time & DST transition disambiguation |
| **Phase 3: Conditions & Resolver** | Queued | - Typed AST & fluent query builder<br>- Numerical root-finding / bisection engine<br>- Explainable interval synthesis & provenance reports |
| **Phase 4: Developer SDK & CI** | Queued | - Zero-dependency public facade<br>- NOAA golden vector validation suite |
| **Phase 5: Diagnostic Visualizer** | Queued | - Spacetime ribbon & elevation curve visualizer<br>- Interactive developer query console |
| **Phase 6: Extended Models** | Queued | - Environmental, grid energy, and computational time |
