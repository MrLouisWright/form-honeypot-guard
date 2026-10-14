import type { FormHTMLAttributes, RefAttributes, ForwardRefExoticComponent } from 'react';
import type { ClientOptions } from './client.d.ts';

export function useFormGuardInit(options?: ClientOptions): void;

export interface GuardedFormHandle {
  json(): Promise<Record<string, string>>;
  formData(): Promise<FormData>;
  readonly form: HTMLFormElement | null;
}

export const GuardedForm: ForwardRefExoticComponent<
  FormHTMLAttributes<HTMLFormElement> & { guardOptions?: ClientOptions } & RefAttributes<GuardedFormHandle>
>;

export { init, guardRef, json, formData } from './client.d.ts';
