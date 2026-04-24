import type { GuessResult } from '@/types/hint';
import GuessRow from './GuessRow';

const HEADERS = ['Team', 'Pos', 'Age', 'Ht', 'Games', '#', '#Pk', 'Era'];

function EmptyRow() {
  return (
    <div className="flex items-stretch gap-0.5">
      <div className="w-20 shrink-0 bg-zinc-50 dark:bg-zinc-950" />
      {HEADERS.map((_, i) => (
        <div
          key={i}
          className="aspect-square min-w-0 flex-1 border border-dashed border-zinc-200 dark:border-zinc-800"
        />
      ))}
    </div>
  );
}

export default function GuessGrid({
  guesses,
  maxGuesses,
}: {
  guesses: GuessResult[];
  maxGuesses: number;
}) {
  const empties = Math.max(0, maxGuesses - guesses.length);
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-stretch gap-0.5">
        <div className="w-20 shrink-0" />
        {HEADERS.map((label) => (
          <div
            key={label}
            className="flex min-w-0 flex-1 items-center justify-center py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500"
          >
            {label}
          </div>
        ))}
      </div>
      {guesses.map((result, i) => (
        <GuessRow key={i} result={result} />
      ))}
      {Array.from({ length: empties }).map((_, i) => (
        <EmptyRow key={`empty-${i}`} />
      ))}
    </div>
  );
}
