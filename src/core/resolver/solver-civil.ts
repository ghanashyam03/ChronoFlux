/**
 * @file solver-civil.ts
 * Discrete civil time interval engine.
 * Iterates calendar days within the search window in the target IANA timezone
 * and synthesizes exact half-open intervals using verified Time.civil.resolve()
 * with Daylight Saving Time (DST) disambiguation.
 */

import { safeDateUtc } from '../models/civil/disambiguation.js';
import { civilModel, getTimeZoneLookupProvider } from '../models/civil/index.js';
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

function recordProvenance(
  map: Map<string, CivilBoundaryProvenance> | undefined,
  instant: Instant,
  boundaryType: 'start' | 'end',
  property: CivilProperty,
  value: number | string | boolean,
  timeZoneId: string,
  reason: string,
  conditionDescription: string
): void {
  if (!map) return;
  map.set(`${boundaryType}:${instant.epochNanoseconds}`, {
    instant,
    boundaryType,
    property,
    value,
    timeZoneId,
    reason,
    conditionDescription,
  });
}

function addDays(year: number, month: number, day: number, delta: number): { year: number; month: number; day: number } {
  const d = new Date(safeDateUtc(year, month - 1, day + delta));
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

function matchesHourOp(h: number, operator: string, target: number | readonly number[]): boolean {
  switch (operator) {
    case 'eq':
      return h === target;
    case 'neq':
      return h !== target;
    case 'gt':
      return h > (target as number);
    case 'gte':
      return h >= (target as number);
    case 'lt':
      return h < (target as number);
    case 'lte':
      return h <= (target as number);
    case 'between': {
      const [minV, maxV] = target as readonly [number, number];
      return h >= minV && h < maxV;
    }
    case 'in':
      return (target as readonly number[]).includes(h);
    default:
      return false;
  }
}

interface HourBlock {
  readonly hour: number;
  readonly disambiguation: 'earlier' | 'later' | 'compatible';
  readonly start: Instant;
  readonly end: Instant;
}

function getHourBlocksForDay(
  year: number,
  month: number,
  day: number,
  timeZoneId: string,
  dayEnd: Instant,
  isFallBackDay: boolean
): readonly HourBlock[] {
  const blocks: HourBlock[] = [];

  for (let h = 0; h < 24; h++) {
    const tEarlier = civilModel.resolve({
      year,
      month,
      day,
      hour: h,
      minute: 0,
      second: 0,
      timeZoneId,
      disambiguation: isFallBackDay ? 'earlier' : 'compatible',
    });
    const tLater = isFallBackDay
      ? civilModel.resolve({
          year,
          month,
          day,
          hour: h,
          minute: 0,
          second: 0,
          timeZoneId,
          disambiguation: 'later',
        })
      : tEarlier;

    const nextH = h + 1;
    const nextHourStart =
      nextH >= 24
        ? dayEnd
        : civilModel.resolve({
            year,
            month,
            day,
            hour: nextH,
            minute: 0,
            second: 0,
            timeZoneId,
            disambiguation: isFallBackDay ? 'earlier' : 'compatible',
          });

    if (tEarlier.equals(tLater)) {
      if (tEarlier.isBefore(nextHourStart)) {
        blocks.push({
          hour: h,
          disambiguation: 'compatible',
          start: tEarlier,
          end: nextHourStart,
        });
      }
    } else {
      if (tEarlier.isBefore(tLater)) {
        blocks.push({
          hour: h,
          disambiguation: 'earlier',
          start: tEarlier,
          end: tLater,
        });
      }
      if (tLater.isBefore(nextHourStart)) {
        blocks.push({
          hour: h,
          disambiguation: 'later',
          start: tLater,
          end: nextHourStart,
        });
      }
    }
  }

  return blocks;
}

/**
 * Resolves the effective IANA time zone identifier for a Place.
 * Requires an explicit place.timeZoneId or a registered TimeZoneLookupProvider;
 * never silently falls back to UTC.
 */
export function getEffectiveTimeZoneId(place: Place): string {
  if (place.timeZoneId && place.timeZoneId.trim().length > 0) {
    return place.timeZoneId.trim();
  }
  const provider = getTimeZoneLookupProvider();
  if (provider) {
    const lookedUp = provider.lookup(place.latitude, place.longitude);
    if (lookedUp && lookedUp.trim().length > 0) {
      return lookedUp.trim();
    }
  }
  throw new TypeError(
    'Civil condition resolution requires an explicit timeZoneId on Place or a registered geographic timezone lookup provider'
  );
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
  const timeZoneId = getEffectiveTimeZoneId(place);
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
      // Detect fall-back transition days via offset shift between day boundaries
      const startOffset = civilModel.evaluate(dayStart, timeZoneId).utcOffsetMinutes;
      const endOffset = civilModel.evaluate(dayEnd, timeZoneId).utcOffsetMinutes;
      const isFallBackDay = startOffset > endOffset;
      // 1. Whole-day properties: dayOfWeek, day, month, year
      if (property === 'dayOfWeek' || property === 'day' || property === 'month' || property === 'year') {
        let actual: number;
        if (property === 'dayOfWeek') {
          const d = safeDateUtc(cur.year, cur.month - 1, cur.day);
          const dt = new Date(d);
          actual = dt.getUTCDay() === 0 ? 7 : dt.getUTCDay();
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
          recordProvenance(
            boundaryRecordMap,
            dayStart,
            'start',
            property,
            actual,
            timeZoneId,
            `Civil date entered matching ${property}=${actual} in ${timeZoneId}.`,
            `civil.${property} ${operator} ${JSON.stringify(value)}`
          );
          recordProvenance(
            boundaryRecordMap,
            dayEnd,
            'end',
            property,
            actual,
            timeZoneId,
            `Civil date exited matching ${property}=${actual} in ${timeZoneId}.`,
            `civil.${property} ${operator} ${JSON.stringify(value)}`
          );
        }
      }

      // 2. Hour property
      else if (property === 'hour') {
        const hourBlocks = getHourBlocksForDay(cur.year, cur.month, cur.day, timeZoneId, dayEnd, isFallBackDay);
        for (const block of hourBlocks) {
          if (matchesHourOp(block.hour, operator, value as number | readonly number[])) {
            intervals.push(new Interval(block.start, block.end));
          }
        }

        if (boundaryRecordMap) {
          if (operator === 'between') {
            const [hStart, hEnd] = value as readonly [number, number];
            const isBizHours = hStart === 9 && hEnd === 17;
            const matchingBlocks = hourBlocks.filter((b) =>
              matchesHourOp(b.hour, operator, value as number | readonly number[])
            );
            if (matchingBlocks.length > 0) {
              const firstBlock = matchingBlocks[0]!;
              const lastBlock = matchingBlocks[matchingBlocks.length - 1]!;
              recordProvenance(
                boundaryRecordMap,
                firstBlock.start,
                'start',
                'hour',
                hStart,
                timeZoneId,
                isBizHours
                  ? `Civil time entered business hours (${String(hStart).padStart(2, '0')}:00) in ${timeZoneId}.`
                  : `Civil time entered hour ${String(hStart).padStart(2, '0')}:00 in ${timeZoneId}.`,
                `civil.hour >= ${hStart}`
              );
              recordProvenance(
                boundaryRecordMap,
                lastBlock.end,
                'end',
                'hour',
                hEnd,
                timeZoneId,
                isBizHours
                  ? `Civil time exited business hours (${String(hEnd).padStart(2, '0')}:00) in ${timeZoneId}.`
                  : `Civil time exited hour ${String(hEnd).padStart(2, '0')}:00 in ${timeZoneId}.`,
                `civil.hour < ${hEnd}`
              );
            }
          } else if (operator === 'gte' || operator === 'gt') {
            const h = operator === 'gte' ? (value as number) : (value as number) + 1;
            const matchingBlocks = hourBlocks.filter((b) =>
              matchesHourOp(b.hour, operator, value as number | readonly number[])
            );
            if (matchingBlocks.length > 0) {
              const firstBlock = matchingBlocks[0]!;
              recordProvenance(
                boundaryRecordMap,
                firstBlock.start,
                'start',
                'hour',
                h,
                timeZoneId,
                `Civil time entered hour >= ${h}:00 in ${timeZoneId}.`,
                `civil.hour >= ${h}`
              );
              recordProvenance(
                boundaryRecordMap,
                dayEnd,
                'end',
                'hour',
                24,
                timeZoneId,
                `Civil time exited matching hour in ${timeZoneId}.`,
                `civil.hour >= ${h}`
              );
            }
          } else if (operator === 'lte' || operator === 'lt') {
            const h = operator === 'lte' ? (value as number) + 1 : (value as number);
            const matchingBlocks = hourBlocks.filter((b) =>
              matchesHourOp(b.hour, operator, value as number | readonly number[])
            );
            if (matchingBlocks.length > 0) {
              const lastBlock = matchingBlocks[matchingBlocks.length - 1]!;
              recordProvenance(
                boundaryRecordMap,
                dayStart,
                'start',
                'hour',
                0,
                timeZoneId,
                `Civil time entered matching hour in ${timeZoneId}.`,
                `civil.hour < ${h}`
              );
              recordProvenance(
                boundaryRecordMap,
                lastBlock.end,
                'end',
                'hour',
                h,
                timeZoneId,
                `Civil time exited hour < ${h}:00 in ${timeZoneId}.`,
                `civil.hour < ${h}`
              );
            }
          } else if (operator === 'eq') {
            const h = value as number;
            const matchingBlocks = hourBlocks.filter((b) => b.hour === h);
            for (const b of matchingBlocks) {
              recordProvenance(
                boundaryRecordMap,
                b.start,
                'start',
                'hour',
                h,
                timeZoneId,
                `Civil time entered hour ${String(h).padStart(2, '0')}:00 in ${timeZoneId}.`,
                `civil.hour == ${h}`
              );
              recordProvenance(
                boundaryRecordMap,
                b.end,
                'end',
                'hour',
                h + 1,
                timeZoneId,
                `Civil time exited hour ${String(h).padStart(2, '0')}:00 in ${timeZoneId}.`,
                `civil.hour == ${h}`
              );
            }
          } else if (operator === 'in') {
            const hours = value as readonly number[];
            const matchingBlocks = hourBlocks.filter((b) => hours.includes(b.hour));
            for (const b of matchingBlocks) {
              recordProvenance(
                boundaryRecordMap,
                b.start,
                'start',
                'hour',
                b.hour,
                timeZoneId,
                `Civil time entered hour ${String(b.hour).padStart(2, '0')}:00 in ${timeZoneId}.`,
                `civil.hour in ${JSON.stringify(hours)}`
              );
              recordProvenance(
                boundaryRecordMap,
                b.end,
                'end',
                'hour',
                b.hour + 1,
                timeZoneId,
                `Civil time exited hour ${String(b.hour).padStart(2, '0')}:00 in ${timeZoneId}.`,
                `civil.hour in ${JSON.stringify(hours)}`
              );
            }
          }
        }
      }

      // 3. Minute property
      else if (property === 'minute') {
        const hourBlocks = getHourBlocksForDay(cur.year, cur.month, cur.day, timeZoneId, dayEnd, isFallBackDay);
        for (const block of hourBlocks) {
          if (operator === 'between') {
            const [mStart, mEnd] = value as readonly [number, number];
            const clampedStart = Math.max(0, Math.min(59, mStart));
            const clampedEnd = Math.max(0, Math.min(60, mEnd));
            if (clampedStart < clampedEnd) {
              const tStart =
                clampedStart === 0
                  ? block.start
                  : civilModel.resolve({
                      year: cur.year,
                      month: cur.month,
                      day: cur.day,
                      hour: block.hour,
                      minute: clampedStart,
                      second: 0,
                      timeZoneId,
                      disambiguation: block.disambiguation,
                    });
              const tEnd =
                clampedEnd >= 60
                  ? block.end
                  : civilModel.resolve({
                      year: cur.year,
                      month: cur.month,
                      day: cur.day,
                      hour: block.hour,
                      minute: clampedEnd,
                      second: 0,
                      timeZoneId,
                      disambiguation: block.disambiguation,
                    });

              if (tStart.isBefore(tEnd)) {
                intervals.push(new Interval(tStart, tEnd));
                recordProvenance(
                  boundaryRecordMap,
                  tStart,
                  'start',
                  'minute',
                  clampedStart,
                  timeZoneId,
                  `Civil time entered minute ${String(clampedStart).padStart(2, '0')} in ${timeZoneId}.`,
                  `civil.minute >= ${clampedStart}`
                );
                recordProvenance(
                  boundaryRecordMap,
                  tEnd,
                  'end',
                  'minute',
                  clampedEnd,
                  timeZoneId,
                  `Civil time exited minute ${String(clampedEnd).padStart(2, '0')} in ${timeZoneId}.`,
                  `civil.minute < ${clampedEnd}`
                );
              }
            }
          } else if (operator === 'eq') {
            const m = value as number;
            if (m >= 0 && m <= 59) {
              const tStart =
                m === 0
                  ? block.start
                  : civilModel.resolve({
                      year: cur.year,
                      month: cur.month,
                      day: cur.day,
                      hour: block.hour,
                      minute: m,
                      second: 0,
                      timeZoneId,
                      disambiguation: block.disambiguation,
                    });
              const tEnd =
                m === 59
                  ? block.end
                  : civilModel.resolve({
                      year: cur.year,
                      month: cur.month,
                      day: cur.day,
                      hour: block.hour,
                      minute: m + 1,
                      second: 0,
                      timeZoneId,
                      disambiguation: block.disambiguation,
                    });

              if (tStart.isBefore(tEnd)) {
                intervals.push(new Interval(tStart, tEnd));
                recordProvenance(
                  boundaryRecordMap,
                  tStart,
                  'start',
                  'minute',
                  m,
                  timeZoneId,
                  `Civil time entered minute ${String(m).padStart(2, '0')} in ${timeZoneId}.`,
                  `civil.minute == ${m}`
                );
                recordProvenance(
                  boundaryRecordMap,
                  tEnd,
                  'end',
                  'minute',
                  m + 1,
                  timeZoneId,
                  `Civil time exited minute ${String(m).padStart(2, '0')} in ${timeZoneId}.`,
                  `civil.minute == ${m}`
                );
              }
            }
          } else {
            for (let m = 0; m < 60; m++) {
              if (matchesNumericOp(m, operator, value as number | readonly number[])) {
                const tStart =
                  m === 0
                    ? block.start
                    : civilModel.resolve({
                        year: cur.year,
                        month: cur.month,
                        day: cur.day,
                        hour: block.hour,
                        minute: m,
                        second: 0,
                        timeZoneId,
                        disambiguation: block.disambiguation,
                      });
                const tEnd =
                  m === 59
                    ? block.end
                    : civilModel.resolve({
                        year: cur.year,
                        month: cur.month,
                        day: cur.day,
                        hour: block.hour,
                        minute: m + 1,
                        second: 0,
                        timeZoneId,
                        disambiguation: block.disambiguation,
                      });

                if (tStart.isBefore(tEnd)) {
                  intervals.push(new Interval(tStart, tEnd));
                }
              }
            }
          }
        }
      }

      // 4. Second property
      else if (property === 'second') {
        if (window.duration.totalSeconds > 172800) {
          throw new RangeError('second queries are limited to search windows of at most 2 days to maintain performance');
        }
        const hourBlocks = getHourBlocksForDay(cur.year, cur.month, cur.day, timeZoneId, dayEnd, isFallBackDay);
        for (const block of hourBlocks) {
          for (let m = 0; m < 60; m++) {
            const minStart =
              m === 0
                ? block.start
                : civilModel.resolve({
                    year: cur.year,
                    month: cur.month,
                    day: cur.day,
                    hour: block.hour,
                    minute: m,
                    second: 0,
                    timeZoneId,
                    disambiguation: block.disambiguation,
                  });
            const minEnd =
              m === 59
                ? block.end
                : civilModel.resolve({
                    year: cur.year,
                    month: cur.month,
                    day: cur.day,
                    hour: block.hour,
                    minute: m + 1,
                    second: 0,
                    timeZoneId,
                    disambiguation: block.disambiguation,
                  });

            if (operator === 'between') {
              const [sStart, sEnd] = value as readonly [number, number];
              const clampedStart = Math.max(0, Math.min(59, sStart));
              const clampedEnd = Math.max(0, Math.min(60, sEnd));
              if (clampedStart < clampedEnd) {
                const tStart =
                  clampedStart === 0
                    ? minStart
                    : civilModel.resolve({
                        year: cur.year,
                        month: cur.month,
                        day: cur.day,
                        hour: block.hour,
                        minute: m,
                        second: clampedStart,
                        timeZoneId,
                        disambiguation: block.disambiguation,
                      });
                const tEnd =
                  clampedEnd >= 60
                    ? minEnd
                    : civilModel.resolve({
                        year: cur.year,
                        month: cur.month,
                        day: cur.day,
                        hour: block.hour,
                        minute: m,
                        second: clampedEnd,
                        timeZoneId,
                        disambiguation: block.disambiguation,
                      });

                if (tStart.isBefore(tEnd)) {
                  intervals.push(new Interval(tStart, tEnd));
                }
              }
            } else if (operator === 'eq') {
              const s = value as number;
              if (s >= 0 && s <= 59) {
                const tStart =
                  s === 0
                    ? minStart
                    : civilModel.resolve({
                        year: cur.year,
                        month: cur.month,
                        day: cur.day,
                        hour: block.hour,
                        minute: m,
                        second: s,
                        timeZoneId,
                        disambiguation: block.disambiguation,
                      });
                const tEnd =
                  s === 59
                    ? minEnd
                    : civilModel.resolve({
                        year: cur.year,
                        month: cur.month,
                        day: cur.day,
                        hour: block.hour,
                        minute: m,
                        second: s + 1,
                        timeZoneId,
                        disambiguation: block.disambiguation,
                      });

                if (tStart.isBefore(tEnd)) {
                  intervals.push(new Interval(tStart, tEnd));
                }
              }
            } else {
              for (let s = 0; s < 60; s++) {
                if (matchesNumericOp(s, operator, value as number | readonly number[])) {
                  const tStart =
                    s === 0
                      ? minStart
                      : civilModel.resolve({
                          year: cur.year,
                          month: cur.month,
                          day: cur.day,
                          hour: block.hour,
                          minute: m,
                          second: s,
                          timeZoneId,
                          disambiguation: block.disambiguation,
                        });
                  const tEnd =
                    s === 59
                      ? minEnd
                      : civilModel.resolve({
                          year: cur.year,
                          month: cur.month,
                          day: cur.day,
                          hour: block.hour,
                          minute: m,
                          second: s + 1,
                          timeZoneId,
                          disambiguation: block.disambiguation,
                        });

                  if (tStart.isBefore(tEnd)) {
                    intervals.push(new Interval(tStart, tEnd));
                  }
                }
              }
            }
          }
        }
      }

      // 5. Daylight Saving property
      else if (property === 'isDaylightSaving') {
        const targetBool = value === true;
        const startDst = civilModel.evaluate(dayStart, timeZoneId).isDaylightSaving;
        const endMinus1 = Instant.fromEpochNanoseconds(dayEnd.epochNanoseconds - 1_000_000n);
        const endDst = civilModel.evaluate(endMinus1, timeZoneId).isDaylightSaving;

        if (startDst === endDst) {
          const matches = operator === 'eq' ? startDst === targetBool : startDst !== targetBool;
          if (matches) {
            intervals.push(new Interval(dayStart, dayEnd));
            recordProvenance(
              boundaryRecordMap,
              dayStart,
              'start',
              'isDaylightSaving',
              targetBool,
              timeZoneId,
              `Entered daylight saving time (${targetBool}) in ${timeZoneId}.`,
              `civil.isDaylightSaving == ${targetBool}`
            );
            recordProvenance(
              boundaryRecordMap,
              dayEnd,
              'end',
              'isDaylightSaving',
              targetBool,
              timeZoneId,
              `Exited daylight saving time (${targetBool}) in ${timeZoneId}.`,
              `civil.isDaylightSaving == ${targetBool}`
            );
          }
        } else {
          // Binary search for the exact DST transition instant within the day
          let lowNs = dayStart.epochNanoseconds;
          let highNs = dayEnd.epochNanoseconds;
          for (let iter = 0; iter < 45; iter++) {
            const mid = (lowNs + highNs) / 2n;
            const midDst = civilModel.evaluate(Instant.fromEpochNanoseconds(mid), timeZoneId).isDaylightSaving;
            if (midDst === startDst) {
              lowNs = mid;
            } else {
              highNs = mid;
            }
          }
          // DST transitions occur on exact statutory second boundaries. Round to nearest second.
          const roundedSecNs = ((highNs + 500_000_000n) / 1_000_000_000n) * 1_000_000_000n;
          const transitionInstant = Instant.fromEpochNanoseconds(roundedSecNs);
          const startMatches = operator === 'eq' ? startDst === targetBool : startDst !== targetBool;
          const endMatches = operator === 'eq' ? endDst === targetBool : endDst !== targetBool;

          if (startMatches && dayStart.isBefore(transitionInstant)) {
            intervals.push(new Interval(dayStart, transitionInstant));
            recordProvenance(
              boundaryRecordMap,
              dayStart,
              'start',
              'isDaylightSaving',
              targetBool,
              timeZoneId,
              `Entered daylight saving time (${targetBool}) in ${timeZoneId}.`,
              `civil.isDaylightSaving == ${targetBool}`
            );
            recordProvenance(
              boundaryRecordMap,
              transitionInstant,
              'end',
              'isDaylightSaving',
              targetBool,
              timeZoneId,
              `Exited daylight saving time (${targetBool}) in ${timeZoneId}.`,
              `civil.isDaylightSaving == ${targetBool}`
            );
          }
          if (endMatches && transitionInstant.isBefore(dayEnd)) {
            intervals.push(new Interval(transitionInstant, dayEnd));
            recordProvenance(
              boundaryRecordMap,
              transitionInstant,
              'start',
              'isDaylightSaving',
              targetBool,
              timeZoneId,
              `Entered daylight saving time (${targetBool}) in ${timeZoneId}.`,
              `civil.isDaylightSaving == ${targetBool}`
            );
            recordProvenance(
              boundaryRecordMap,
              dayEnd,
              'end',
              'isDaylightSaving',
              targetBool,
              timeZoneId,
              `Exited daylight saving time (${targetBool}) in ${timeZoneId}.`,
              `civil.isDaylightSaving == ${targetBool}`
            );
          }
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
