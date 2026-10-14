import { withFormGuard } from './middleware.js';

/**
 * Astro server endpoint (`export const POST = astroPost(...)`).
 * @template C
 * @param {(context: { request: Request, guard: import('./index.d.ts').FetchGuardResult, params: Record<string, string> }) => Response | Promise<Response>} handler
 * @param {import('./index.d.ts').GuardOptions} [options]
 */
export function astroPost(handler, options = {}) {
  return withFormGuard(async (request, ctx, guard) => handler({ request, guard, params: ctx?.params || {} }), { trustProxy: true, ...options });
}

/** Astro `GET` handler for the token endpoint. */
export function astroGet(options = {}) {
  return withFormGuard(() => new Response('Not found', { status: 404 }), { trustProxy: true, ...options });
}

/** Combined route map for Astro 4+ `export const GET/POST`. */
export function astroRoute(handler, options = {}) {
  return {
    GET: astroGet(options),
    POST: astroPost(handler, options),
  };
}
