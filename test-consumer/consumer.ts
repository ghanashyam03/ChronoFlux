/**
 * @file consumer.ts
 * External TypeScript consumer verifying time-2.0 (TIME 2.0) type declarations and runtime execution.
 */

import assert from 'node:assert';
import TimeDefault, {
  Time,
  ChronoFlux,
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
  ResolveOptions,
  SelectionPolicy,
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
} from 'time-2.0';

console.log('[consumer.ts] Verifying time-2.0 (TIME 2.0) TypeScript typings & runtime...');

// 1. Facade and default export identity
assert.strictEqual(TimeDefault, Time);
assert.strictEqual(ChronoFlux, Time); // Backwards-compatible alias
const placeOptions: PlaceOptions = {
  latitude: 51.5074,
  longitude: -0.1278,
  timeZoneId: 'Europe/London',
};
const durationFields: DurationFields = { hours: 1, minutes: 30 };
const allenRel: AllenRelation = 'overlaps';
const compOp: ComparisonOperator = 'gte';
const logOp: LogicalOperator = 'and';
const solProp: SolarProperty = 'elevation';
const civProp: CivilProperty = 'hour';
const angUnit: AngleUnit = 'deg';
const timeUnit: TimeUnit = 'hours';
const policy: SelectionPolicy = 'earliest';
const sEventName: SolarEventName = 'sunrise';
const parseOpts: InstantParseOptions = { leapSecondPolicy: 'compatible' };
const leapPolicy: LeapSecondPolicy = 'strict';

assert.strictEqual(allenRel, 'overlaps');
assert.strictEqual(compOp, 'gte');
assert.strictEqual(logOp, 'and');
assert.strictEqual(solProp, 'elevation');
assert.strictEqual(civProp, 'hour');
assert.strictEqual(angUnit, 'deg');
assert.strictEqual(timeUnit, 'hours');
assert.strictEqual(policy, 'earliest');
assert.strictEqual(sEventName, 'sunrise');
assert.strictEqual(parseOpts.leapSecondPolicy, 'compatible');
assert.strictEqual(leapPolicy, 'strict');

// 2. Class Instantiation & Operations
const london = new Place(placeOptions);
const dur = Duration.of(durationFields);
assert.strictEqual(dur.totalMinutes, 90);

const start = Instant.fromJSON('2026-06-21T00:00:00.000Z');
const end = start.add(Duration.fromDays(2));
const window = new Interval(start, end);

// 3. Solar & Civil Types Verification
const solState: SolarState = Time.solar.evaluate(start, london);
assert.strictEqual(typeof solState.elevationDeg, 'number');

const civState: CivilState = Time.civil.evaluate(start, london);
assert.strictEqual(civState.timeZoneId, 'Europe/London');

// Verify backwards-compatible ChronoFlux facade on same methods
const solStateCompat: SolarState = ChronoFlux.solar.evaluate(start, london);
assert.strictEqual(solState.elevationDeg, solStateCompat.elevationDeg);

// 4. Condition AST Types Verification
const elevationNode: AtomicConditionNode = Conditions.solar.elevation.gte(15, 'deg');
const hourNode: AtomicConditionNode = Conditions.civil.hour.between(10, 16);
const ast: ConditionAST = Conditions.and(elevationNode, hourNode);

const resolveOpts: ResolveOptions = {
  place: london,
  within: window,
  where: ast,
  policy: 'longest',
};

const result: ResolutionResult = resolve(resolveOpts);
const report: ResolutionReport = result.report;
assert.strictEqual(typeof report.executionTimeMs, 'number');

for (const expl of report.explanations) {
  const item: IntervalExplanation = expl;
  const startExp: BoundaryExplanation = item.startExplanation;
  const endExp: BoundaryExplanation = item.endExplanation;
  assert.strictEqual(typeof startExp.reason, 'string');
  assert.strictEqual(typeof endExp.reason, 'string');
}

console.log('[consumer.ts] All TypeScript typings and executions verified successfully!');
