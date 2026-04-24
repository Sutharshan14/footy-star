'use client';

import { useMemo, useState } from 'react';
import type { Player } from '@/types/player';

const MAX_SUGGESTIONS = 8;

function matches(player: Player, query: string): boolean {
  const q = query.toLowerCase().trim();
  if (!q) return false;
  if (player.firstName.toLowerCase().includes(q)) return true;
  if (player.lastName.toLowerCase().includes(q)) return true;
  if (player.nicknames?.some((n) => n.toLowerCase().includes(q))) return true;
  return false;
}

export default function GuessInput({
  allPlayers,
  guessedIds,
  onGuess,
  disabled,
}: {
  allPlayers: Player[];
  guessedIds: string[];
  onGuess: (player: Player) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const suggestions = useMemo(() => {
    if (!query.trim()) return [];
    return allPlayers
      .filter((p) => !guessedIds.includes(p.id) && matches(p, query))
      .slice(0, MAX_SUGGESTIONS);
  }, [allPlayers, guessedIds, query]);

  const submit = (player: Player) => {
    onGuess(player);
    setQuery('');
    setActiveIndex(0);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = suggestions[activeIndex];
      if (pick) submit(pick);
    } else if (e.key === 'Escape') {
      setQuery('');
    }
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActiveIndex(0);
        }}
        onKeyDown={onKeyDown}
        disabled={disabled}
        placeholder="Type a player's name..."
        autoComplete="off"
        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base outline-none focus:border-zinc-500 disabled:cursor-not-allowed disabled:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900"
      />
      {suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-80 overflow-auto rounded-md border border-zinc-300 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {suggestions.map((player, i) => (
            <li
              key={player.id}
              onMouseDown={(e) => {
                e.preventDefault();
                submit(player);
              }}
              onMouseEnter={() => setActiveIndex(i)}
              className={`cursor-pointer px-3 py-2 text-sm ${
                i === activeIndex
                  ? 'bg-zinc-100 dark:bg-zinc-800'
                  : ''
              }`}
            >
              <span className="font-medium">
                {player.firstName} {player.lastName}
              </span>
              <span className="ml-2 text-xs text-zinc-500">{player.team}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
