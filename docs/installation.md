# Installation & Setup

`@chronoflux/core` is a zero-dependency, high-precision temporal foundation and condition-state engine for Node.js and modern JavaScript/TypeScript runtimes.

## Engine Requirements

- **Node.js**: `>= 18.0.0` (LTS recommended: 18.x, 20.x, or 22.x)
- **TypeScript**: `>= 5.0.0` (optional, for type checking and IntelliSense)
- **Module Format**: ECMAScript Modules (`ESM`, `"type": "module"`)

## Package Installation

Install via your preferred package manager:

```bash
# npm
npm install @chronoflux/core

# pnpm
pnpm add @chronoflux/core

# yarn
yarn add @chronoflux/core
```

## Zero Production Dependencies

`@chronoflux/core` has **zero external runtime dependencies**. All mathematical ephemeris calculations, coordinate transformations, bracketed Brent-Dekker root solvers, nanosecond arithmetic primitives, and IANA timezone evaluators are implemented natively from first principles without pulling in transitive packages.

## Package Exports & Import Styles

The package exports both named exports and a frozen default facade object `ChronoFlux`.

### Named Imports (Recommended for Tree-Shaking)

```typescript
import {
  ChronoFlux,
  Instant,
  Duration,
  Place,
  Interval,
  IntervalSet,
  Conditions,
  resolve,
} from '@chronoflux/core';
import type {
  ResolutionResult,
  ResolutionReport,
  SolarState,
  CivilState,
} from '@chronoflux/core';
```

### Facade Default Import

```typescript
import ChronoFlux from '@chronoflux/core';

const now = ChronoFlux.now();
const place = ChronoFlux.place({ latitude: 40.7128, longitude: -74.006, timeZoneId: 'America/New_York' });
```

## TypeScript Configuration

Ensure your `tsconfig.json` targets modern ECMAScript with Node module resolution:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true
  }
}
```
