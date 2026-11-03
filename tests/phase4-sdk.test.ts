/**
 * @file phase4-sdk.test.ts
 * Phase 4: Developer SDK, Packaging, Type Integrity, and Semantic Regressions.
 */

import { describe, expect, it } from 'vitest';
import * as childProcess from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  ChronoFlux,
  Conditions,
  Instant,
  Interval,
  Place,
  validateConditionAST,
  VALID_SOLAR_PHASES,
  VALID_POLAR_REGIMES,
} from '../src/index.js';
import type {
  ResolutionResult,
  ResolutionReport,
  IntervalExplanation,
  BoundaryExplanation,
  SolarState,
  CivilState,
  PlaceOptions,
  DurationFields,
  AllenRelation,
  ConditionAST,
  AtomicConditionNode,
  LogicalConditionNode,
  ComparisonOperator,
  LogicalOperator,
  SolarProperty,
  CivilProperty,
  AngleUnit,
  TimeUnit,
  InstantJSON,
  DurationJSON,
  PlaceJSON,
  IntervalJSON,
  IntervalSetJSON,
  InstantParseOptions,
  LeapSecondPolicy,
  SolarEventName,
  SolarEventInstant,
  SolarTransitionInstant,
  CivilTransitionInfo,
} from '../src/index.js';

describe('Phase 4 — Developer SDK, Packaging, and Semantic Correctness', () => {
  describe('1. Integer Validation on Discrete Civil Properties', () => {
    it('rejects floating-point values for civil.hour via builder and validateConditionAST', () => {
      expect(() => Conditions.civil.hour.eq(9.5)).toThrow(TypeError);
      expect(() => Conditions.civil.hour.eq(9.5)).toThrow(/requires integer values/);
      expect(() => Conditions.civil.hour.between(9.5, 17)).toThrow(TypeError);
      expect(() => Conditions.civil.hour.between(9, 17.5)).toThrow(TypeError);
      expect(() => Conditions.civil.hour.in([9, 10.5, 11])).toThrow(TypeError);

      expect(() =>
        validateConditionAST({
          kind: 'comparison',
          domain: 'civil',
          property: 'hour',
          operator: 'eq',
          value: 9.5,
        })
      ).toThrow(TypeError);
    });

    it('rejects floating-point values for civil.minute and civil.second', () => {
      expect(() => Conditions.civil.minute.eq(30.25)).toThrow(TypeError);
      expect(() => Conditions.civil.minute.between(15.5, 45)).toThrow(TypeError);
      expect(() => Conditions.civil.second.eq(45.5)).toThrow(TypeError);
      expect(() => Conditions.civil.second.between(0, 30.5)).toThrow(TypeError);
    });

    it('rejects floating-point values for calendar properties (dayOfWeek, day, month, year)', () => {
      expect(() => Conditions.civil.dayOfWeek.eq(3.5)).toThrow(TypeError);
      expect(() => Conditions.civil.dayOfWeek.between(1.5, 5)).toThrow(TypeError);
      expect(() => Conditions.civil.day.eq(15.2)).toThrow(TypeError);
      expect(() => Conditions.civil.day.between(1, 15.5)).toThrow(TypeError);
      expect(() => Conditions.civil.month.eq(6.5)).toThrow(TypeError);
      expect(() => Conditions.civil.month.between(1.5, 6)).toThrow(TypeError);
      expect(() => Conditions.civil.year.eq(2026.5)).toThrow(TypeError);
    });

    it('rejects floating-point values in in arrays for all civil numeric properties', () => {
      expect(() => Conditions.civil.hour.in([9, 10.5])).toThrow(TypeError);
      expect(() => Conditions.civil.hour.in([9, 10.5])).toThrow(/requires integer values/);
      expect(() => Conditions.civil.minute.in([15, 30.5])).toThrow(TypeError);
      expect(() => Conditions.civil.second.in([0, 30.5])).toThrow(TypeError);
      expect(() => Conditions.civil.dayOfWeek.in([1, 5.5])).toThrow(TypeError);
      expect(() => Conditions.civil.day.in([1, 15.5])).toThrow(TypeError);
      expect(() => Conditions.civil.month.in([1, 6.5])).toThrow(TypeError);
      expect(() => Conditions.civil.year.in([2026, 2027.5])).toThrow(TypeError);
    });

    it('accepts valid integer numbers for all civil numeric properties', () => {
      expect(Conditions.civil.hour.eq(9).value).toBe(9);
      expect(Conditions.civil.minute.eq(30).value).toBe(30);
      expect(Conditions.civil.second.eq(0).value).toBe(0);
      expect(Conditions.civil.dayOfWeek.eq(1).value).toBe(1);
      expect(Conditions.civil.day.eq(15).value).toBe(15);
      expect(Conditions.civil.month.eq(12).value).toBe(12);
      expect(Conditions.civil.year.eq(2026).value).toBe(2026);
    });
  });

  describe('2. Categorical Enum Validation', () => {
    it('rejects invalid categorical strings for solar.phase', () => {
      expect(() => (Conditions.solar.phase as any).eq('invalid_phase')).toThrow(TypeError);
      expect(() => (Conditions.solar.phase as any).eq('invalid_phase')).toThrow(/Invalid value/);
      expect(() => (Conditions.solar.phase as any).neq('bogus')).toThrow(TypeError);
      expect(() => (Conditions.solar.phase as any).in(['day', 'not_a_phase'])).toThrow(TypeError);

      expect(() =>
        validateConditionAST({
          kind: 'comparison',
          domain: 'solar',
          property: 'phase',
          operator: 'eq',
          value: 'twilight_zone',
        })
      ).toThrow(TypeError);
    });

    it('rejects invalid categorical strings for solar.polarRegime', () => {
      expect(() => (Conditions.solar.polarRegime as any).eq('polar_unknown')).toThrow(TypeError);
      expect(() => (Conditions.solar.polarRegime as any).eq('polar_unknown')).toThrow(/Invalid value/);
      expect(() => (Conditions.solar.polarRegime as any).neq('eternal_darkness')).toThrow(TypeError);
      expect(() => (Conditions.solar.polarRegime as any).in(['none', 'polar_twilight'])).toThrow(TypeError);

      expect(() =>
        validateConditionAST({
          kind: 'comparison',
          domain: 'solar',
          property: 'polarRegime',
          operator: 'eq',
          value: 'polar_freeze',
        })
      ).toThrow(TypeError);
    });

    it('accepts all valid enum members for solar.phase and solar.polarRegime', () => {
      for (const phase of VALID_SOLAR_PHASES) {
        expect(() => (Conditions.solar.phase as any).eq(phase)).not.toThrow();
      }
      for (const regime of VALID_POLAR_REGIMES) {
        expect(() => (Conditions.solar.polarRegime as any).eq(regime)).not.toThrow();
      }
    });
  });

  describe('3. Half-Open between Semantics on Calendar Properties', () => {
    const utcPlace = ChronoFlux.place({
      latitude: 0,
      longitude: 0,
      timeZoneId: 'UTC',
    });

    const nyPlace = ChronoFlux.place({
      latitude: 40.7128,
      longitude: -74.006,
      timeZoneId: 'America/New_York',
    });

    it('resolves dayOfWeek.between(1, 5) with exact half-open [Monday 00:00, Saturday 00:00) interval', () => {
      // 1-week window: Sun Jun 21 2026 to Sun Jun 28 2026 (local NY time)
      const windowStart = Instant.fromJSON('2026-06-21T04:00:00.000Z'); // Sun 00:00 EDT
      const windowEnd = Instant.fromJSON('2026-06-28T04:00:00.000Z'); // Sun 00:00 EDT
      const searchWindow = ChronoFlux.interval(windowStart, windowEnd);

      const result = ChronoFlux.resolve({
        place: nyPlace,
        within: searchWindow,
        where: Conditions.civil.dayOfWeek.between(1, 5),
      });

      // Monday through Friday merge into 1 continuous interval
      expect(result.intervals.intervals.length).toBe(1);
      const interval = result.intervals.intervals[0]!;

      // Starts Monday Jun 22 00:00 EDT = 2026-06-22T04:00:00Z
      expect(interval.start.toISOString()).toBe('2026-06-22T04:00:00.000Z');
      // Ends Saturday Jun 27 00:00 EDT = 2026-06-27T04:00:00Z (half-open: Friday is included, Saturday is excluded)
      expect(interval.end.toISOString()).toBe('2026-06-27T04:00:00.000Z');
      expect(interval.duration.totalDays).toBe(5);

      // Verify boundary provenance
      expect(result.report.explanations.length).toBe(1);
      const explanation = result.report.explanations[0]!;
      expect(explanation.startExplanation.model).toBe('civil');
      expect(explanation.endExplanation.model).toBe('civil');
    });

    it('resolves civil.day.between(1, 15) with exact half-open [Day 1 00:00, Day 16 00:00) interval', () => {
      // Month of July 2026 in UTC
      const searchWindow = ChronoFlux.interval(
        Instant.fromJSON('2026-07-01T00:00:00.000Z'),
        Instant.fromJSON('2026-07-31T00:00:00.000Z')
      );

      const result = ChronoFlux.resolve({
        place: utcPlace,
        within: searchWindow,
        where: Conditions.civil.day.between(1, 15),
      });

      expect(result.intervals.intervals.length).toBe(1);
      const interval = result.intervals.intervals[0]!;

      // Starts Jul 1 00:00 UTC
      expect(interval.start.toISOString()).toBe('2026-07-01T00:00:00.000Z');
      // Ends Jul 16 00:00 UTC (15 full days: days 1..15 included, day 16 excluded)
      expect(interval.end.toISOString()).toBe('2026-07-16T00:00:00.000Z');
      expect(interval.duration.totalDays).toBe(15);
    });

    it('resolves civil.month.between(1, 6) with exact half-open [Jan 1 00:00, Jul 1 00:00) interval', () => {
      // Full year 2026 in UTC
      const searchWindow = ChronoFlux.interval(
        Instant.fromJSON('2026-01-01T00:00:00.000Z'),
        Instant.fromJSON('2026-12-31T00:00:00.000Z')
      );

      const result = ChronoFlux.resolve({
        place: utcPlace,
        within: searchWindow,
        where: Conditions.civil.month.between(1, 6),
      });

      expect(result.intervals.intervals.length).toBe(1);
      const interval = result.intervals.intervals[0]!;

      // Starts Jan 1 00:00 UTC
      expect(interval.start.toISOString()).toBe('2026-01-01T00:00:00.000Z');
      // Ends Jul 1 00:00 UTC (months 1..6 = Jan..Jun included, Jul excluded)
      expect(interval.end.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    });
  });

  describe('4. Package Configuration and Integrity Assertions', () => {
    const rootDir = path.resolve(__dirname, '..');
    const pkgPath = path.join(rootDir, 'package.json');
    const licensePath = path.join(rootDir, 'LICENSE');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

    it('declares exact required package.json metadata and files whitelist', () => {
      expect(pkg.name).toBe('@chronoflux/core');
      expect(pkg.version).toBe('0.1.0');
      expect(pkg.type).toBe('module');
      expect(pkg.files).toEqual(['dist', 'README.md', 'LICENSE']);
      expect(pkg.engines).toBeDefined();
      expect(pkg.engines.node).toBe('>=18.0.0');
      expect(pkg.repository.url).toBe('https://github.com/ghanashyam03/ChronoFlux.git');
      expect(pkg.bugs.url).toBe('https://github.com/ghanashyam03/ChronoFlux/issues');
      expect(pkg.homepage).toBe('https://github.com/ghanashyam03/ChronoFlux#readme');
      expect(pkg.scripts.prepack).toBe('npm run build');
    });

    it('enforces zero production dependencies invariant', () => {
      expect(pkg.dependencies).toBeUndefined();
    });

    it('includes valid MIT LICENSE file matching package.json', () => {
      expect(fs.existsSync(licensePath)).toBe(true);
      const licenseContent = fs.readFileSync(licensePath, 'utf-8');
      expect(licenseContent).toContain('MIT License');
      expect(licenseContent).toContain('ChronoFlux Contributors');
      expect(pkg.license).toBe('MIT');
    });

    it('exposes all public types and frozen ChronoFlux developer facade', () => {
      expect(ChronoFlux).toBeDefined();
      expect(Object.isFrozen(ChronoFlux)).toBe(true);
      expect(typeof ChronoFlux.now).toBe('function');
      expect(typeof ChronoFlux.instant).toBe('function');
      expect(typeof ChronoFlux.duration.hours).toBe('function');
      expect(typeof ChronoFlux.place).toBe('function');
      expect(typeof ChronoFlux.interval).toBe('function');
      expect(typeof ChronoFlux.intervalSet.from).toBe('function');
      expect(typeof ChronoFlux.solar.evaluate).toBe('function');
      expect(typeof ChronoFlux.civil.resolve).toBe('function');
      expect(typeof ChronoFlux.resolve).toBe('function');
      expect(ChronoFlux.conditions).toBeDefined();

      // Factory ergonomics verification
      const original = Instant.fromJSON('2026-06-21T12:00:00.000Z');
      expect(ChronoFlux.instant(original)).toBe(original);

      const temporalObj = { epochNanoseconds: original.epochNanoseconds };
      const fromTemporal = ChronoFlux.instant(temporalObj);
      expect(fromTemporal.equals(original)).toBe(true);

      // Compile-time type check verification for all public root types
      const typeCheck: {
        resResult?: ResolutionResult;
        resReport?: ResolutionReport;
        intervalExp?: IntervalExplanation;
        boundaryExp?: BoundaryExplanation;
        solarState?: SolarState;
        civilState?: CivilState;
        placeOpts?: PlaceOptions;
        durFields?: DurationFields;
        allen?: AllenRelation;
        ast?: ConditionAST;
        atomic?: AtomicConditionNode;
        logical?: LogicalConditionNode;
        compOp?: ComparisonOperator;
        logOp?: LogicalOperator;
        solarProp?: SolarProperty;
        civilProp?: CivilProperty;
        angleUnit?: AngleUnit;
        timeUnit?: TimeUnit;
        instantJson?: InstantJSON;
        durJson?: DurationJSON;
        placeJson?: PlaceJSON;
        intervalJson?: IntervalJSON;
        intervalSetJson?: IntervalSetJSON;
        parseOpts?: InstantParseOptions;
        leapPolicy?: LeapSecondPolicy;
        solarEvent?: SolarEventName;
        solarEventInst?: SolarEventInstant;
        solarTransInst?: SolarTransitionInstant;
        civilTransInfo?: CivilTransitionInfo;
      } = {};
      expect(typeCheck).toBeDefined();
    });

    it('verifies package archive tarball integrity and strict files whitelist via npm pack', () => {
      const output = childProcess.execSync('npm pack --dry-run --ignore-scripts --json', {
        cwd: rootDir,
        encoding: 'utf-8',
        shell: process.platform === 'win32' ? 'cmd.exe' : undefined,
        timeout: 15000,
      });
      const packResult = JSON.parse(output);
      expect(Array.isArray(packResult)).toBe(true);
      expect(packResult.length).toBeGreaterThan(0);
      const tarballInfo = packResult[0];
      expect(tarballInfo.name).toBe('@chronoflux/core');
      expect(tarballInfo.version).toBe('0.1.0');
      expect(tarballInfo.filename).toBe('chronoflux-core-0.1.0.tgz');
      expect(tarballInfo.files.length).toBeGreaterThan(0);

      // Verify that every single file in the tarball is in dist/, or is README.md, LICENSE, package.json
      for (const file of tarballInfo.files) {
        const p: string = file.path;
        const isWhitelisted =
          p.startsWith('dist/') ||
          p === 'README.md' ||
          p === 'LICENSE' ||
          p === 'package.json';
        expect(isWhitelisted).toBe(true);

        // Explicitly assert zero source, tests, or config files leaked into tarball
        expect(p.startsWith('src/')).toBe(false);
        expect(p.startsWith('tests/')).toBe(false);
        expect(p.startsWith('test-consumer/')).toBe(false);
        expect(p.startsWith('.github/')).toBe(false);
        expect(p.endsWith('tsconfig.json')).toBe(false);
        expect(p.endsWith('vitest.config.ts')).toBe(false);
      }
    });
  });
});
