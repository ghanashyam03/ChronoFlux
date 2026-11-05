# Installation & Setup

`time-2.0` (TIME 2.0) is a zero-dependency, high-precision temporal foundation and condition-state engine for Node.js and modern JavaScript/TypeScript runtimes.

## Engine Requirements

- **Node.js**: `>= 18.0.0` (LTS recommended: 18.x, 20.x, or 22.x)
- **TypeScript**: `>= 5.0.0` (optional, for type checking and IntelliSense)
- **Module Format**: ECMAScript Modules (`ESM`, `"type": "module"`)

## Package Installation

Install via your preferred package manager:

```bash
# npm
npm install time-2.0

# pnpm
pnpm add time-2.0

# yarn
yarn add time-2.0
```

## Zero Production Dependencies

`time-2.0` has **zero external runtime dependencies**. All mathematical ephemeris calculations, coordinate transformations, bracketed Brent-Dekker root solvers, nanosecond arithmetic primitives, and IANA timezone evaluators are implemented natively from first principles without pulling in transitive packages.

## Package Exports & Import Styles

The package exports both named exports and a frozen default facade object `Time` (with backwards-compatible `ChronoFlux` alias).

### Named Imports (Recommended for Tree-Shaking)

```typescript
import {
  Time,
  ChronoFlux, // Backwards-compatibility alias
  Instant,
  Duration,
  Place,
  Interval,
  IntervalSet,
  Conditions,
  resolve,
} from 'time-2.0';
import type {
  ResolutionResult,
  ResolutionReport,
  SolarState,
  CivilDateTime,
} from 'time-2.0';
```

### Facade Import

```typescript
import { Time } from 'time-2.0';

const instant = Time.now();
const place = Time.place({ latitude: 35.6762, longitude: 139.6503, timeZoneId: 'Asia/Tokyo' });
```

### Backwards Compatibility

```typescript
import { ChronoFlux } from 'time-2.0';

console.assert(ChronoFlux === Time); // true
```
