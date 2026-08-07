/** Base URLs for the domain services this app calls directly — see docs/architecture.md's note on why there's no gateway hop yet. */
export const API_URLS = {
  auth: process.env.NEXT_PUBLIC_AUTH_API_URL ?? 'http://localhost:3000',
  account: process.env.NEXT_PUBLIC_ACCOUNT_API_URL ?? 'http://localhost:3003',
  notification: process.env.NEXT_PUBLIC_NOTIFICATION_API_URL ?? 'http://localhost:3004',
  receipt: process.env.NEXT_PUBLIC_RECEIPT_API_URL ?? 'http://localhost:3005',
} as const;
