'use client';

import * as React from 'react';
import * as authApi from '../api/auth';
import { ApiClientError } from '../api/http-client';

interface AuthContextValue {
  accessToken: string | null;
  user: authApi.UserProfile | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<authApi.AuthTokens | authApi.MfaChallenge>;
  completeMfaLogin: (mfaToken: string, method: string, code: string) => Promise<authApi.AuthTokens>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

/**
 * Access tokens live in memory only (React state), never `localStorage` —
 * the httpOnly refresh-token cookie `auth-service` sets on login is what
 * survives a page reload; on mount this silently calls `/v1/auth/refresh`
 * to turn that cookie back into a fresh access token, exactly like a
 * browser client is meant to (see `docs/session-management.md`).
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessToken] = React.useState<string | null>(null);
  const [user, setUser] = React.useState<authApi.UserProfile | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const loadUser = React.useCallback(async (token: string) => {
    const profile = await authApi.getMe(token);
    setUser(profile);
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
        // No valid refresh cookie — the visitor simply isn't signed in yet.
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadUser]);

  const login = React.useCallback(async (email: string, password: string) => {
    const result = await authApi.login(email, password);
    if ('accessToken' in result) {
      setAccessToken(result.accessToken);
      await loadUser(result.accessToken);
    }
    return result;
  }, [loadUser]);

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
        // Already-invalid token — clearing local state below is what actually matters.
      }
    }
    setAccessToken(null);
    setUser(null);
  }, [accessToken]);

  const refreshUser = React.useCallback(async () => {
    if (accessToken) {
      await loadUser(accessToken);
    }
  }, [accessToken, loadUser]);

  return (
    <AuthContext.Provider value={{ accessToken, user, isLoading, login, completeMfaLogin, logout, refreshUser }}>
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
