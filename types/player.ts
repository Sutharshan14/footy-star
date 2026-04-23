export type Team =
  | 'Adelaide' | 'Brisbane' | 'Carlton' | 'Collingwood'
  | 'Essendon' | 'Fremantle' | 'Geelong' | 'Gold Coast'
  | 'GWS' | 'Hawthorn' | 'Melbourne' | 'North Melbourne'
  | 'Port Adelaide' | 'Richmond' | 'St Kilda' | 'Sydney'
  | 'West Coast' | 'Western Bulldogs';

export type State = 'VIC' | 'NSW' | 'QLD' | 'SA' | 'WA' | 'TAS' | 'NT' | 'ACT';

export type Position =
  | 'Key Forward' | 'Small Forward' | 'Forward Flank'
  | 'Midfielder' | 'Ruck' | 'Wing'
  | 'Half Back' | 'Key Defender' | 'Small Defender';

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  nicknames?: string[];
  team: Team;
  position: Position;
  age: number;
  heightCm: number;
  gamesPlayed: number;
  jumperNumber: number;
  state: State;
  debutYear: number;
  finalYear: number | null;
  active: boolean;
}
