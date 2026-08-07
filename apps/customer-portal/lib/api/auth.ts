import { apiRequest } from './http-client';
import { API_URLS } from '../config';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresInSeconds: number;
  userId: string;
  sessionId: string;
}

export interface MfaChallenge {
  mfaRequired: true;
  mfaToken: string;
  availableMethods: string[];
}

export interface UserProfile {
  userId: string;
  email: string;
  emailVerified: boolean;
  phone?: string;
  phoneVerified: boolean;
  firstName: string;
  lastName: string;
  status: string;
  customerNumber?: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string;
  countryId: string;
  phone?: string;
}

const AUTH = API_URLS.auth;

export function register(input: RegisterInput) {
  return apiRequest<{ message: string }>(AUTH, '/v1/auth/register', { method: 'POST', body: input });
}

export function verifyEmail(token: string) {
  return apiRequest<{ message: string }>(AUTH, '/v1/auth/verify-email', { method: 'POST', body: { token } });
}

export function resendVerification(email: string) {
  return apiRequest<{ message: string }>(AUTH, '/v1/auth/resend-email-verification', { method: 'POST', body: { email } });
}

export function login(email: string, password: string) {
  return apiRequest<AuthTokens | MfaChallenge>(AUTH, '/v1/auth/login', { method: 'POST', body: { email, password }, withCredentials: true });
}

export function verifyMfa(mfaToken: string, method: string, code: string) {
  return apiRequest<AuthTokens>(AUTH, '/v1/auth/mfa/verify', { method: 'POST', body: { mfaToken, method, code }, withCredentials: true });
}

export function refreshSession() {
  return apiRequest<AuthTokens>(AUTH, '/v1/auth/refresh', { method: 'POST', body: {}, withCredentials: true });
}

export function logout(accessToken: string) {
  return apiRequest<{ message: string }>(AUTH, '/v1/auth/logout', { method: 'POST', accessToken, withCredentials: true });
}

export function forgotPassword(email: string) {
  return apiRequest<{ message: string }>(AUTH, '/v1/auth/forgot-password', { method: 'POST', body: { email } });
}

export function resetPassword(token: string, newPassword: string) {
  return apiRequest<{ message: string }>(AUTH, '/v1/auth/reset-password', { method: 'POST', body: { token, newPassword } });
}

export function changePassword(accessToken: string, currentPassword: string, newPassword: string) {
  return apiRequest<{ message: string }>(AUTH, '/v1/auth/change-password', {
    method: 'POST',
    accessToken,
    body: { currentPassword, newPassword },
  });
}

export function getMe(accessToken: string) {
  return apiRequest<UserProfile>(AUTH, '/v1/auth/me', { accessToken });
}

export interface SessionSummary {
  id: string;
  ipAddress: string;
  userAgent?: string;
  deviceName?: string;
  issuedAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export function listSessions(accessToken: string) {
  return apiRequest<SessionSummary[]>(AUTH, '/v1/sessions', { accessToken });
}

export function revokeSession(accessToken: string, sessionId: string) {
  return apiRequest<{ message: string }>(AUTH, `/v1/sessions/${sessionId}`, { method: 'DELETE', accessToken });
}

export function revokeAllOtherSessions(accessToken: string) {
  return apiRequest<{ message: string }>(AUTH, '/v1/sessions', { method: 'DELETE', accessToken });
}

export interface DeviceSummary {
  id: string;
  deviceName?: string;
  platform?: string;
  trustLevel: string;
  lastSeenAt: string;
  trustedAt?: string;
  lastIpAddress?: string;
  riskScore?: number;
  revokedAt?: string;
  revokedReason?: string;
}

export function listDevices(accessToken: string) {
  return apiRequest<DeviceSummary[]>(AUTH, '/v1/devices', { accessToken });
}

export function revokeDevice(accessToken: string, deviceId: string, reason?: string) {
  return apiRequest<{ message: string }>(AUTH, `/v1/devices/${deviceId}/revoke`, { method: 'POST', accessToken, body: { reason } });
}

export function removeDevice(accessToken: string, deviceId: string) {
  return apiRequest<{ message: string }>(AUTH, `/v1/devices/${deviceId}`, { method: 'DELETE', accessToken });
}
