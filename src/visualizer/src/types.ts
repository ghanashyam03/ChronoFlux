import type {
  Instant,
  Place,
  ConditionAST,
} from 'time-2.0';

export type AppTab = 'home' | 'explore' | 'visualize' | 'build' | 'docs';

export type UserMode = 'simple' | 'advanced';

export type SearchWindowDuration = '24h' | '48h' | '7d';

export type PlaybackSpeed = 1 | 60 | 600 | 3600 | 86400;

export interface LocationPreset {
  readonly id: string;
  readonly name: string;
  readonly country: string;
  readonly place: Place;
  readonly description: string;
}

export interface DatePreset {
  readonly id: string;
  readonly name: string;
  readonly instant: Instant;
  readonly description: string;
}

export interface QueryPreset {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly condition: ConditionAST;
  readonly targetDomain: 'solar' | 'civil' | 'hybrid';
}

export interface SubsolarPoint {
  readonly latitudeDeg: number;
  readonly longitudeDeg: number;
  readonly declinationDeg: number;
  readonly greenwichHourAngleDeg: number;
}

export interface GlossaryTerm {
  readonly term: string;
  readonly simpleExplanation: string;
  readonly detailedExplanation: string;
  readonly category: 'solar' | 'civil' | 'intervals' | 'engine';
}

export interface InteractiveQuestion {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly locationId: string;
  readonly datePresetId?: string;
  readonly defaultHourUtc: number;
  readonly questionType: 'sunrise_sunset' | 'daylight_duration' | 'darkness' | 'comparison' | 'polar' | 'seasons';
}
