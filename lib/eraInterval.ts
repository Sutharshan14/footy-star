import type { Player } from '@/types/player';

export function eraInterval(a: Player, b: Player): number {
  const currentYear = new Date().getFullYear();
  const aFinal = a.finalYear ?? currentYear;
  const bFinal = b.finalYear ?? currentYear;

  if (a.debutYear <= bFinal && b.debutYear <= aFinal) {
    return 0;
  }
  if (a.debutYear > bFinal) return a.debutYear - bFinal;
  return b.debutYear - aFinal;
}
