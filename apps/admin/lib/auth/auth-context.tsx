'use client';

import * as React from 'react';
import * as authApi from '../api/auth';
import { ApiClientError } from '../api/http-client';

interface AuthContextValue {
  accessToken: string | null;
  user: authApi.UserProfile | null;
  permissions: string[];
  isLoading: boolean;
  login: (email: string, password: string) => Promise<authApi.AuthTokens | authApi.MfaChallenge>;
  completeMfaLogin: (mfaToken: string, method: string, code: string) => Promise<authApi.AuthTokens>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

/**
 * Same pattern as `apps/customer-portal`'s `AuthProvider` — access tokens
 * live in memory only, restored on load via the httpOnly refresh cookie.
 * Additionally loads the caller's effective permission set
 * (`GET /v1/authorization/me/permissions`) so the admin UI can hide/show
 * screens the signed-in staff member doesn't hold the permission for,
 * without duplicating the server's own authorization decision — the
 * backend still enforces every permission on every request regardless of
 * what the UI shows.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessToken] = React.useState<string | null>(null);
  const [user, setUser] = React.useState<authApi.UserProfile | null>(null);
  const [permissions, setPermissions] = React.useState<string[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const loadUser = React.useCallback(async (token: string) => {
    const [profile, perms] = await Promise.all([authApi.getMe(token), authApi.getMyPermissions(token)]);
    setUser(profile);
    setPermissions(perms.permissions);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tokens = await authApi.refreshSession();
        if (cancelled) return;
        setAccessToken(tokens.accessToken);
        await loadUser(tokens.accessToken);
      } catch {
        // No valid refresh cookie — not signed in yet.
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadUser]);

  const login = React.useCallback(
    async (email: string, password: string) => {
      const result = await authApi.login(email, password);
      if ('accessToken' in result) {
        setAccessToken(result.accessToken);
        await loadUser(result.accessToken);
      }
      return result;
    },
    [loadUser],
  );

  const completeMfaLogin = React.useCallback(
    async (mfaToken: string, method: string, code: string) => {
      const tokens = await authApi.verifyMfa(mfaToken, method, code);
      setAccessToken(tokens.accessToken);
      await loadUser(tokens.accessToken);
      return tokens;
    },
    [loadUser],
  );

  const logout = React.useCallback(async () => {
    if (accessToken) {
      try {
        await authApi.logout(accessToken);
      } catch {
        // Already-invalid token — clearing local state below is what matters.
      }
    }
    setAccessToken(null);
    setUser(null);
    setPermissions([]);
  }, [accessToken]);

  const hasPermission = React.useCallback((permission: string) => permissions.includes(permission), [permissions]);

  return (
    <AuthContext.Provider value={{ accessToken, user, permissions, isLoading, login, completeMfaLogin, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth() must be used within an <AuthProvider>');
  }
  return ctx;
}

export { ApiClientError };
