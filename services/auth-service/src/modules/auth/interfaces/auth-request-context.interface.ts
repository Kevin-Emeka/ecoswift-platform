/** The request-origin facts every auth flow needs for device recognition, session records, and audit logging. */
export interface AuthRequestContext {
  ipAddress: string;
  userAgent?: string;
}
