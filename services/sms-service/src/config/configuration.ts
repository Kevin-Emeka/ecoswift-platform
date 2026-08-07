/**
 * Nest ConfigModule factory — returns a plain object consumed via
 * ConfigService.get('key'). Values are re-derived from process.env, which is
 * already validated by validateEnv() (see validation.ts) before this runs.
 */
export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3008', 10),
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
  sms: {
    driver: process.env.SMS_DRIVER ?? 'console',
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER,
  },
});
