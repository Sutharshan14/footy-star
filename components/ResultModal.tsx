'use client';

import type { Player } from '@/types/player';

export default function ResultModal({
  status,
  target,
  guessCount,
  onPlayAgain,
}: {
  status: 'won' | 'lost';
  target: Player;
  guessCount: number;
  onPlayAgain: () => void;
}) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 text-center shadow-xl dark:bg-zinc-900">
        <h2 className="text-2xl font-bold">
          {status === 'won' ? 'Got it!' : 'Out of guesses'}
        </h2>
        <p className="mt-3 text-base">
          {status === 'won' ? (
            <>
              You got it in <span className="font-semibold">{guessCount}</span>{' '}
              {guessCount === 1 ? 'guess' : 'guesses'}!
            </>
          ) : (
            <>
              The answer was{' '}
              <span className="font-semibold">
                {target.firstName} {target.lastName}
              </span>
              .
            </>
          )}
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          {target.team} · {target.position}
        </p>
        <button
          type="button"
          onClick={onPlayAgain}
          className="mt-5 w-full rounded-md bg-black px-4 py-3 text-base font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          Play Again
        </button>
      </div>
    </div>
  );
}
