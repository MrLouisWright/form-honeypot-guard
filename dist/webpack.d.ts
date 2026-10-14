import type { Manifest, FieldNames } from './index.js';
export interface FormGuardPluginOptions {
  /** Selector for forms to guard at build time and in the browser, or 'all'. Default 'form[data-guard]'. */
  forms?: string;
  secretEnv?: string;
  minTime?: number;
  maxAge?: number;
  requireJs?: boolean | 'soft';
  tokenEndpoint?: string;
  /** 'auto' (pages with guarded forms), 'always', or false. Default 'auto'. */
  inject?: 'auto' | 'always' | false;
  inline?: boolean;
  filename?: string;
  manifest?: string | false;
  manifestPath?: string | null;
  seed?: string | number;
  fields?: Partial<FieldNames>;
  html?: RegExp;
  warnings?: boolean;
  verbose?: boolean;
}
declare class FormGuardPlugin {
  constructor(options?: FormGuardPluginOptions);
  readonly options: Required<FormGuardPluginOptions>;
  readonly names: FieldNames;
  readonly buildId: string;
  manifest(): Manifest;
  apply(compiler: any): void;
}
export { FormGuardPlugin };
export default FormGuardPlugin;
