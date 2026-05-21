import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, UserRole } from '../types';
import { authApi } from '../api/auth';

type ActiveMode = 'cook' | 'customer';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  activeMode: ActiveMode;
  setActiveMode: (mode: ActiveMode) => Promise<void>;
  signIn: (token: string, user: User) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeMode, setActiveModeState] = useState<ActiveMode>('customer');

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('auth_token');
        if (stored) {
          setToken(stored);
          const { user } = await authApi.getProfile();
          setUser(user);
          const savedMode = await AsyncStorage.getItem('active_mode');
          if (savedMode === 'cook' || savedMode === 'customer') {
            setActiveModeState(savedMode);
          } else {
            setActiveModeState((user.role as ActiveMode) ?? 'customer');
          }
        }
      } catch {
        await AsyncStorage.removeItem('auth_token');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  async function setActiveMode(mode: ActiveMode) {
    await AsyncStorage.setItem('active_mode', mode);
    setActiveModeState(mode);
  }

  async function signIn(newToken: string, newUser: User) {
    await AsyncStorage.setItem('auth_token', newToken);
    setToken(newToken);
    setUser(newUser);
    // default mode to the user's primary role on sign-in
    const mode: ActiveMode = (newUser.role as ActiveMode) ?? 'customer';
    await AsyncStorage.setItem('active_mode', mode);
    setActiveModeState(mode);
  }

  async function signOut() {
    await AsyncStorage.multiRemove(['auth_token', 'active_mode']);
    setToken(null);
    setUser(null);
    setActiveModeState('customer');
  }

  async function refreshUser() {
    const { user } = await authApi.getProfile();
    setUser(user);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        activeMode,
        setActiveMode,
        signIn,
        signOut,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
