'use client';

import { createContext, useContext, useCallback, useState, useEffect, type ReactNode } from 'react';
import { apiFetch, setAccessToken, setRefreshToken, getAccessToken } from './api';

type User = {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'OPERATOR' | 'VIEWER';
  isActive: boolean;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Try to restore session on mount
  useEffect(() => {
    const rt = document.cookie.match(/(?:^|; )refreshToken=([^;]*)/);
    if (rt) {
      apiFetch<{ user: User; accessToken: string; refreshToken: string }>('/auth/refresh', {
        method: 'POST',
        body: { refreshToken: decodeURIComponent(rt[1]) },
      })
        .then((data) => {
          setAccessToken(data.accessToken);
          setRefreshToken(data.refreshToken);
          setUser(data.user);
        })
        .catch(() => {
          setRefreshToken(null);
          setAccessToken(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetch<{ user: User; accessToken: string; refreshToken: string }>(
      '/auth/login',
      { method: 'POST', body: { email, password } },
    );
    setAccessToken(data.accessToken);
    setRefreshToken(data.refreshToken);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    const rt = document.cookie.match(/(?:^|; )refreshToken=([^;]*)/);
    if (rt) {
      apiFetch('/auth/logout', {
        method: 'POST',
        body: { refreshToken: decodeURIComponent(rt[1]) },
      }).catch(() => { /* ignore */ });
    }
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
