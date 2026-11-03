/**
 * @file engine.ts
 * Core temporal condition resolution engine & domain dispatcher.
 * Composes atomic solar and civil condition interval sets via exact
 * Allen interval set algebra (intersection, union, complement).
 */

import { Interval } from '../primitives/interval.js';
import { IntervalSet } from '../primitives/interval-set.js';
import { Place } from '../primitives/place.js';
import { ConditionAST, ModelDomain } from './ast.js';
import { solveCivilCondition, CivilBoundaryProvenance } from './solver-civil.js';
import { solveSolarCondition, SolarBoundaryProvenance } from './solver-solar.js';

export interface ResolutionContext {
  readonly place: Place;
  readonly within: Interval;
  readonly solarRecords: Map<string, SolarBoundaryProvenance>;
  readonly civilRecords: Map<string, CivilBoundaryProvenance>;
  readonly modelsConsulted: Set<ModelDomain>;
}

export function createResolutionContext(place: Place, within: Interval): ResolutionContext {
  return {
    place,
    within,
    solarRecords: new Map(),
    civilRecords: new Map(),
    modelsConsulted: new Set(),
  };
}

/**
 * Recursively resolves a ConditionAST node into an IntervalSet within the given context.
 */
export function resolveAST(node: ConditionAST, ctx: ResolutionContext): IntervalSet {
  if (node.kind === 'logical') {
    switch (node.operator) {
      case 'and': {
        let current = resolveAST(node.operands[0]!, ctx);
        for (let i = 1; i < node.operands.length; i++) {
          const next = resolveAST(node.operands[i]!, ctx);
          current = current.intersect(next);
        }
        return current;
      }
      case 'or': {
        let current = resolveAST(node.operands[0]!, ctx);
        for (let i = 1; i < node.operands.length; i++) {
          const next = resolveAST(node.operands[i]!, ctx);
          current = current.union(next);
        }
        return current.intersect(ctx.within);
      }
      case 'not': {
        const child = resolveAST(node.operands[0]!, ctx);
        return child.complement(ctx.within);
      }
      default:
        throw new TypeError(`Unknown logical operator: ${(node as any).operator}`);
    }
  }

  if (node.kind === 'comparison') {
    if (node.domain === 'solar') {
      ctx.modelsConsulted.add('solar');
      return solveSolarCondition(node, ctx.place, ctx.within, ctx.solarRecords);
    }
    if (node.domain === 'civil') {
      ctx.modelsConsulted.add('civil');
      return solveCivilCondition(node, ctx.place, ctx.within, ctx.civilRecords);
    }
  }

  throw new TypeError(`Unknown condition AST node: ${JSON.stringify(node)}`);
}
