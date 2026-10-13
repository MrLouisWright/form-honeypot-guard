// ESM entry for bundlers: import { init } from 'form-honeypot-guard/client'
import './runtime.js';

const g = () => globalThis.FormGuard;
const noDom = () => { throw new Error('form-honeypot-guard/client needs a browser DOM'); };

/** Start auto-enhancing forms. Safe to call more than once. */
export const init = (opts) => (g() ? g().init(opts) : undefined);
/** Enhance a single form element. Resolves when its token is in place. */
export const enhance = (form) => (g() || { enhance: noDom }).enhance(form);
/** Guard fields + the form's own fields as FormData (for fetch/XHR). */
export const formData = (form) => (g() || { formData: noDom }).formData(form);
/** Same as formData() but as a plain object (for JSON bodies). */
export const json = (form) => (g() || { json: noDom }).json(form);
/** React/Vue friendly callback ref: <form ref={guardRef}> or v-bind:ref. */
export const guardRef = (el) => { if (el && g()) g().enhance(el); };
export default { init, enhance, formData, json, guardRef };
