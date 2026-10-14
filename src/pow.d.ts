export interface PowOptions {
  maxnumber?: number;
  field?: string;
  require?: boolean | 'soft';
}

export function resolvePow(opts?: { pow?: boolean | PowOptions }): (PowOptions & { field?: string }) | null;
export function createPowChallenge(opts?: Record<string, unknown>, now?: number): Record<string, unknown> | null;
export function createPowChallengeWithSolution(opts?: Record<string, unknown>, now?: number): Record<string, unknown> | null;
export function solvePowChallenge(challenge: Record<string, unknown>, opts?: { batchSize?: number; onProgress?: (p: { done: number; total: number }) => void }): number | null;
export function encodePowPayload(challenge: Record<string, unknown>, number: number): string;
export function verifyPow(payload: string | undefined, opts?: Record<string, unknown>, now?: number): { ok: boolean; skipped?: boolean; soft?: boolean; reason?: string };
