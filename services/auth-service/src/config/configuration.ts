/**
 * Nest ConfigModule factory — returns a plain object consumed via
 * ConfigService.get('key'). Values are re-derived from process.env, which is
 * already validated by validateEnv() (see validation.ts) before this runs.
 */
export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  appUrl: process.env.APP_URL ?? 'http://localhost:3000',
  database: {
    url: process.env.DATABASE_URL,
  },
  redis: {
    url: process.env.REDIS_URL,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
  },
  encryption: {
    key: process.env.ENCRYPTION_KEY,
    previousKey: process.env.ENCRYPTION_KEY_PREVIOUS,
  },
  captcha: {
    driver: process.env.CAPTCHA_DRIVER ?? 'noop',
    secretKey: process.env.CAPTCHA_SECRET_KEY,
    minScore: parseFloat(process.env.CAPTCHA_MIN_SCORE ?? '0.5'),
  },
  cors: {
    allowedOrigins: process.env.CORS_ALLOWED_ORIGINS,
  },
  requestBodyLimit: process.env.REQUEST_BODY_LIMIT ?? '100kb',
});
