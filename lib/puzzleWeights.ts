// TODO: Phase 4 — implement puzzle weighting
import type { Player } from '@/types/player';

export function bucketFor(player: Player): 'A' | 'B' | 'C' | 'D' | 'E' {
  throw new Error('Not implemented');
}

export const BUCKET_SHARES = {
  A: 0.50, B: 0.30, C: 0.12, D: 0.06, E: 0.02,
} as const;
