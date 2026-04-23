import players from '@/data/players.json';

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <h1 className="text-5xl font-bold tracking-tight text-black dark:text-white">
        Footy Star — {players.length} players loaded
      </h1>
    </div>
  );
}
