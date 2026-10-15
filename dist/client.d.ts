export interface ClientOptions {
  /** CSS selector or 'all'. Default 'form[data-guard]'. */
  forms?: string;
  honeypot?: string; token?: string; js?: string; signals?: string; pow?: string;
  powEnabled?: boolean;
  tokenEndpoint?: string;
  fetchToken?: boolean;
  jsProof?: boolean;
  observe?: boolean;
  /**
   * When true, append a small "Built with form-honeypot-guard" credit link.
   * Off by default. Class `fg-credit` (no inline styles). No network or tracking.
   */
  credit?: boolean;
  /** Element or CSS selector to append the credit link into. Default: after the first guarded form. */
  creditTarget?: HTMLElement | string | null;
}
export interface FormGuardApi {
  init(opts?: ClientOptions): FormGuardApi;
  enhance(form: HTMLFormElement): Promise<HTMLFormElement>;
  scan(root?: ParentNode): void;
  formData(form: HTMLFormElement): Promise<FormData>;
  json(form: HTMLFormElement): Promise<Record<string, string>>;
  config: Required<ClientOptions>;
}
export function init(opts?: ClientOptions): FormGuardApi | undefined;
export function enhance(form: HTMLFormElement): Promise<HTMLFormElement>;
export function formData(form: HTMLFormElement): Promise<FormData>;
export function json(form: HTMLFormElement): Promise<Record<string, string>>;
export function guardRef(el: HTMLFormElement | null): void;
declare const _default: { init: typeof init; enhance: typeof enhance; formData: typeof formData; json: typeof json; guardRef: typeof guardRef };
export default _default;
declare global { interface Window { FormGuard?: FormGuardApi } }
