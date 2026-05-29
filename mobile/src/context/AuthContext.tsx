import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, UserRole } from '../types';
import { authApi } from '../api/auth';
import { registerPushToken } from '../utils/pushNotifications';

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
        const [stored, cachedUserJson, savedMode] = await AsyncStorage.multiGet([
          'auth_token', 'auth_user', 'active_mode',
        ]);
        const token = stored[1];
        if (!token) { setIsLoading(false); return; }

        setToken(token);

        // Restore cached user instantly so the app navigates without waiting for network
        const cachedUser = cachedUserJson[1] ? JSON.parse(cachedUserJson[1]) as User : null;
        if (cachedUser) {
          setUser(cachedUser);
          const mode = savedMode[1];
          setActiveModeState(mode === 'cook' || mode === 'customer' ? mode : (cachedUser.role as ActiveMode) ?? 'customer');
          setIsLoading(false);
        }

        // Background refresh — keeps user data fresh without blocking launch
        authApi.getProfile().then(({ user: fresh }) => {
          setUser(fresh);
          AsyncStorage.setItem('auth_user', JSON.stringify(fresh)).catch(() => {});
          if (!cachedUser) {
            const mode = savedMode[1];
            setActiveModeState(mode === 'cook' || mode === 'customer' ? mode : (fresh.role as ActiveMode) ?? 'customer');
            setIsLoading(false);
          }
        }).catch(() => {
          if (!cachedUser) {
            AsyncStorage.removeItem('auth_token').catch(() => {});
            setIsLoading(false);
          }
        });
      } catch {
        await AsyncStorage.multiRemove(['auth_token', 'auth_user']);
        setIsLoading(false);
      }
    })();
  }, []);

  async function setActiveMode(mode: ActiveMode) {
    await AsyncStorage.setItem('active_mode', mode);
    setActiveModeState(mode);
  }

  async function signIn(newToken: string, newUser: User) {
    const mode: ActiveMode = (newUser.role as ActiveMode) ?? 'customer';
    await AsyncStorage.multiSet([
      ['auth_token', newToken],
      ['auth_user', JSON.stringify(newUser)],
      ['active_mode', mode],
    ]);
    setToken(newToken);
    setUser(newUser);
    setActiveModeState(mode);
    registerPushToken().catch(() => {});
  }

  async function signOut() {
    await AsyncStorage.multiRemove(['auth_token', 'auth_user', 'active_mode']);
    setToken(null);
    setUser(null);
    setActiveModeState('customer');
  }

  async function refreshUser() {
    const { user } = await authApi.getProfile();
    setUser(user);
    AsyncStorage.setItem('auth_user', JSON.stringify(user)).catch(() => {});
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
