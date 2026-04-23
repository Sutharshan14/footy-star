import type { Player } from './player';

export type HintColor = 'green' | 'yellow' | 'orange' | 'red' | 'grey';
export type Direction = 'up' | 'down' | null;

export interface AttributeHint {
  value: string | number;
  color: HintColor;
  direction?: Direction;
}

export interface GuessResult {
  player: Player;
  hints: {
    team: AttributeHint;
    position: AttributeHint;
    age: AttributeHint;
    height: AttributeHint;
    games: AttributeHint;
    jumper: AttributeHint;
    era: AttributeHint;
  };
  isCorrect: boolean;
}
