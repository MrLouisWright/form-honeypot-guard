import { isIP } from 'node:net';

const clean = (ip) => {
  if (!ip) return '';
  ip = String(ip).trim().replace(/^\[|\](:\d+)?$/g, '');
  if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(ip)) ip = ip.split(':')[0];
  if (ip.startsWith('::ffff:') && isIP(ip.slice(7)) === 4) ip = ip.slice(7);
  return ip;
};

/**
 * Work out the client IP.
 * trustProxy: false (default, use the socket address) | true (left-most X-Forwarded-For) |
 *             number (trust that many proxy hops from the right) | string[] (trusted proxy IPs)
 * ipHeader:   read a single header set by your edge, e.g. 'cf-connecting-ip', 'x-real-ip', 'x-nf-client-connection-ip'
 */
export function clientIp({ headers = {}, remoteAddress = '' }, { trustProxy = false, ipHeader } = {}) {
  const get = (h) => (typeof headers.get === 'function' ? headers.get(h) : headers[h]);
  const remote = clean(remoteAddress);
  if (!trustProxy) return remote;
  if (ipHeader) { const v = clean(String(get(ipHeader) || '').split(',')[0]); if (isIP(v)) return v; }
  const xff = String(get('x-forwarded-for') || '').split(',').map(clean).filter((x) => isIP(x));
  if (!xff.length) return remote;
  if (trustProxy === true) return xff[0];
  const chain = [...xff, remote].filter(Boolean);
  if (typeof trustProxy === 'number') return chain[Math.max(0, chain.length - 1 - trustProxy)];
  if (Array.isArray(trustProxy)) {
    const trusted = new Set(trustProxy.map(clean));
    for (let i = chain.length - 1; i >= 0; i--) if (!trusted.has(chain[i])) return chain[i];
    return chain[0];
  }
  return remote;
}
