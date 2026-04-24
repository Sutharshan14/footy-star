'use client';

import { useState } from 'react';
import players from '@/data/players.json';
import type { Player } from '@/types/player';
import type { GuessResult } from '@/types/hint';
import { compareGuess } from '@/lib/compareGuess';
import Header from '@/components/Header';
import GuessInput from '@/components/GuessInput';
import GuessGrid from '@/components/GuessGrid';
import ResultModal from '@/components/ResultModal';

const MAX_GUESSES = 8;
const ALL_PLAYERS = players as Player[];
const TARGET = ALL_PLAYERS.find((p) => p.id === 'patrick-cripps')!;

type GameStatus = 'playing' | 'won' | 'lost';

export default function Home() {
  const [guesses, setGuesses] = useState<GuessResult[]>([]);
  const [gameStatus, setGameStatus] = useState<GameStatus>('playing');

  const handleGuess = (player: Player) => {
    if (gameStatus !== 'playing') return;
    const result = compareGuess(player, TARGET);
    const next = [...guesses, result];
    setGuesses(next);
    if (result.isCorrect) {
      setGameStatus('won');
    } else if (next.length >= MAX_GUESSES) {
      setGameStatus('lost');
    }
  };

  const handlePlayAgain = () => {
    window.location.reload();
  };

  const guessedIds = guesses.map((g) => g.player.id);

  return (
    <main className="flex flex-1 flex-col">
      <Header />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-3 py-4">
        <GuessInput
          allPlayers={ALL_PLAYERS}
          guessedIds={guessedIds}
          onGuess={handleGuess}
          disabled={gameStatus !== 'playing'}
        />
        <p className="text-center text-xs text-zinc-500">
          Guess {Math.min(guesses.length + 1, MAX_GUESSES)} of {MAX_GUESSES}
        </p>
        <GuessGrid guesses={guesses} maxGuesses={MAX_GUESSES} />
      </div>
      {gameStatus !== 'playing' && (
        <ResultModal
          status={gameStatus}
          target={TARGET}
          guessCount={guesses.length}
          onPlayAgain={handlePlayAgain}
        />
      )}
    </main>
  );
}
