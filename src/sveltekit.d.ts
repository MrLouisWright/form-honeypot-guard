import type { FetchGuardResult, GuardOptions } from './index.d.ts';

export function sveltekitHandle(options?: GuardOptions): (input: {
  event: { request: Request; getClientAddress?: () => string; locals: Record<string, unknown> };
  resolve: (event: unknown) => Response | Promise<Response>;
}) => Promise<Response>;

export function sveltekitAction<T>(
  handler: (event: { request: Request; locals: Record<string, unknown> }, guard: FetchGuardResult) => T,
  options?: GuardOptions,
): (event: { request: Request; getClientAddress?: () => string; locals: Record<string, unknown> }) => Promise<T | Response>;
