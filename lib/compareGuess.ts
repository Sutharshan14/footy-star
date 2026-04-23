import type { Player } from '@/types/player';
import type { AttributeHint, Direction, HintColor, GuessResult } from '@/types/hint';
import { TEAM_TO_STATE, POSITION_GROUPS } from './teamGroups';
import { eraInterval } from './eraInterval';

function numericHint(
  guess: number,
  target: number,
  tolerance: number,
): AttributeHint {
  const diff = guess - target;
  let color: HintColor;
  if (diff === 0) color = 'green';
  else if (Math.abs(diff) <= tolerance) color = 'yellow';
  else color = 'grey';

  let direction: Direction = null;
  if (diff > 0) direction = 'down';
  else if (diff < 0) direction = 'up';

  return { value: guess, color, direction };
}

function teamHint(guess: Player, target: Player): AttributeHint {
  let color: HintColor = 'grey';
  if (guess.team === target.team) color = 'green';
  else if (TEAM_TO_STATE[guess.team] === TEAM_TO_STATE[target.team]) color = 'yellow';
  return { value: guess.team, color };
}

function positionHint(guess: Player, target: Player): AttributeHint {
  let color: HintColor = 'grey';
  if (guess.position === target.position) color = 'green';
  else if (POSITION_GROUPS[guess.position] === POSITION_GROUPS[target.position]) color = 'yellow';
  return { value: guess.position, color };
}

function eraHint(guess: Player, target: Player): AttributeHint {
  const gap = eraInterval(guess, target);
  let color: HintColor;
  if (gap === 0) color = 'green';
  else if (gap <= 10) color = 'yellow';
  else if (gap <= 50) color = 'orange';
  else color = 'red';
  return { value: gap, color, direction: null };
}

export function compareGuess(guess: Player, target: Player): GuessResult {
  return {
    player: guess,
    hints: {
      team: teamHint(guess, target),
      position: positionHint(guess, target),
      age: numericHint(guess.age, target.age, 2),
      height: numericHint(guess.heightCm, target.heightCm, 5),
      games: numericHint(guess.gamesPlayed, target.gamesPlayed, 25),
      jumper: numericHint(guess.jumperNumber, target.jumperNumber, 5),
      era: eraHint(guess, target),
    },
    isCorrect: guess.id === target.id,
  };
}
