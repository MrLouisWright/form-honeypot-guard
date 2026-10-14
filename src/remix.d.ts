import type { FetchGuardResult, GuardOptions } from './index.d.ts';

export function remixAction<T>(
  handler: (args: { request: Request; guard: FetchGuardResult; context?: unknown }) => T,
  options?: GuardOptions,
): (args: { request: Request; context?: unknown }) => Promise<T | Response>;

export function remixTokenLoader(options?: GuardOptions): (args: { request: Request }) => Promise<Response>;
