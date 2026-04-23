import { describe, it, expect } from 'vitest';
import type { Player } from '@/types/player';
import { compareGuess } from '@/lib/compareGuess';

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'test-player',
    firstName: 'Test',
    lastName: 'Player',
    team: 'Carlton',
    position: 'Midfielder',
    age: 28,
    heightCm: 185,
    gamesPlayed: 150,
    jumperNumber: 10,
    state: 'VIC',
    debutYear: 2015,
    finalYear: null,
    active: true,
    ...overrides,
  };
}

describe('compareGuess', () => {
  it('exact match — all green, isCorrect true', () => {
    const target = makePlayer();
    const guess = makePlayer();
    const result = compareGuess(guess, target);

    expect(result.isCorrect).toBe(true);
    expect(result.hints.team.color).toBe('green');
    expect(result.hints.position.color).toBe('green');
    expect(result.hints.age.color).toBe('green');
    expect(result.hints.height.color).toBe('green');
    expect(result.hints.games.color).toBe('green');
    expect(result.hints.jumper.color).toBe('green');
    expect(result.hints.era.color).toBe('green');
    expect(result.hints.age.direction).toBe(null);
    expect(result.hints.era.direction).toBe(null);
  });

  it('same team, different everything else — team green', () => {
    const target = makePlayer({
      id: 'target',
      team: 'Carlton',
      position: 'Key Defender',
      age: 34,
      heightCm: 200,
      gamesPlayed: 300,
      jumperNumber: 1,
      debutYear: 2005,
      finalYear: 2020,
    });
    const guess = makePlayer({
      id: 'guess',
      team: 'Carlton',
    });
    const result = compareGuess(guess, target);

    expect(result.isCorrect).toBe(false);
    expect(result.hints.team.color).toBe('green');
    expect(result.hints.position.color).toBe('grey');
    expect(result.hints.age.color).toBe('grey');
    expect(result.hints.height.color).toBe('grey');
    expect(result.hints.games.color).toBe('grey');
    expect(result.hints.jumper.color).toBe('grey');
  });

  it('same state, different team — team yellow', () => {
    const target = makePlayer({ team: 'Geelong' });
    const guess = makePlayer({ team: 'Hawthorn' });
    const result = compareGuess(guess, target);

    expect(result.hints.team.color).toBe('yellow');
    expect(result.hints.team.value).toBe('Hawthorn');
  });

  it('same position group, different specific position — position yellow', () => {
    const target = makePlayer({ position: 'Key Forward' });
    const guess = makePlayer({ position: 'Small Forward' });
    const result = compareGuess(guess, target);

    expect(result.hints.position.color).toBe('yellow');
    expect(result.hints.position.value).toBe('Small Forward');
  });

  it('numeric within tolerance — yellow with up arrow (target is higher)', () => {
    const target = makePlayer({ age: 28 });
    const guess = makePlayer({ age: 26 });
    const result = compareGuess(guess, target);

    expect(result.hints.age.color).toBe('yellow');
    expect(result.hints.age.direction).toBe('up');
    expect(result.hints.age.value).toBe(26);
  });

  it('numeric within tolerance — yellow with down arrow (target is lower)', () => {
    const target = makePlayer({ heightCm: 185 });
    const guess = makePlayer({ heightCm: 189 });
    const result = compareGuess(guess, target);

    expect(result.hints.height.color).toBe('yellow');
    expect(result.hints.height.direction).toBe('down');
  });

  it('numeric outside tolerance — grey with arrow', () => {
    const target = makePlayer({ gamesPlayed: 200 });
    const guess = makePlayer({ gamesPlayed: 50 });
    const result = compareGuess(guess, target);

    expect(result.hints.games.color).toBe('grey');
    expect(result.hints.games.direction).toBe('up');
  });

  it('jumper within 5 is yellow, jumper off by 6 is grey', () => {
    const targetA = makePlayer({ jumperNumber: 9 });
    const guessA = makePlayer({ jumperNumber: 7 });
    const resA = compareGuess(guessA, targetA);
    expect(resA.hints.jumper.color).toBe('yellow');
    expect(resA.hints.jumper.direction).toBe('up');

    const targetB = makePlayer({ jumperNumber: 9 });
    const guessB = makePlayer({ jumperNumber: 20 });
    const resB = compareGuess(guessB, targetB);
    expect(resB.hints.jumper.color).toBe('grey');
    expect(resB.hints.jumper.direction).toBe('down');
  });

  it('era: careers overlap — green, no arrow', () => {
    const target = makePlayer({ debutYear: 2005, finalYear: 2015 });
    const guess = makePlayer({ debutYear: 2012, finalYear: 2022 });
    const result = compareGuess(guess, target);

    expect(result.hints.era.color).toBe('green');
    expect(result.hints.era.direction).toBe(null);
    expect(result.hints.era.value).toBe(0);
  });

  it('era: 5y gap — yellow', () => {
    const target = makePlayer({ debutYear: 2000, finalYear: 2010 });
    const guess = makePlayer({ debutYear: 2015, finalYear: 2024 });
    const result = compareGuess(guess, target);

    expect(result.hints.era.color).toBe('yellow');
    expect(result.hints.era.value).toBe(5);
    expect(result.hints.era.direction).toBe(null);
  });

  it('era: 25y gap — orange', () => {
    const target = makePlayer({ debutYear: 1975, finalYear: 1990 });
    const guess = makePlayer({ debutYear: 2015, finalYear: 2024 });
    const result = compareGuess(guess, target);

    expect(result.hints.era.color).toBe('orange');
    expect(result.hints.era.value).toBe(25);
  });

  it('era: 60y gap — red', () => {
    const target = makePlayer({ debutYear: 1970, finalYear: 1980 });
    const guess = makePlayer({ debutYear: 2040, finalYear: 2050 });
    const result = compareGuess(guess, target);

    expect(result.hints.era.color).toBe('red');
    expect(result.hints.era.value).toBe(60);
  });

  it('complete mismatch — everything grey (categoricals) / grey (numerics), era red', () => {
    const target = makePlayer({
      id: 'target',
      team: 'Brisbane',
      position: 'Key Forward',
      state: 'QLD',
      age: 22,
      heightCm: 200,
      gamesPlayed: 50,
      jumperNumber: 1,
      debutYear: 2022,
      finalYear: null,
    });
    const guess = makePlayer({
      id: 'guess',
      team: 'West Coast',
      position: 'Small Defender',
      state: 'WA',
      age: 35,
      heightCm: 175,
      gamesPlayed: 280,
      jumperNumber: 30,
      debutYear: 1980,
      finalYear: 1995,
    });
    const result = compareGuess(guess, target);

    expect(result.isCorrect).toBe(false);
    expect(result.hints.team.color).toBe('grey');
    expect(result.hints.position.color).toBe('grey');
    expect(result.hints.age.color).toBe('grey');
    expect(result.hints.height.color).toBe('grey');
    expect(result.hints.games.color).toBe('grey');
    expect(result.hints.jumper.color).toBe('grey');
    expect(result.hints.era.color).toBe('orange');
  });
});
