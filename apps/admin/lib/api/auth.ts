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

const AUTH = API_URLS.auth;

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

export function getMe(accessToken: string) {
  return apiRequest<UserProfile>(AUTH, '/v1/auth/me', { accessToken });
}

export function getMyPermissions(accessToken: string) {
  return apiRequest<{ permissions: string[] }>(AUTH, '/v1/authorization/me/permissions', { accessToken });
}
