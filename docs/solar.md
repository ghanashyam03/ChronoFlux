# Astronomical Solar Model

The TIME 2.0 Solar Model implements high-precision, continuous astronomical ephemeris algorithms based on Jean Meeus's *Astronomical Algorithms* (truncated planetary series) and NOAA solar calculations.

---

## 1. Coordinate Conventions & Geometric Reference

All calculations anchor strictly to the **geometric solar elevation** $h_{\text{geom}}$ (the angle of the center of the solar disk above the ideal geometric horizon):

- **Apparent Elevation ($h_{\text{app}}$)**: Corrected for atmospheric refraction according to standard Bennett (1982) formulas.
- **Geometric Elevation ($h_{\text{geom}}$)**: Pure physical celestial coordinate without atmospheric bending.
- **Azimuth ($A$)**: Measured in degrees clockwise from true North ($0^\circ = \text{North}, 90^\circ = \text{East}, 180^\circ = \text{South}, 270^\circ = \text{West}$).
  - *Singularity handling*: Indeterminate at zenith ($h = 90^\circ$), nadir ($h = -90^\circ$), and geographic poles ($\pm 90^\circ$). Handled via `isAzimuthIndeterminate: true` and `azimuthDeg: null`.

---

## 2. Statutory Twilight Bands & Direct Sunlight

The standard astronomical twilight bands are defined by geometric elevation $h_{\text{geom}}$, adjusted for observer horizon dip:

$$\theta_{\text{eff}} = \theta_{\text{base}} - d_{\text{dip}}$$

| Illumination Phase | Geometric Elevation Range | Optical / Environmental Significance |
| :--- | :--- | :--- |
| **Day (Direct Sunlight)** | $h_{\text{geom}} \ge -0.8333^\circ - d_{\text{dip}}$ | Sun's upper limb visible above horizon (includes $32'$ solar diameter and $34'$ refraction). |
| **Civil Twilight** | $[-6.0^\circ - d_{\text{dip}}, -0.8333^\circ - d_{\text{dip}})$ | Horizon and bright terrestrial objects clearly distinguishable without artificial lighting. |
| **Nautical Twilight** | $[-12.0^\circ - d_{\text{dip}}, -6.0^\circ - d_{\text{dip}})$ | Navigators can distinguish sea horizon and guide by celestial stars. |
| **Astronomical Twilight** | $[-18.0^\circ - d_{\text{dip}}, -12.0^\circ - d_{\text{dip}})$ | Sky illumination from sunlight is detectable; faintest stars become visible. |
| **Night** | $< -18.0^\circ - d_{\text{dip}}$ | Complete absence of solar sky glow; true astronomical darkness. |

---

## 3. High-Performance Instantaneous Solar Positioning

When you only need current solar elevation, azimuth, and zenith without the overhead of diurnal event solving, use `evaluatePosition`:

```typescript
import { Time } from 'time-2.0';

const place = Time.place({ latitude: 51.5074, longitude: -0.1278 });
const now = Time.now();

// Lightweight, pure analytical positioning (~8 µs per operation)
const pos = Time.solar.evaluatePosition(now, place);

console.log(`Elevation: ${pos.elevationDeg.toFixed(2)}°`);
console.log(`Azimuth:   ${pos.azimuthDeg?.toFixed(2)}°`);
console.log(`Zenith:    ${pos.zenithDeg.toFixed(2)}°`);
```

---

## 4. Diurnal Solar Events & Event Solving

TIME 2.0 calculates 10 distinct diurnal solar events using bracketed Brent-Dekker root finding:
- `sunrise` and `sunset` ($h_{\text{geom}} = -0.8333^\circ - d_{\text{dip}}$)
- `solarNoon` (meridian transit / elevation maximum)
- `solarMidnight` (nadir / elevation minimum)
- `civilDawn` and `civilDusk` ($h_{\text{geom}} = -6^\circ$)
- `nauticalDawn` and `nauticalDusk` ($h_{\text{geom}} = -12^\circ$)
- `astronomicalDawn` and `astronomicalDusk` ($h_{\text{geom}} = -18^\circ$)

```typescript
import { Time } from 'time-2.0';

const place = Time.place({ latitude: 37.7749, longitude: -122.4194 });

const nextSunrise = Time.solar.nextEvent({
  event: 'sunrise',
  place,
  after: Time.now(),
});

console.log(`Next sunrise: ${nextSunrise?.toISOString()}`);
```

---

## 5. Polar Regimes (Midnight Sun & Polar Night)

In high-latitude regions ($|\text{latitude}| > 66.5^\circ$), diurnal cycles can vanish entirely:
- **Polar Day (`polar_day`)**: Midnight Sun. Solar elevation stays above the horizon ($h_{\text{geom}} \ge -0.8333^\circ - d_{\text{dip}}$) for the entire 24-hour cycle. Sunrise and sunset do not occur.
- **Polar Night (`polar_night`)**: Sun never rises above the horizon.
  - *Key distinction*: A location in polar night can still experience twilight (e.g. Tromsø in December reaching $-4^\circ$ at noon experiences civil twilight, not total darkness).

The solar model returns `polarRegime: 'polar_day' | 'polar_night' | 'none'` independently of the instantaneous `phase`.

---

## 6. Astronomical Time Scales (UT1, TT, TAI, $\Delta T$)

Earth's rotational speed varies due to tidal friction and core interactions. The solar ephemeris requires uniform Terrestrial Time (TT), whereas computer clocks run on civil UTC.

TIME 2.0 incorporates an extensible time-scale provider:
$$\Delta T = \text{TT} - \text{UT1} \approx 69.2\text{ s (in 2026)}$$

```typescript
import { Time, getAstronomicalTimeScale } from 'time-2.0';

const timescale = Time.solar.getAstronomicalTimeScale();
const deltaT = timescale.getDeltaT(Time.now());
console.log(`Current Delta T: ${deltaT} seconds`);
```
Custom high-order IERS polynomial providers can be registered via `Time.solar.registerAstronomicalTimeScale()`.
