# Resolution Reports & Mathematical Provenance

Every call to `Time.resolve()` generates a comprehensive `ResolutionReport` documenting how and why every boundary instant was chosen.

---

## 1. Structure of `ResolutionReport`

```typescript
export interface ResolutionReport {
  /** Serialized human-readable representation of the Condition AST */
  readonly query: string;

  /** The bounding search interval */
  readonly searchWindow: Interval;

  /** Observer location */
  readonly place: Place;

  /** Policy applied to filter candidate intervals */
  readonly policy: SelectionPolicy;

  /** Optional minimum duration filter */
  readonly minDuration?: Duration;

  /** Physical or calendar domains consulted (e.g. ['solar', 'civil']) */
  readonly modelsConsulted: readonly ('solar' | 'civil')[];

  /** Granular mathematical provenance for every resolved interval */
  readonly explanations: readonly IntervalExplanation[];

  /** Total count of matching intervals found prior to policy filtering */
  readonly totalMatchesFound: number;

  /** Execution runtime in milliseconds */
  readonly executionTimeMs: number;

  /** Accuracy metadata and bounds verification */
  readonly accuracy: {
    readonly solarNumericalToleranceDeg?: number;
    readonly isWithinValidityRange?: boolean;
    readonly isAccuracyDegraded?: boolean;
  };
}
```

---

## 2. Granular Boundary Explanations

Each `IntervalExplanation` documents the exact physical or civil reason for both the `start` and `end` instants of an interval:

```typescript
export interface BoundaryExplanation {
  /** Exact physical Instant of the boundary */
  readonly instant: Instant;

  /** 'start' or 'end' */
  readonly boundaryType: 'start' | 'end';

  /** Human-readable explanation of why this instant was selected */
  readonly reason: string;

  /** Underlying model that established this boundary */
  readonly model: 'solar' | 'civil' | 'window';

  /** Governing condition AST clause */
  readonly conditionDescription: string;

  /** Quantitative residuals, tolerances, and metadata */
  readonly details?: {
    readonly property?: string;
    readonly threshold?: number | string | boolean;
    readonly actualValue?: number | string | boolean;
    readonly residualDeg?: number; // Solver residual |f(t*) - θ|
    readonly toleranceDeg?: number;
    readonly timeZoneId?: string;
    readonly isWindowBoundary?: boolean;
    readonly isWrapBoundary?: boolean;
    readonly boundaryCategory?: string;
  };
}
```

---

## 3. Example: Inspecting Boundary Provenance

```typescript
import { Time, Conditions, Instant, Duration } from 'time-2.0';

const place = Time.place({
  latitude: 37.7749,
  longitude: -122.4194,
  timeZoneId: 'America/Los_Angeles',
});

const t0 = Instant.fromJSON('2026-06-21T07:00:00.000Z');
const window = Time.interval(t0, t0.add(Duration.fromDays(1)));

const result = Time.resolve({
  place,
  within: window,
  where: Conditions.and(
    Conditions.solar.elevation.gte(10),
    Conditions.civil.hour.between(9, 17)
  ),
});

for (const exp of result.report.explanations) {
  console.log(`Interval: [${exp.interval.start.toISOString()} → ${exp.interval.end.toISOString()})`);
  console.log(`  Start Reason: ${exp.startExplanation.reason}`);
  console.log(`  Governing Model: ${exp.startExplanation.model}`);
  if (exp.startExplanation.details?.residualDeg !== undefined) {
    console.log(`  Root Residual: ${exp.startExplanation.details.residualDeg.toExponential(2)}°`);
  }
  console.log(`  End Reason:   ${exp.endExplanation.reason}`);
}
```

Sample output:
```text
Interval: [2026-06-21T16:00:00.000Z → 2026-06-22T00:00:00.000Z)
  Start Reason: Civil time entered business hours (09:00) in America/Los_Angeles.
  Governing Model: civil
  End Reason:   Civil time exited business hours (17:00) in America/Los_Angeles.
```
