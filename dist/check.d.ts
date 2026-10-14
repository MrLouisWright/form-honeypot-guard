export interface Finding { id: string; severity: 'error' | 'warn'; title: string; message: string; fix?: string }
export const RULES: Record<string, string>;
export function checkHtml(html: string): { forms: number; findings: Finding[] };
export function checkDir(dir: string): { file: string; forms: number; findings: Finding[] }[];
