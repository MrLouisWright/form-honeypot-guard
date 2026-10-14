import { createFetchGuard } from './middleware.js';

/**
 * Remix `action` export — verifies the submission before your handler runs.
 * @template T
 * @param {(args: { request: Request, guard: import('./index.d.ts').FetchGuardResult, context?: unknown }) => T} handler
 * @param {import('./index.d.ts').GuardOptions} [options]
 */
export function remixAction(handler, options = {}) {
  const guard = createFetchGuard({ trustProxy: true, ...options });
  return async ({ request, context }) => {
    const g = await guard(request, { ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '' });
    if (g.response) return g.response;
    return handler({ request, guard: g, context });
  };
}

/** Remix `loader` for GET token endpoint when `tokenEndpoint` matches. */
export function remixTokenLoader(options = {}) {
  const guard = createFetchGuard({ trustProxy: true, ...options });
  return async ({ request }) => {
    const g = await guard(request);
    if (g.response) return g.response;
    return new Response('Not found', { status: 404 });
  };
}
