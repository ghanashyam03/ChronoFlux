/**
 * @file place.ts
 * Geodetic spatial reference point on the WGS84 ellipsoid.
 */

import { PlaceJSON } from './types.js';

export interface PlaceOptions {
  /**
   * Geodetic latitude in decimal degrees on the WGS84 ellipsoid [-90.0, +90.0].
   */
  readonly latitude: number;

  /**
   * Geodetic longitude in decimal degrees on the WGS84 ellipsoid [-180.0, +180.0].
   */
  readonly longitude: number;

  /**
   * Orthometric elevation in meters above mean sea level (MSL / geoid).
   *
   * Elevation Datum & Horizon Dip Semantics:
   * Place.elevationMeters represents orthometric height above mean sea level (the geoid),
   * NOT ellipsoidal height relative to the WGS84 reference ellipsoid.
   * When specified and > 0, elevationMeters incorporates geometric horizon dip above an unobstructed
   * sea-level horizon: d_dip = (1.76 / 60) * sqrt(elevationMeters) degrees.
   * This causes sunrise to occur earlier and sunset later for elevated observers.
   *
   * Explicit Boundary & Modeling Assumptions:
   * Assumes an unobstructed geometric sea-level horizon. Does NOT model local topographical features
   * (mountains, ridges, hills, valleys) or architectural obstructions (buildings, urban canyons),
   * which require external viewshed and digital elevation models (DEM) and are explicitly outside
   * the scope of this model.
   */
  readonly elevationMeters?: number;

  /**
   * Contextual IANA Time Zone identifier (e.g. 'America/New_York', 'Asia/Kolkata').
   *
   * Architectural Note:
   * A time-zone identifier is purely contextual metadata and is NOT an intrinsic physical
   * property of geodetic coordinates. It may be attached to facilitate civil time conversions,
   * but spatial mechanics operate exclusively on (latitude, longitude, elevationMeters).
   */
  readonly timeZoneId?: string;
}

/**
 * Place represents an immutable geographic location on the WGS84 ellipsoid.
 */
export class Place {
  readonly latitude: number;
  readonly longitude: number;
  readonly elevationMeters?: number;
  readonly timeZoneId?: string;

  constructor(options: PlaceOptions) {
    if (typeof options !== 'object' || options === null) {
      throw new TypeError('Place options must be a valid non-null object');
    }

    const { latitude, longitude, elevationMeters, timeZoneId } = options;

    if (typeof latitude !== 'number' || !Number.isFinite(latitude)) {
      throw new TypeError(`Place latitude must be a finite number, received: ${latitude}`);
    }
    if (latitude < -90 || latitude > 90) {
      throw new RangeError(`Place latitude must be between -90 and +90 degrees, received: ${latitude}`);
    }

    if (typeof longitude !== 'number' || !Number.isFinite(longitude)) {
      throw new TypeError(`Place longitude must be a finite number, received: ${longitude}`);
    }
    if (longitude < -180 || longitude > 180) {
      throw new RangeError(`Place longitude must be between -180 and +180 degrees, received: ${longitude}`);
    }

    if (elevationMeters !== undefined) {
      if (typeof elevationMeters !== 'number' || !Number.isFinite(elevationMeters)) {
        throw new TypeError(`Place elevationMeters must be a finite number when defined, received: ${elevationMeters}`);
      }
    }

    if (timeZoneId !== undefined) {
      if (typeof timeZoneId !== 'string' || timeZoneId.trim().length === 0) {
        throw new TypeError(`Place timeZoneId must be a non-empty string when defined, received: ${timeZoneId}`);
      }
    }

    this.latitude = latitude;
    this.longitude = longitude;
    if (elevationMeters !== undefined) {
      this.elevationMeters = elevationMeters;
    }
    if (timeZoneId !== undefined) {
      this.timeZoneId = timeZoneId.trim();
    }

    Object.freeze(this);
  }

  static create(options: PlaceOptions): Place {
    return new Place(options);
  }

  equals(other: unknown): boolean {
    if (!(other instanceof Place)) {
      return false;
    }
    return (
      this.latitude === other.latitude &&
      this.longitude === other.longitude &&
      this.elevationMeters === other.elevationMeters &&
      this.timeZoneId === other.timeZoneId
    );
  }

  /**
   * Evaluates geographic equivalence on the WGS84 ellipsoid (latitude, longitude, elevationMeters),
   * strictly ignoring contextual metadata such as timeZoneId.
   */
  hasSameCoordinates(other: unknown): boolean {
    if (!(other instanceof Place)) {
      return false;
    }
    return (
      this.latitude === other.latitude &&
      this.longitude === other.longitude &&
      this.elevationMeters === other.elevationMeters
    );
  }

  toJSON(): PlaceJSON {
    const json: {
      latitude: number;
      longitude: number;
      elevationMeters?: number;
      timeZoneId?: string;
    } = {
      latitude: this.latitude,
      longitude: this.longitude,
    };
    if (this.elevationMeters !== undefined) {
      json.elevationMeters = this.elevationMeters;
    }
    if (this.timeZoneId !== undefined) {
      json.timeZoneId = this.timeZoneId;
    }
    return json;
  }

  static fromJSON(json: PlaceJSON): Place {
    return new Place(json);
  }

  toString(): string {
    const elev = this.elevationMeters !== undefined ? ` alt=${this.elevationMeters}m` : '';
    const tz = this.timeZoneId ? ` tz=${this.timeZoneId}` : '';
    return `Place(${this.latitude.toFixed(6)}, ${this.longitude.toFixed(6)}${elev}${tz})`;
  }
}
