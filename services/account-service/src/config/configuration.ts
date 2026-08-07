/**
 * Nest ConfigModule factory — returns a plain object consumed via
 * ConfigService.get('key'). Values are re-derived from process.env, which is
 * already validated by validateEnv() (see validation.ts) before this runs.
 */
export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3003', 10),
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
  // Milestone 2: `TransferRiskService` decrypts `TwoFactorCredential.secretEncrypted`
  // for MFA step-up — must be the exact same key auth-service encrypted it
  // with, or decryption fails. See @ecoswift/security's EncryptionService
  // doc comment for the key-rotation story.
  encryption: {
    key: process.env.ENCRYPTION_KEY,
    previousKey: process.env.ENCRYPTION_KEY_PREVIOUS,
  },
  cors: {
    allowedOrigins: process.env.CORS_ALLOWED_ORIGINS,
  },
  customerPortalUrl: process.env.CUSTOMER_PORTAL_URL ?? 'http://localhost:3200',
});
