import type { Team, State, Position } from '@/types/player';

export type PositionGroup = 'forward' | 'midfield' | 'ruck' | 'defender';

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
  KEY_FORWARD: 'forward',
  MEDIUM_FORWARD: 'forward',
  MIDFIELDER_FORWARD: 'midfield',
  MIDFIELDER: 'midfield',
  RUCK: 'ruck',
  MEDIUM_DEFENDER: 'defender',
  KEY_DEFENDER: 'defender',
};

export const POSITION_DISPLAY: Record<Position, string> = {
  KEY_FORWARD: 'Key Forward',
  MEDIUM_FORWARD: 'Medium Forward',
  MIDFIELDER_FORWARD: 'Mid/Forward',
  MIDFIELDER: 'Midfielder',
  RUCK: 'Ruck',
  MEDIUM_DEFENDER: 'Medium Defender',
  KEY_DEFENDER: 'Key Defender',
};
