/**
 * @file presets.ts
 * Astronomical locations, temporal epochs, declarative condition presets,
 * and plain-language interactive questions for TIME 2.0.
 */

import { Time, Conditions, Instant } from 'time-2.0';
import type { LocationPreset, DatePreset, QueryPreset, GlossaryTerm } from '../types.js';

export const LOCATION_PRESETS: readonly LocationPreset[] = Object.freeze([
  {
    id: 'tromso',
    name: 'Tromsø',
    country: 'Norway',
    place: Time.place({
      latitude: 69.6492,
      longitude: 18.9553,
      elevationMeters: 20,
      timeZoneId: 'Europe/Oslo',
    }),
    description: 'Arctic high-latitude observatory (Polar Night & Midnight Sun regimes).',
  },
  {
    id: 'quito',
    name: 'Quito',
    country: 'Ecuador',
    place: Time.place({
      latitude: -0.1807,
      longitude: -78.4678,
      elevationMeters: 2850,
      timeZoneId: 'America/Guayaquil',
    }),
    description: 'Equatorial high-elevation observatory (constant ~12h diurnal daylight).',
  },
  {
    id: 'new_york',
    name: 'New York',
    country: 'United States',
    place: Time.place({
      latitude: 40.7128,
      longitude: -74.006,
      elevationMeters: 10,
      timeZoneId: 'America/New_York',
    }),
    description: 'North American temperate urban center (seasonal DST transitions).',
  },
  {
    id: 'tokyo',
    name: 'Tokyo',
    country: 'Japan',
    place: Time.place({
      latitude: 35.6762,
      longitude: 139.6503,
      elevationMeters: 40,
      timeZoneId: 'Asia/Tokyo',
    }),
    description: 'East Asian metropolitan center (standard time without DST).',
  },
  {
    id: 'sydney',
    name: 'Sydney',
    country: 'Australia',
    place: Time.place({
      latitude: -33.8688,
      longitude: 151.2093,
      elevationMeters: 25,
      timeZoneId: 'Australia/Sydney',
    }),
    description: 'Southern hemisphere coastal city (inverted seasons and autumn DST fall-back).',
  },
  {
    id: 'chennai',
    name: 'Chennai',
    country: 'India',
    place: Time.place({
      latitude: 13.0827,
      longitude: 80.2707,
      elevationMeters: 6,
      timeZoneId: 'Asia/Kolkata',
    }),
    description: 'Tropical coastal hub (Indian Standard Time UTC+05:30 without DST).',
  },
  {
    id: 'london',
    name: 'London',
    country: 'United Kingdom',
    place: Time.place({
      latitude: 51.5074,
      longitude: -0.1278,
      elevationMeters: 15,
      timeZoneId: 'Europe/London',
    }),
    description: 'Prime Meridian reference center with seasonal British Summer Time.',
  },
]);

export const DATE_PRESETS: readonly DatePreset[] = Object.freeze([
  {
    id: 'vernal_equinox',
    name: 'Vernal Equinox 2026',
    instant: Instant.fromJSON('2026-03-20T12:00:00.000Z'),
    description: 'March equinox: Sun directly above Equator, ~equal day/night globally.',
  },
  {
    id: 'summer_solstice',
    name: 'Summer Solstice 2026',
    instant: Instant.fromJSON('2026-06-21T12:00:00.000Z'),
    description: 'June solstice: Sun directly above Tropic of Cancer (+23.44°).',
  },
  {
    id: 'autumnal_equinox',
    name: 'Autumnal Equinox 2026',
    instant: Instant.fromJSON('2026-09-23T12:00:00.000Z'),
    description: 'September equinox: Sun crossing celestial equator southbound.',
  },
  {
    id: 'winter_solstice',
    name: 'Winter Solstice 2026',
    instant: Instant.fromJSON('2026-12-21T12:00:00.000Z'),
    description: 'December solstice: Sun directly above Tropic of Capricorn (-23.44°).',
  },
  {
    id: 'us_dst_fallback',
    name: 'US DST Fall-Back 2026',
    instant: Instant.fromJSON('2026-11-01T05:30:00.000Z'),
    description: 'America/New_York repeated 01:00 hour transition (EDT -> EST).',
  },
  {
    id: 'tromso_midnight_sun',
    name: 'Tromsø Midnight Sun',
    instant: Instant.fromJSON('2026-06-21T22:00:00.000Z'),
    description: 'Arctic midnight: Sun remains continuously above horizon.',
  },
  {
    id: 'tromso_polar_night',
    name: 'Tromsø Polar Night',
    instant: Instant.fromJSON('2026-12-21T11:00:00.000Z'),
    description: 'Arctic polar night: Sun remains continuously below horizon.',
  },
]);

export const QUERY_PRESETS: readonly QueryPreset[] = Object.freeze([
  {
    id: 'high_sun',
    name: '1. High-Sun Window',
    description: 'Solar elevation >= 15° (optimal geometric solar window).',
    condition: Conditions.solar.elevation.gte(15),
    targetDomain: 'solar',
  },
  {
    id: 'civil_business_daylight',
    name: '2. Civil Business Daylight',
    description: 'Solar elevation >= 0° AND civil hour between 9 and 17 [09:00, 17:00).',
    condition: Conditions.and(
      Conditions.solar.elevation.gte(0),
      Conditions.civil.hour.between(9, 17)
    ),
    targetDomain: 'hybrid',
  },
  {
    id: 'golden_hour',
    name: '3. Golden Hour',
    description: 'Solar elevation between -4° and 6° (photography low-sun light).',
    condition: Conditions.solar.elevation.between(-4, 6),
    targetDomain: 'solar',
  },
  {
    id: 'dark_sky',
    name: '4. Dark Sky Astrophotography',
    description: 'Solar elevation < -18° AND civil hour in [22:00, 04:00).',
    condition: Conditions.and(
      Conditions.solar.elevation.lt(-18),
      Conditions.or(Conditions.civil.hour.gte(22), Conditions.civil.hour.lt(4))
    ),
    targetDomain: 'hybrid',
  },
  {
    id: 'arctic_midnight_sun',
    name: '5. Arctic Midnight Sun',
    description: 'Diurnal polar regime equals polar_day.',
    condition: Conditions.solar.polarRegime.eq('polar_day'),
    targetDomain: 'solar',
  },
]);

export interface InteractiveQuestion {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly locationId: string;
  readonly datePresetId?: string;
  readonly defaultHourUtc: number;
  readonly questionType: 'sunrise_sunset' | 'daylight_duration' | 'darkness' | 'comparison' | 'polar' | 'seasons';
}

export const INTERACTIVE_QUESTIONS: readonly InteractiveQuestion[] = Object.freeze([
  {
    id: 'q1_sunrise_ny',
    title: 'What time will the Sun rise in New York?',
    subtitle: 'Calculates exact local sunrise, solar noon, and sunset using the NOAA ephemeris.',
    locationId: 'new_york',
    datePresetId: 'summer_solstice',
    defaultHourUtc: 12,
    questionType: 'sunrise_sunset',
  },
  {
    id: 'q2_daylight_tokyo',
    title: 'How long does daylight last in Tokyo?',
    subtitle: 'Measures continuous daylight duration between morning sunrise and evening sunset.',
    locationId: 'tokyo',
    datePresetId: 'vernal_equinox',
    defaultHourUtc: 4,
    questionType: 'daylight_duration',
  },
  {
    id: 'q3_dark_sky_london',
    title: 'When will it become completely dark in London?',
    subtitle: 'Determines when astronomical twilight ends (Sun drops below -18°).',
    locationId: 'london',
    datePresetId: 'vernal_equinox',
    defaultHourUtc: 22,
    questionType: 'darkness',
  },
  {
    id: 'q4_compare_quito_tromso',
    title: 'How does daylight differ between Quito & Tromsø?',
    subtitle: 'Compares constant 12h equatorial daylight against high-latitude Arctic seasonal shifts.',
    locationId: 'quito',
    datePresetId: 'summer_solstice',
    defaultHourUtc: 12,
    questionType: 'comparison',
  },
  {
    id: 'q5_arctic_midnight_sun',
    title: 'What happens during Arctic Summer in Tromsø?',
    subtitle: 'Inspects Midnight Sun when the Sun remains above the horizon for 24 continuous hours.',
    locationId: 'tromso',
    datePresetId: 'tromso_midnight_sun',
    defaultHourUtc: 22,
    questionType: 'polar',
  },
  {
    id: 'q6_seasons_solstice',
    title: 'How does daylight change across Solstices?',
    subtitle: 'Shows how Earth tilt (23.44°) shifts solar declination and diurnal daylight hours.',
    locationId: 'new_york',
    datePresetId: 'winter_solstice',
    defaultHourUtc: 17,
    questionType: 'seasons',
  },
]);

export const GLOSSARY_TERMS: readonly GlossaryTerm[] = Object.freeze([
  {
    term: 'Solar Elevation',
    simpleExplanation: 'How high the Sun appears above or below the horizon in degrees.',
    detailedExplanation: 'Measured from 0° at the geometric horizon to +90° directly overhead (zenith) and -90° straight down (nadir).',
    category: 'solar',
  },
  {
    term: 'Solar Azimuth',
    simpleExplanation: 'The compass direction of the Sun around the horizon.',
    detailedExplanation: 'Measured clockwise from True North: 0° is North, 90° East, 180° South, and 270° West.',
    category: 'solar',
  },
  {
    term: 'Declination',
    simpleExplanation: "The Sun's position north or south of Earth's equator.",
    detailedExplanation: "Varies from +23.44° on the June Solstice to -23.44° on the December Solstice due to Earth's axial tilt.",
    category: 'solar',
  },
  {
    term: 'Hour Angle',
    simpleExplanation: 'How far the Sun is from local solar noon.',
    detailedExplanation: 'Measured at 15° per hour along the celestial equator. Negative before solar noon, 0° at solar noon, positive in afternoon.',
    category: 'solar',
  },
  {
    term: 'Civil Twilight',
    simpleExplanation: 'The period just before sunrise or after sunset with enough natural light for ordinary outdoor activities.',
    detailedExplanation: 'Technically defined as when the geometric center of the Sun is between -0.833° (sunset) and -6° below the horizon.',
    category: 'solar',
  },
  {
    term: 'Polar Day (Midnight Sun)',
    simpleExplanation: 'A 24-hour period where the Sun never sets below the horizon.',
    detailedExplanation: 'Occurs in polar regions (above latitude ~66.5° N/S) during local summer due to axial tilt.',
    category: 'solar',
  },
  {
    term: 'Polar Night',
    simpleExplanation: 'A 24-hour period where the Sun never rises above the horizon.',
    detailedExplanation: 'Occurs in polar regions during local winter. Twilight can still occur if the Sun approaches the horizon.',
    category: 'solar',
  },
  {
    term: 'Temporal Interval',
    simpleExplanation: 'A continuous, unbroken period of time between a start moment and an end moment.',
    detailedExplanation: 'In TIME 2.0, intervals are strictly half-open [start, end), including start and excluding end.',
    category: 'intervals',
  },
  {
    term: 'Condition AST',
    simpleExplanation: 'A structured rule describing what physical or civil criteria must be true.',
    detailedExplanation: 'An Abstract Syntax Tree composed of comparison nodes (gte, lte, between) and logical operators (AND, OR, NOT).',
    category: 'engine',
  },
  {
    term: 'Condition Resolver',
    simpleExplanation: 'The computational engine that finds exact periods satisfying your rules.',
    detailedExplanation: 'Combines continuous numerical root solving with discrete calendar enumeration to produce exact IntervalSets.',
    category: 'engine',
  },
  {
    term: 'Model Uncertainty',
    simpleExplanation: 'How much the physical reality may differ from the calculated astronomical model.',
    detailedExplanation: 'Accounts for atmospheric temperature/pressure variations, observer elevation, and ephemeris approximations (typically < 0.02°).',
    category: 'engine',
  },
  {
    term: 'Allen Interval Algebra',
    simpleExplanation: 'A mathematical system defining all 13 possible relationships between two time periods.',
    detailedExplanation: 'Includes relations like "before", "meets", "overlaps", "during", "starts", "finishes", and "equals".',
    category: 'intervals',
  },
]);
