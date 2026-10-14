import type { FetchGuardResult, GuardOptions } from './index.d.ts';

export function astroPost(
  handler: (context: { request: Request; guard: FetchGuardResult; params: Record<string, string> }) => Response | Promise<Response>,
  options?: GuardOptions,
): (request: Request, ctx?: { params?: Record<string, string> }) => Promise<Response>;

export function astroGet(options?: GuardOptions): (request: Request, ctx?: unknown) => Promise<Response>;

export function astroRoute(
  handler: (context: { request: Request; guard: FetchGuardResult; params: Record<string, string> }) => Response | Promise<Response>,
  options?: GuardOptions,
): { GET: ReturnType<typeof astroGet>; POST: ReturnType<typeof astroPost> };
