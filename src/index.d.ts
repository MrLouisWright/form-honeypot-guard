import type { IncomingMessage, ServerResponse } from 'node:http';

export interface FieldNames { honeypot: string; token: string; js: string; signals: string }
export interface Manifest { name?: string; version?: number; buildId?: string; forms?: string; fields: FieldNames; minTime?: number; maxAge?: number; requireJs?: boolean | 'soft'; secretEnv?: string; tokenEndpoint?: string }

export interface ContentOptions { maxLinks?: number; nameFields?: string[]; keywords?: string[]; scripts?: string[] | null; scriptRatio?: number; ignore?: string[] }

export interface NonceStore { use(nonce: string, ttlMs: number): Promise<boolean> | boolean }
export interface RateLimitStore { hit(key: string, windowMs: number, limit: number, now?: number): Promise<{ count: number; retryAfterMs: number }> }

export interface VerifyOptions {
  secret?: string;
  /** Env var holding the secret. Default FORM_GUARD_SECRET. */
  secretEnv?: string;
  /** Path to (or object of) the manifest emitted by the webpack/Vite plugin. */
  manifest?: string | Manifest;
  fields?: Partial<FieldNames>;
  /** Minimum ms between token issue and submit. Default 3000. */
  minTime?: number;
  /** Maximum token age in ms. Default 2h. */
  maxAge?: number;
  requireToken?: boolean;
  /** true: JS proof required; 'soft': adds score only; false: not checked. */
  requireJs?: boolean | 'soft';
  minInteractions?: number;
  /** Score at or above which a submission fails. Default 5. */
  threshold?: number;
  content?: ContentOptions | false;
  nonceStore?: NonceStore;
  tokenEndpoint?: string;
  now?: number;
}
export type Reason = 'honeypot' | 'token-missing' | 'token-invalid' | 'token-expired' | 'token-replayed' | 'too-fast' | 'js-missing' | 'signals-missing' | 'no-interaction' | 'content-links' | 'content-url-in-name' | 'content-keywords' | 'content-charset' | 'rate-limited';
export interface VerifyResult { ok: boolean; reasons: Reason[]; score: number; retryAfter?: number; rateLimited?: boolean }
type FieldsInput = Record<string, unknown> | FormData | URLSearchParams | Map<string, unknown>;

export const DEFAULT_FIELDS: Readonly<FieldNames>;
export const DEFAULTS: Readonly<Required<Pick<VerifyOptions, 'secretEnv' | 'minTime' | 'maxAge' | 'requireToken' | 'requireJs' | 'minInteractions' | 'threshold' | 'tokenEndpoint'>>>;
export const HARD_REASONS: Set<Reason>;
export function verify(fields: FieldsInput, opts?: VerifyOptions): Promise<VerifyResult>;
export function createToken(opts?: Pick<VerifyOptions, 'secret' | 'secretEnv'>, now?: number): string;
export function parseToken(token: string, opts?: Pick<VerifyOptions, 'secret' | 'secretEnv'>): { valid: boolean; issuedAt?: number; nonce?: string };
export function jsProof(token: string): string;
export function issueFields(opts?: VerifyOptions): { fields: Record<string, string>; token: string; html: string };
export function cleanFields(fields: FieldsInput, opts?: VerifyOptions): Record<string, string>;
export function toFields(fields: FieldsInput): Record<string, string>;
export function loadManifest(fileOrObject: string | Manifest): Manifest;
export function resolveOptions(opts?: VerifyOptions): VerifyOptions & { fields: FieldNames; nonceStore: NonceStore };
export function getSecret(opts?: Pick<VerifyOptions, 'secret' | 'secretEnv'>): string;
export function generateSecret(bytes?: number): string;
export function checkContent(fields: Record<string, string>, opts?: ContentOptions): { reason: Reason; weight: number }[];

export interface RateLimiter { limit: number; windowMs: number; store: RateLimitStore; check(key: string, now?: number): Promise<{ ok: boolean; count: number; remaining: number; retryAfter: number }> }
export function createRateLimiter(opts?: { limit?: number; windowMs?: number; store?: RateLimitStore }): RateLimiter;
export class MemoryNonceStore implements NonceStore { constructor(opts?: { max?: number }); use(nonce: string, ttlMs: number): Promise<boolean>; readonly size: number }
export class MemoryRateLimitStore implements RateLimitStore { constructor(opts?: { maxKeys?: number }); hit(key: string, windowMs: number, limit: number, now?: number): Promise<{ count: number; retryAfterMs: number }>; reset(key: string): Promise<void> }

export type TrustProxy = boolean | number | string[];
export function clientIp(src: { headers?: Record<string, any> | Headers; remoteAddress?: string }, opts?: { trustProxy?: TrustProxy; ipHeader?: string }): string;

export interface GuardOptions extends VerifyOptions {
  rateLimit?: false | { limit?: number; windowMs?: number; store?: RateLimitStore; keys?: Array<'ip' | 'email' | 'fingerprint'> | ((ctx: { fields: Record<string, string>; ip: string; headers: any }) => string[]) };
  silent?: boolean;
  silentResponse?: { status?: number; headers?: Record<string, string>; body?: string } | ((ctx: any) => { status?: number; headers?: Record<string, string>; body?: string });
  trustProxy?: TrustProxy;
  ipHeader?: string;
  emailField?: string;
  /** HTTP methods to guard. Default ['POST']. */
  methods?: string[];
  /** Paths to guard (exact, prefix with trailing *, or RegExp). Default: all. */
  paths?: Array<string | RegExp>;
  getIp?: (request: Request, ctx?: any) => string | Promise<string>;
  onBlock?: (result: VerifyResult, ctx: any) => void | Promise<void>;
}
interface HttpReply { status: number; headers: Record<string, string>; body: string }
export function createGuard(opts?: GuardOptions): { options: GuardOptions; check(input: { fields: FieldsInput; ip: string; headers?: any }): Promise<VerifyResult>; blockResponse(r: VerifyResult, ctx?: any): HttpReply; tokenResponse(): HttpReply; rateLimiter: RateLimiter | null };

type Next = (err?: any) => void;
export function expressGuard(opts?: GuardOptions): (req: IncomingMessage & { body?: any; formGuard?: VerifyResult }, res: ServerResponse, next: Next) => Promise<void>;
export const connectGuard: typeof expressGuard;
export function fastifyGuard(fastify: any, opts: GuardOptions, done: (err?: Error) => void): void;
export interface FetchGuardResult { ok: boolean; skipped?: boolean; result?: VerifyResult; fields?: Record<string, string>; response?: Response }
export function createFetchGuard(opts?: GuardOptions): (request: Request, ctx?: any) => Promise<FetchGuardResult>;
export function withFormGuard<C = any>(handler: (request: Request, ctx: C, guard: FetchGuardResult) => Response | Promise<Response>, opts?: GuardOptions): (request: Request, ctx: C) => Promise<Response>;
export function nextRoute<C = any>(handler: (request: Request, ctx: C, guard: FetchGuardResult) => Response | Promise<Response>, opts?: GuardOptions): { GET: (request: Request, ctx: C) => Promise<Response>; POST: (request: Request, ctx: C) => Promise<Response> };
export function withFormGuardApi(handler: (req: any, res: any) => any, opts?: GuardOptions): (req: any, res: any) => Promise<void>;
