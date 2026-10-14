export const DEFAULT_FIELDS = Object.freeze({ honeypot: 'website_url', token: 'fg_token', js: 'fg_js', signals: 'fg_sig', pow: 'fg_pow' });
export const DEFAULTS = Object.freeze({
  secretEnv: 'FORM_GUARD_SECRET',
  minTime: 3000,
  maxAge: 2 * 60 * 60 * 1000,
  requireToken: true,
  requireJs: true,
  minInteractions: 1,
  threshold: 5,
  content: {},
  tokenEndpoint: '/__form-guard/token',
});
