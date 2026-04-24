import type { AttributeHint, HintColor } from '@/types/hint';
import type { GuessResult } from '@/types/hint';

const COLOR_CLASS: Record<HintColor, string> = {
  green: 'bg-green-500 text-white',
  yellow: 'bg-yellow-400 text-black',
  orange: 'bg-orange-400 text-white',
  red: 'bg-red-500 text-white',
  grey: 'bg-gray-300 text-black',
};

function HintCell({ hint }: { hint: AttributeHint }) {
  const arrow =
    hint.direction === 'up' ? '↑' : hint.direction === 'down' ? '↓' : '';
  return (
    <div
      className={`flex aspect-square min-w-0 flex-1 flex-col items-center justify-center overflow-hidden p-0.5 text-center text-[10px] font-semibold leading-tight ${COLOR_CLASS[hint.color]}`}
    >
      <span className="line-clamp-2 break-words">{hint.value}</span>
      {arrow && <span className="text-sm leading-none">{arrow}</span>}
    </div>
  );
}

export default function GuessRow({ result }: { result: GuessResult }) {
  const { player, hints } = result;
  return (
    <div className="flex items-stretch gap-0.5">
      <div className="flex w-20 shrink-0 items-center bg-zinc-100 px-1.5 text-[11px] font-medium leading-tight dark:bg-zinc-900">
        {player.firstName} {player.lastName}
      </div>
      <HintCell hint={hints.team} />
      <HintCell hint={hints.position} />
      <HintCell hint={hints.age} />
      <HintCell hint={hints.height} />
      <HintCell hint={hints.games} />
      <HintCell hint={hints.jumper} />
      <HintCell hint={hints.era} />
    </div>
  );
}
