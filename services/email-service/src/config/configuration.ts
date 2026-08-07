/**
 * Nest ConfigModule factory — returns a plain object consumed via
 * ConfigService.get('key'). Values are re-derived from process.env, which is
 * already validated by validateEnv() (see validation.ts) before this runs.
 */
export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3007', 10),
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
  email: {
    driver: process.env.EMAIL_DRIVER ?? 'console',
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined,
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    from: process.env.SMTP_FROM,
  },
});
