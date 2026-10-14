import { createFetchGuard } from './middleware.js';

/**
 * SvelteKit `handle` hook — guards configured paths and exposes `event.locals.formGuard`.
 * @param {import('./index.d.ts').GuardOptions} [options]
 */
export function sveltekitHandle(options = {}) {
  const guard = createFetchGuard({ trustProxy: true, ...options });
  return async ({ event, resolve }) => {
    const ip = event.getClientAddress?.() ?? '';
    const g = await guard(event.request, { ip });
    if (g.response) return g.response;
    event.locals.formGuard = g;
    return resolve(event);
  };
}

/**
 * Wrap a SvelteKit form `actions` handler: `(event, guard) => …`.
 * @template T
 * @param {(event: import('@sveltejs/kit').RequestEvent, guard: import('./index.d.ts').FetchGuardResult) => T} handler
 * @param {import('./index.d.ts').GuardOptions} [options]
 */
export function sveltekitAction(handler, options = {}) {
  const guard = createFetchGuard({ trustProxy: true, ...options });
  return async (event) => {
    const ip = event.getClientAddress?.() ?? '';
    const g = await guard(event.request, { ip });
    if (g.response) return g.response;
    return handler(event, g);
  };
}
