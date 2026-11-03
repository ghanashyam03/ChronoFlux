# Accuracy & Limitations

This document outlines the numerical accuracy, physical assumptions, empirical error bounds, and validity limits of `@chronoflux/core`.

---

## 1. Ephemeris Accuracy & Validity Range

The solar ephemeris in ChronoFlux is derived from truncated analytical planetary series (Jean Meeus / NOAA formulation):

| Parameter | Nominal Bounds | Notes |
| :--- | :--- | :--- |
| **Primary Validity Range** | **1800 CE to 2100 CE** | Verified against 50 NOAA golden vectors and multi-century astronomical tables. |
| **Solar Coordinate Accuracy** | **$< 0.02^\circ$ (within 1800–2100 CE)** | Discrepancy against high-order JPL DE440 ephemeris is $< 0.01^\circ$ to $0.02^\circ$. |
| **Outside Validity Range** | Quadratic Degradation | Flags `isWithinValidityRange: false` and `isAccuracyDegraded: true`. Ephemeris uncertainty expands quadratically with distance from the J2000.0 epoch. |

---

## 2. Solver Residuals vs. Physical Model Uncertainty

It is critical to distinguish between **numerical solver precision** and **physical uncertainty**:

- **Numerical Solver Residual ($|h(t^*) - \theta| < 10^{-5\circ}$)**:
  Measures how closely the Brent-Dekker root solver converged to the exact analytical ephemeris curve. The solver achieves sub-microdegree precision.
- **Physical Ephemeris Uncertainty ($\pm 0.01^\circ$ to $\pm 0.02^\circ$)**:
  The inherent theoretical precision limit of truncated analytical series compared to full n-body numerical integration.
- **Dynamic Event-Time Uncertainty ($\Delta t$)**:
  Calculated dynamically from the rate of elevation change:
  $$\Delta t = \frac{\Delta h}{|dh/dt|}$$
  Near grazing transitions (polar equinoxes or midnight sun grazes where $|dh/dt| \to 0$), event-time uncertainty naturally expands.

---

## 3. Atmospheric Refraction Uncertainty

At low elevations ($h < 10^\circ$), atmospheric temperature, barometric pressure, and humidity variability create optical refraction uncertainty:
- **Nominal Bennett Formulation**: Assumes standard sea-level atmosphere ($1010\text{ mbar}$, $10^\circ\text{C}$).
- **Nominal Refraction at Horizon ($h = 0^\circ$)**: $\approx 34'\text{ arcminutes} \approx 0.567^\circ$.
- **Refraction Variability**: Atmospheric weather can shift actual optical sunrise/sunset times by $\pm 1$ to $\pm 3$ minutes depending on local thermal inversions.

---

## 4. Observer Elevation Datum & Geometric Horizon Dip

The `Place.elevationMeters` property represents orthometric height above Mean Sea Level (MSL / geoid):
- **Unobstructed Sea Horizon**:
  $$d_{\text{dip}} \approx \frac{1.76'}{60} \sqrt{\text{elevationMeters}} \text{ degrees}$$
- **Limitations**:
  - The model does **not** evaluate local digital elevation models (DEM), terrain topography, or architectural obstructions.
  - Sunrise is computed relative to the apparent geometric horizon, not mountain ridges or urban skylines.

---

## 5. Civil Time & IANA Time Zone Limitations

- **Database Synchronization**: Relies on the host runtime's embedded ICU and CLDR timezone database.
- **Future Daylight Saving Rules**: Future DST transitions (beyond the currently enacted legislation in the IANA timezone database) assume current statutory rules persist indefinitely.
- **Pre-1970 Historic Civil Times**: Historical time zones prior to the mid-20th century may reflect local mean time (LMT) approximations depending on host ICU data.
