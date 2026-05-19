'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authApi, AdminUser } from '../api';

interface AuthState {
  user: AdminUser | null;
  token: string | null;
  loading: boolean;
  setAuth: (token: string, user: AdminUser) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('admin_token');
    if (!stored) { setLoading(false); return; }
    setToken(stored);
    authApi.me()
      .then(({ user }) => {
        if (user.role !== 'admin') { localStorage.removeItem('admin_token'); }
        else { setUser(user); }
      })
      .catch(() => localStorage.removeItem('admin_token'))
      .finally(() => setLoading(false));
  }, []);

  const setAuth = (tok: string, u: AdminUser) => {
    localStorage.setItem('admin_token', tok);
    setToken(tok);
    setUser(u);
  };

  const signOut = () => {
    localStorage.removeItem('admin_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, setAuth, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
