# Civil Time & IANA Time Zones

The TIME 2.0 Civil Model provides deterministic evaluation of human calendar time, IANA timezone rules, UTC offsets, and Daylight Saving Time (DST) disambiguation.

---

## 1. Wall-Clock Evaluation (`evaluate`)

Evaluating an `Instant` in an IANA timezone yields a comprehensive `CivilState`:

```typescript
import { Time } from 'time-2.0';

const place = Time.place({
  latitude: 40.7128,
  longitude: -74.006,
  timeZoneId: 'America/New_York',
});

const now = Time.now();
const civil = Time.civil.evaluate(now, place);

console.log(`${civil.year}-${civil.month}-${civil.day} ${civil.hour}:${civil.minute}:${civil.second}`);
console.log(`UTC Offset: ${civil.utcOffsetMinutes} minutes (${civil.utcOffset.totalHours}h)`);
console.log(`DST Active: ${civil.isDaylightSaving} (Confidence: ${civil.dstConfidence})`);
```

---

## 2. DST Wall-Clock Disambiguation (`resolve`)

During Daylight Saving Time transitions, wall-clock timestamps can become ambiguous (fall-back repeated hour) or non-existent (spring-forward skipped hour).

`Time.civil.resolve` (or `disambiguate`) implements the standard TC39 Temporal disambiguation policies:

### Policies

| Policy | Behavior during Spring-Forward Gap | Behavior during Fall-Back Repeated Hour |
| :--- | :--- | :--- |
| **`compatible` (default)** | Advances by the gap duration to the later valid time. | Selects the earlier instance (daylight / pre-transition). |
| **`earlier`** | Clamps to immediately before the gap starts. | Selects the earlier instance. |
| **`later`** | Advances past the gap. | Selects the later instance (standard time). |
| **`reject`** | Throws `RangeError`. | Throws `RangeError`. |

### Example: Fall-Back Ambiguous Hour in New York

On November 1, 2026, clocks in `America/New_York` turn back from 02:00 EDT to 01:00 EST. The wall-clock time `01:30` occurs twice:

```typescript
import { Time } from 'time-2.0';

// 1. Earlier occurrence (EDT, UTC-4)
const tEarlier = Time.civil.resolve({
  year: 2026,
  month: 11,
  day: 1,
  hour: 1,
  minute: 30,
  timeZoneId: 'America/New_York',
  disambiguation: 'earlier',
});

// 2. Later occurrence (EST, UTC-5)
const tLater = Time.civil.resolve({
  year: 2026,
  month: 11,
  day: 1,
  hour: 1,
  minute: 30,
  timeZoneId: 'America/New_York',
  disambiguation: 'later',
});

console.log(tEarlier.toISOString()); // 2026-11-01T05:30:00.000Z (EDT)
console.log(tLater.toISOString());   // 2026-11-01T06:30:00.000Z (EST)
console.log(tLater.since(tEarlier).totalHours); // Exactly 1 hour apart!
```

---

## 3. Pluggable Geographic Timezone Lookup

TIME 2.0 strictly prohibits silent fallback to UTC when evaluating civil conditions. If a `Place` does not have a static `timeZoneId`, you can register a pluggable geographic lookup provider (e.g. `@photostructure/tz-lookup`, `geo-tz`, or a GIS database):

```typescript
import { Time } from 'time-2.0';
import type { TimeZoneLookupProvider } from 'time-2.0';

const customProvider: TimeZoneLookupProvider = {
  lookup(latitude: number, longitude: number): string | null {
    // Example: custom GIS lookup or boundary evaluation
    if (latitude > 40 && latitude < 45 && longitude > -75 && longitude < -70) {
      return 'America/New_York';
    }
    return null;
  },
};

Time.civil.registerTimeZoneLookupProvider(customProvider);
```

---

## 4. Runtime & Database Provenance

To inspect the underlying IANA timezone database and Unicode CLDR version of the running Node.js host environment:

```typescript
import { Time } from 'time-2.0';

const provenance = Time.civil.getProvenance();
console.log(provenance);
// {
//   runtime: 'Node.js v22.0.0',
//   tzVersion: '2024a',
//   icuVersion: '74.2',
//   cldrVersion: '44.0',
//   unicodeVersion: '15.1'
// }
```
