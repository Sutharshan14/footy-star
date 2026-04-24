export default function Header() {
  return (
    <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <h1 className="text-xl font-bold tracking-tight">Footy Star</h1>
      <button
        type="button"
        aria-label="How to play"
        className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
      >
        i
      </button>
    </header>
  );
}
