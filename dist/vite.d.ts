import type { FormGuardPluginOptions } from './webpack.js';
import type { Manifest } from './index.js';
export type ViteFormGuardOptions = Omit<FormGuardPluginOptions, 'inline' | 'filename' | 'manifestPath' | 'html' | 'verbose'>;
export function formGuard(options?: ViteFormGuardOptions): { name: string; api: { manifest: Manifest }; [hook: string]: any };
export default formGuard;
