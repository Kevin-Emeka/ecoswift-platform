import { z } from 'zod';

/**
 * An optional URL field that treats an *empty string* the same as an
 * *absent* variable. Plain `z.string().url().optional()` only tolerates
 * `undefined` — but `.env`/`.env.example` document unset optional vars as
 * `KEY=` (empty string, not a missing line), which `process.env` then
 * reports as `""`, and `.url()` correctly rejects `""` as not a URL. Every
 * optional URL in this schema needs this, not just `.optional()`.
 */
const optionalUrl = () =>
  z.preprocess((value) => (value === '' ? undefined : value), z.string().url().optional());

/**
 * Canonical environment variable schema. Every app/service validates its
 * process.env against (a subset of) this schema on bootstrap and fails fast
 * on misconfiguration rather than surfacing errors at request time.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().min(1),

  // Redis: single-node by default (REDIS_URL). Set REDIS_CLUSTER_ENABLED=true
  // and REDIS_CLUSTER_NODES for production Cluster mode — see
  // packages/cache and docs/infrastructure.md § Redis Cluster.
  REDIS_URL: z.string().min(1),
  REDIS_CLUSTER_ENABLED: z.coerce.boolean().default(false),
  REDIS_CLUSTER_NODES: z.string().optional(),
  REDIS_TLS_ENABLED: z.coerce.boolean().default(false),

  // Object storage (S3-compatible — AWS S3, MinIO, DigitalOcean Spaces, etc.)
  STORAGE_DRIVER: z.enum(['s3', 'local']).default('local'),
  STORAGE_S3_ENDPOINT: optionalUrl(),
  STORAGE_S3_REGION: z.string().default('us-east-1'),
  STORAGE_S3_BUCKET: z.string().optional(),
  STORAGE_S3_ACCESS_KEY: z.string().optional(),
  STORAGE_S3_SECRET_KEY: z.string().optional(),
  STORAGE_S3_FORCE_PATH_STYLE: z.coerce.boolean().default(false),
  STORAGE_LOCAL_PATH: z.string().default('./.storage'),

  // Secrets manager driver — env is the local-dev default; aws is the
  // production-shaped adapter (security-model.md § Secrets Management).
  SECRETS_DRIVER: z.enum(['env', 'aws']).default('env'),
  SECRETS_AWS_REGION: z.string().optional(),

  // Distributed tracing (OpenTelemetry, OTLP exporter — vendor-neutral,
  // works with Jaeger/Tempo/Grafana/etc.)
  OTEL_ENABLED: z.coerce.boolean().default(false),
  OTEL_EXPORTER_OTLP_ENDPOINT: optionalUrl(),
  OTEL_SERVICE_NAME: z.string().optional(),

  // Metrics
  METRICS_ENABLED: z.coerce.boolean().default(true),

  JWT_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),

  // 'console' (default) logs a clearly-labeled [SANDBOX] line instead of
  // sending anything — safe by default for this dev/demo deployment.
  // 'smtp'/'twilio' require the corresponding credentials below.
  // 'resend' talks to Resend's HTTPS API directly rather than SMTP — many
  // hosts block outbound SMTP ports (587/465/25) by default, which makes
  // 'smtp' silently time out on every send with no way to fix it from
  // config alone. Prefer 'resend' when the underlying provider is Resend.
  EMAIL_DRIVER: z.enum(['console', 'smtp', 'resend']).default('console'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  SMS_DRIVER: z.enum(['console', 'twilio']).default('console'),

  AWS_ACCESS_KEY: z.string().optional(),
  AWS_SECRET_KEY: z.string().optional(),
  AWS_REGION: z.string().optional(),
  AWS_BUCKET: z.string().optional(),

  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),

  // Public-facing surfaces this environment's links (emails, docs links,
  // CORS allow-lists) should point at. Defaults are local dev; staging/prod
  // override via real env vars — see .env.example.
  API_BASE_URL: z.string().url().default('http://localhost:3001'),
  ADMIN_PORTAL_URL: z.string().url().default('http://localhost:3100'),
  CUSTOMER_PORTAL_URL: z.string().url().default('http://localhost:3200'),
  DEVELOPER_PORTAL_URL: optionalUrl(),
  STATUS_PAGE_URL: optionalUrl(),
  DOCS_URL: optionalUrl(),

  // --- Phase 3C: Enterprise Security -------------------------------------

  // CORS allow-list — comma-separated origins. Empty/unset means "no
  // cross-origin browser callers allowed" (see @ecoswift/security's
  // buildCorsOptions default-deny fallback), never "allow anything";
  // `origin: true` (reflect-any-origin) is a Phase 3A-era placeholder this
  // phase replaces.
  CORS_ALLOWED_ORIGINS: z.string().optional(),

  // Envelope encryption key for @ecoswift/security's EncryptionService —
  // AES-256-GCM, so exactly 32 bytes once decoded. ENCRYPTION_KEY_PREVIOUS
  // is optional and only used to *decrypt* data written under the
  // previous key during a rotation's grace period — see docs/security.md
  // § Key Rotation Strategy.
  ENCRYPTION_KEY: z.string().min(1).optional(),
  ENCRYPTION_KEY_PREVIOUS: z.string().optional(),

  // CAPTCHA integration abstraction — 'noop' (always passes, the dev/test
  // default) or 'recaptcha' (real Google reCAPTCHA v3 verification).
  CAPTCHA_DRIVER: z.enum(['noop', 'recaptcha']).default('noop'),
  CAPTCHA_SECRET_KEY: z.string().optional(),
  CAPTCHA_MIN_SCORE: z.coerce.number().min(0).max(1).default(0.5),

  // Request body size ceiling — express's bodyParser default (100kb) is
  // already conservative, but the Phase 3C brief asks for it to be an
  // explicit, environment-aware control rather than an implicit framework
  // default nobody chose on purpose.
  REQUEST_BODY_LIMIT: z.string().default('100kb'),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(env: Record<string, unknown>): EnvConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${formatted}`);
  }
  return parsed.data;
}
