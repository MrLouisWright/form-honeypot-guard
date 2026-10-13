// Types for the virtual module emitted by the plugins. Reference with: /// <reference types="form-honeypot-guard/config" />
declare module 'form-guard/config' {
  import type { Manifest, FieldNames } from './index.js';
  export const manifest: Manifest;
  export const fields: FieldNames;
  export default manifest;
}
