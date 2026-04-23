// TODO: Phase 2 — implement team-to-state and position group mappings
import type { Team, State, Position } from '@/types/player';

export const TEAM_TO_STATE: Record<Team, State> = {} as Record<Team, State>;

export const POSITION_GROUPS: Record<string, Position[]> = {
  forward: ['Key Forward', 'Small Forward', 'Forward Flank'],
  midfield: ['Midfielder', 'Wing'],
  back: ['Half Back', 'Key Defender', 'Small Defender'],
  ruck: ['Ruck'],
};
