// TODO: Phase 4 — implement localStorage wrappers for stats and daily state
export interface Stats {
  played: number;
  won: number;
  currentStreak: number;
  maxStreak: number;
  distribution: Record<number, number>;
}
