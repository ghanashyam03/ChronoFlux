/**
 * @file solver-civil.ts
 * Discrete civil time interval engine.
 * Iterates calendar days within the search window in the target IANA timezone
 * and synthesizes exact half-open intervals using verified ChronoFlux.civil.resolve()
 * with Daylight Saving Time (DST) disambiguation.
 */

import { civilModel } from '../models/civil/index.js';
import { Instant } from '../primitives/instant.js';
import { Interval } from '../primitives/interval.js';
import { IntervalSet } from '../primitives/interval-set.js';
import { Place } from '../primitives/place.js';
import { CivilComparisonNode, CivilProperty } from './ast.js';

export interface CivilBoundaryProvenance {
  readonly instant: Instant;
  readonly boundaryType: 'start' | 'end';
  readonly property: CivilProperty;
  readonly value: number | string | boolean;
  readonly timeZoneId: string;
  readonly reason: string;
  readonly conditionDescription: string;
}

function addDays(year: number, month: number, day: number, delta: number): { year: number; month: number; day: number } {
  const d = new Date(Date.UTC(year, month - 1, day + delta));
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

function matchesNumericOp(actual: number, operator: string, target: number | readonly number[]): boolean {
  switch (operator) {
    case 'eq':
      return actual === target;
    case 'neq':
      return actual !== target;
    case 'gt':
      return actual > (target as number);
    case 'gte':
      return actual >= (target as number);
    case 'lt':
      return actual < (target as number);
    case 'lte':
      return actual <= (target as number);
    case 'between': {
      const [minV, maxV] = target as readonly [number, number];
      return actual >= minV && actual <= maxV;
    }
    case 'in':
      return (target as readonly number[]).includes(actual);
    default:
      return false;
  }
}

/**
 * Solves civil conditions across the search window in the target IANA timezone.
 */
export function solveCivilCondition(
  node: CivilComparisonNode,
  place: Place,
  window: Interval,
  boundaryRecordMap?: Map<string, CivilBoundaryProvenance>
): IntervalSet {
  const timeZoneId = place.timeZoneId || 'UTC';
  const startState = civilModel.evaluate(window.start, timeZoneId);
  const endState = civilModel.evaluate(window.end, timeZoneId);

  // Pad by 1 calendar day before and after to guarantee full search window coverage
  let cur = addDays(startState.year, startState.month, startState.day, -1);
  const finalDay = addDays(endState.year, endState.month, endState.day, 1);

  const intervals: Interval[] = [];
  const { property, operator, value } = node;

  while (true) {
    const next = addDays(cur.year, cur.month, cur.day, 1);

    const dayStart = civilModel.resolve({
      year: cur.year,
      month: cur.month,
      day: cur.day,
      hour: 0,
      minute: 0,
      second: 0,
      timeZoneId,
      disambiguation: 'compatible',
    });

    const dayEnd = civilModel.resolve({
      year: next.year,
      month: next.month,
      day: next.day,
      hour: 0,
      minute: 0,
      second: 0,
      timeZoneId,
      disambiguation: 'compatible',
    });

    // Check if day overlaps window
    const dayOverlaps = dayStart.isBefore(window.end) && dayEnd.isAfter(window.start);

    if (dayOverlaps) {
      // 1. Whole-day properties: dayOfWeek, day, month, year
      if (property === 'dayOfWeek' || property === 'day' || property === 'month' || property === 'year') {
        let actual: number;
        if (property === 'dayOfWeek') {
          const d = new Date(Date.UTC(cur.year, cur.month - 1, cur.day));
          actual = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
        } else {
          const noon = civilModel.resolve({
            year: cur.year,
            month: cur.month,
            day: cur.day,
            hour: 12,
            minute: 0,
            second: 0,
            timeZoneId,
            disambiguation: 'compatible',
          });
          const noonState = civilModel.evaluate(noon, timeZoneId);
          actual = noonState[property];
        }

        if (matchesNumericOp(actual, operator, value as number | readonly number[])) {
          intervals.push(new Interval(dayStart, dayEnd));
          if (boundaryRecordMap) {
            boundaryRecordMap.set(`start:${dayStart.epochNanoseconds}`, {
              instant: dayStart,
              boundaryType: 'start',
              property,
              value: String(actual),
              timeZoneId,
              reason: `Civil date entered matching ${property}=${actual} in ${timeZoneId}.`,
              conditionDescription: `civil.${property} ${operator} ${JSON.stringify(value)}`,
            });
            boundaryRecordMap.set(`end:${dayEnd.epochNanoseconds}`, {
              instant: dayEnd,
              boundaryType: 'end',
              property,
              value: String(actual),
              timeZoneId,
              reason: `Civil date exited matching ${property}=${actual} in ${timeZoneId}.`,
              conditionDescription: `civil.${property} ${operator} ${JSON.stringify(value)}`,
            });
          }
        }
      }

      // 2. Hour property
      else if (property === 'hour') {
        if (operator === 'between') {
          const [hStart, hEnd] = value as readonly [number, number];
          const tStart = civilModel.resolve({
            year: cur.year,
            month: cur.month,
            day: cur.day,
            hour: hStart,
            minute: 0,
            second: 0,
            timeZoneId,
            disambiguation: 'compatible',
          });
          const tEnd = civilModel.resolve({
            year: cur.year,
            month: cur.month,
            day: cur.day,
            hour: hEnd,
            minute: 0,
            second: 0,
            timeZoneId,
            disambiguation: 'compatible',
          });

          if (tStart.isBefore(tEnd)) {
            intervals.push(new Interval(tStart, tEnd));
            if (boundaryRecordMap) {
              boundaryRecordMap.set(`start:${tStart.epochNanoseconds}`, {
                instant: tStart,
                boundaryType: 'start',
                property: 'hour',
                value: hStart,
                timeZoneId,
                reason: `Civil time entered business hours (${String(hStart).padStart(2, '0')}:00) in ${timeZoneId}.`,
                conditionDescription: `civil.hour >= ${hStart}`,
              });
              boundaryRecordMap.set(`end:${tEnd.epochNanoseconds}`, {
                instant: tEnd,
                boundaryType: 'end',
                property: 'hour',
                value: hEnd,
                timeZoneId,
                reason: `Civil time exited business hours (${String(hEnd).padStart(2, '0')}:00) in ${timeZoneId}.`,
                conditionDescription: `civil.hour < ${hEnd}`,
              });
            }
          }
        } else if (operator === 'gte' || operator === 'gt') {
          const h = operator === 'gte' ? (value as number) : (value as number) + 1;
          if (h <= 23) {
            const tStart = civilModel.resolve({
              year: cur.year,
              month: cur.month,
              day: cur.day,
              hour: h,
              minute: 0,
              second: 0,
              timeZoneId,
              disambiguation: 'compatible',
            });
            if (tStart.isBefore(dayEnd)) {
              intervals.push(new Interval(tStart, dayEnd));
            }
          }
        } else if (operator === 'lte' || operator === 'lt') {
          const h = operator === 'lte' ? (value as number) + 1 : (value as number);
          if (h >= 1) {
            const tEnd = h >= 24
              ? dayEnd
              : civilModel.resolve({
                  year: cur.year,
                  month: cur.month,
                  day: cur.day,
                  hour: h,
                  minute: 0,
                  second: 0,
                  timeZoneId,
                  disambiguation: 'compatible',
                });
            if (dayStart.isBefore(tEnd)) {
              intervals.push(new Interval(dayStart, tEnd));
            }
          }
        } else if (operator === 'eq') {
          const h = value as number;
          const tStart = civilModel.resolve({
            year: cur.year,
            month: cur.month,
            day: cur.day,
            hour: h,
            minute: 0,
            second: 0,
            timeZoneId,
            disambiguation: 'compatible',
          });
          const tEnd = h === 23
            ? dayEnd
            : civilModel.resolve({
                year: cur.year,
                month: cur.month,
                day: cur.day,
                hour: h + 1,
                minute: 0,
                second: 0,
                timeZoneId,
                disambiguation: 'compatible',
              });
          if (tStart.isBefore(tEnd)) {
            intervals.push(new Interval(tStart, tEnd));
          }
        } else if (operator === 'in') {
          const hours = value as readonly number[];
          for (const h of hours) {
            const tStart = civilModel.resolve({
              year: cur.year,
              month: cur.month,
              day: cur.day,
              hour: h,
              minute: 0,
              second: 0,
              timeZoneId,
              disambiguation: 'compatible',
            });
            const tEnd = h === 23
              ? dayEnd
              : civilModel.resolve({
                  year: cur.year,
                  month: cur.month,
                  day: cur.day,
                  hour: h + 1,
                  minute: 0,
                  second: 0,
                  timeZoneId,
                  disambiguation: 'compatible',
                });
            if (tStart.isBefore(tEnd)) {
              intervals.push(new Interval(tStart, tEnd));
            }
          }
        }
      }

      // 3. Daylight Saving property
      else if (property === 'isDaylightSaving') {
        const targetBool = value === true;
        const noon = civilModel.resolve({
          year: cur.year,
          month: cur.month,
          day: cur.day,
          hour: 12,
          minute: 0,
          second: 0,
          timeZoneId,
          disambiguation: 'compatible',
        });
        const noonState = civilModel.evaluate(noon, timeZoneId);
        const matches = operator === 'eq' ? noonState.isDaylightSaving === targetBool : noonState.isDaylightSaving !== targetBool;
        if (matches) {
          intervals.push(new Interval(dayStart, dayEnd));
        }
      }
    }

    if (cur.year === finalDay.year && cur.month === finalDay.month && cur.day === finalDay.day) {
      break;
    }
    cur = next;
  }

  if (intervals.length === 0) {
    return IntervalSet.empty();
  }

  return IntervalSet.from(intervals).intersect(window);
}
