# Temporal Condition Resolver

The ChronoFlux Resolver is a hybrid continuous/discrete temporal constraint satisfaction engine. It compiles declarative conditions into verified continuous half-open interval sets $[t_{\text{start}}, t_{\text{end}})$.

---

## 1. Declarative Condition AST

Queries are represented as pure, JSON-serializable Abstract Syntax Tree (AST) nodes without executable JavaScript closures. This allows queries to be stored in databases, transmitted over network APIs, and deterministically audited.

### Supported Condition Properties

- **Solar Domain (`solar`)**:
  - `elevation` (continuous, degrees or radians)
  - `azimuth` (continuous, $[0^\circ, 360^\circ)$)
  - `zenith` (continuous, $[0^\circ, 180^\circ]$)
  - `phase` (categorical: `'day'`, `'civil_twilight'`, `'nautical_twilight'`, `'astronomical_twilight'`, `'night'`)
  - `polarRegime` (categorical: `'none'`, `'polar_day'`, `'polar_night'`)
  - `isDirectSunlight` (boolean)

- **Civil Domain (`civil`)**:
  - `hour` (discrete integer: $0..24$, supports half-open `between`)
  - `minute` (discrete integer: $0..60$)
  - `second` (discrete integer: $0..60$)
  - `dayOfWeek` (discrete integer: $1..7$, Monday = 1, Sunday = 7)
  - `day` (discrete integer: $1..31$)
  - `month` (discrete integer: $1..12$, January = 1, December = 12)
  - `year` (discrete integer)
  - `isDaylightSaving` (boolean)

---

## 2. Fluent Builder (`Conditions`)

ChronoFlux provides a strongly typed fluent builder `Conditions`:

```typescript
import { Conditions } from '@chronoflux/core';

// 1. Solar angle conditions
const daylight = Conditions.solar.elevation.gte(10); // elevation >= 10°
const morningSun = Conditions.solar.azimuth.between(90, 180); // East to South

// 2. Civil calendar conditions
const bizHours = Conditions.civil.hour.between(9, 17); // 09:00 to 17:00
const weekdays = Conditions.civil.dayOfWeek.between(1, 5); // Monday through Friday

// 3. Logical composition
const workDaylight = Conditions.and(daylight, bizHours, weekdays);
const weekendOrNight = Conditions.or(
  Conditions.civil.dayOfWeek.in([6, 7]),
  Conditions.solar.phase.eq('night')
);
const notDst = Conditions.not(Conditions.civil.isDaylightSaving.eq(true));
```

---

## 3. Continuous Solar Solver Mechanics

Solar elevation and azimuth are continuous functions of physical time $f(t)$. The ChronoFlux solar solver:
1. **Partitions Diurnal Cycles**: Splits each diurnal cycle into strictly monotonic ascending (midnight $\to$ noon) and descending (noon $\to$ midnight) branches using exact transit extrema.
2. **Bracketed Brent-Dekker Root Solving**: Finds the exact crossing instant $t^*$ where:
   $$h(t^*) - \theta = 0$$
   Guarantees convergence with relative residuals:
   $$|h(t^*) - \theta| < 10^{-5\circ}$$
3. **Azimuth Branch Cut Handling**: Detects and handles geometric $0^\circ / 360^\circ$ North wraps without spurious oscillation.
4. **Half-Open Interval Generation**: Produces exact half-open intervals $[t_{\text{start}}, t_{\text{end}})$ clipped to the bounding search window.

---

## 4. Discrete Civil Solver Mechanics

Civil time conditions operate on human calendar units. The civil solver:
1. **Day Iteration**: Iterates calendar days spanning the search window in the observer's target IANA timezone.
2. **HourBlock Partitioning**: Partitions days into contiguous hour blocks, resolving DST fall-back transitions so that ambiguous repeated hours (e.g. 01:00-02:00 occurring twice) evaluate both physical instances into canonical interval sets.
3. **Half-Open Calendar Semantics**: Ensures that `between(9, 17)` corresponds to $[09:00, 17:00)$ and `dayOfWeek.between(1, 5)` yields $[Monday\text{ }00:00, Saturday\text{ }00:00)$ (exactly 5 full days).

---

## 5. Algebraic Composition & Intent Policies

Once individual conditions are evaluated, the algebraic combinator applies exact Allen algebra:
- **`AND`**: Set intersection ($\cap$)
- **`OR`**: Set union ($\cup$)
- **`NOT`**: Set complement relative to search window ($W \setminus S$)

### Selection Policies

When resolving queries, specify how candidate intervals are selected:
- `'all'` (default): Returns all matching intervals.
- `'earliest'`: Returns only the first chronological matching interval.
- `'latest'`: Returns only the last chronological matching interval.
- `'longest'`: Returns the interval with the greatest duration.

```typescript
import { ChronoFlux, Conditions, Instant, Duration } from '@chronoflux/core';

const place = ChronoFlux.place({ latitude: 48.8566, longitude: 2.3522, timeZoneId: 'Europe/Paris' });
const searchWindow = ChronoFlux.interval(ChronoFlux.now(), ChronoFlux.now().add(Duration.fromDays(7)));

const result = ChronoFlux.resolve({
  place,
  within: searchWindow,
  where: Conditions.and(
    Conditions.solar.elevation.gte(15),
    Conditions.civil.hour.between(10, 16)
  ),
  policy: 'longest',
  minDuration: Duration.fromHours(2),
});
```
