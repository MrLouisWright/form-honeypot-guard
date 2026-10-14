import { createElement, forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { init, guardRef, json, formData } from './client.js';

/**
 * Initialise the client runtime once (call near your app root or inside GuardedForm).
 * @param {import('./client.d.ts').ClientOptions} [options]
 */
export function useFormGuardInit(options) {
  useEffect(() => {
    init(options);
  }, [options]);
}

/**
 * React wrapper around `<form data-guard>` — enhances on mount and exposes `json()` / `formData()`.
 * @type {import('react').ForwardRefExoticComponent<
 *   import('react').FormHTMLAttributes<HTMLFormElement> & {
 *     guardOptions?: import('./client.d.ts').ClientOptions;
 *   } & import('react').RefAttributes<{ json(): Promise<Record<string, string>>; formData(): Promise<FormData> }>
 * >}
 */
export const GuardedForm = forwardRef(function GuardedForm({ guardOptions, children, ...props }, ref) {
  const formRef = useRef(null);
  useFormGuardInit(guardOptions);
  useImperativeHandle(ref, () => ({
    json: () => json(formRef.current),
    formData: () => formData(formRef.current),
    get form() { return formRef.current; },
  }));
  return createElement(
    'form',
    {
      ...props,
      'data-guard': props['data-guard'] ?? '',
      ref: (el) => {
        formRef.current = el;
        guardRef(el);
      },
    },
    children,
  );
});

export { init, guardRef, json, formData };
