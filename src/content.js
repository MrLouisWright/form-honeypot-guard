export const DEFAULT_KEYWORDS = ['viagra', 'cialis', 'casino', 'crypto investment', 'bitcoin profit', 'seo services', 'backlinks', 'payday loan', 'forex signals', 'escort', 'replica watches', 'rank your website', 'guest post'];
export const NAME_FIELDS = ['name', 'first_name', 'firstname', 'last_name', 'lastname', 'full_name', 'fullname', 'fname', 'lname'];
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"']+|\[url=|<a\s+href/gi;

/**
 * Content heuristics. Returns [{ reason, weight }].
 * opts: { maxLinks = 2, nameFields, keywords, scripts: ['Latin'] | null, scriptRatio = 0.3, ignore: [] }
 */
export function checkContent(fields, opts = {}) {
  const { maxLinks = 2, nameFields = NAME_FIELDS, keywords = DEFAULT_KEYWORDS, scripts = null, scriptRatio = 0.3, ignore = [] } = opts;
  const out = [];
  const entries = Object.entries(fields).filter(([k, v]) => typeof v === 'string' && !ignore.includes(k));
  const text = entries.map(([, v]) => v).join('\n');
  const links = (text.match(URL_RE) || []).length;
  if (links > maxLinks) out.push({ reason: 'content-links', weight: Math.min(4, links - maxLinks + 1) });
  if (entries.some(([k, v]) => nameFields.includes(k.toLowerCase()) && /https?:\/\/|www\.|\.(com|net|ru|xyz|top)\b/i.test(v))) out.push({ reason: 'content-url-in-name', weight: 4 });
  const lower = text.toLowerCase();
  const hits = keywords.filter((w) => lower.includes(String(w).toLowerCase())).length;
  if (hits) out.push({ reason: 'content-keywords', weight: Math.min(5, hits * 2) });
  if (scripts && scripts.length) {
    const letters = text.match(/\p{L}/gu) || [];
    if (letters.length >= 10) {
      const allowed = new RegExp(`[${scripts.map((s) => `\\p{Script=${s}}`).join('')}]`, 'u');
      const foreign = letters.filter((ch) => !allowed.test(ch)).length;
      if (foreign / letters.length > scriptRatio) out.push({ reason: 'content-charset', weight: 3 });
    }
  }
  return out;
}
