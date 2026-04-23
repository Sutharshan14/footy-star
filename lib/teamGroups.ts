import type { Team, State, Position } from '@/types/player';

export type PositionGroup = 'forward' | 'midfield' | 'defender' | 'ruck';

export const TEAM_TO_STATE: Record<Team, State> = {
  'Adelaide': 'SA',
  'Brisbane': 'QLD',
  'Carlton': 'VIC',
  'Collingwood': 'VIC',
  'Essendon': 'VIC',
  'Fremantle': 'WA',
  'Geelong': 'VIC',
  'Gold Coast': 'QLD',
  'GWS': 'NSW',
  'Hawthorn': 'VIC',
  'Melbourne': 'VIC',
  'North Melbourne': 'VIC',
  'Port Adelaide': 'SA',
  'Richmond': 'VIC',
  'St Kilda': 'VIC',
  'Sydney': 'NSW',
  'West Coast': 'WA',
  'Western Bulldogs': 'VIC',
};

export const POSITION_GROUPS: Record<Position, PositionGroup> = {
  'Key Forward': 'forward',
  'Small Forward': 'forward',
  'Forward Flank': 'forward',
  'Midfielder': 'midfield',
  'Wing': 'midfield',
  'Ruck': 'ruck',
  'Half Back': 'defender',
  'Key Defender': 'defender',
  'Small Defender': 'defender',
};
