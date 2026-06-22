import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
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
  refreshUser: () => Promise<boolean>;
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
        // auth_token lives in SecureStore; non-sensitive prefs stay in AsyncStorage
        const [storedToken, cachedUserJson, savedMode] = await Promise.all([
          SecureStore.getItemAsync('auth_token'),
          AsyncStorage.getItem('auth_user'),
          AsyncStorage.getItem('active_mode'),
        ]);

        if (!storedToken) { setIsLoading(false); return; }

        setToken(storedToken);

        // Restore cached user instantly so the app navigates without waiting for network
        const cachedUser = cachedUserJson ? JSON.parse(cachedUserJson) as User : null;
        if (cachedUser) {
          setUser(cachedUser);
          const mode = savedMode;
          setActiveModeState(mode === 'cook' || mode === 'customer' ? mode : (cachedUser.role as ActiveMode) ?? 'customer');
          setIsLoading(false);
        }

        // Background refresh — keeps user data fresh without blocking launch
        authApi.getProfile().then(({ user: fresh }) => {
          setUser(fresh);
          AsyncStorage.setItem('auth_user', JSON.stringify(fresh)).catch(() => {});
          if (!cachedUser) {
            const mode = savedMode;
            setActiveModeState(mode === 'cook' || mode === 'customer' ? mode : (fresh.role as ActiveMode) ?? 'customer');
            setIsLoading(false);
          }
        }).catch(() => {
          // Token is invalid/expired — clear everything
          SecureStore.deleteItemAsync('auth_token').catch(() => {});
          AsyncStorage.removeItem('auth_user').catch(() => {});
          setToken(null);
          setUser(null);
          if (!cachedUser) setIsLoading(false);
          else setIsLoading(false);
        });
      } catch {
        await Promise.all([
          SecureStore.deleteItemAsync('auth_token').catch(() => {}),
          AsyncStorage.removeItem('auth_user').catch(() => {}),
        ]);
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
    await Promise.all([
      SecureStore.setItemAsync('auth_token', newToken),
      AsyncStorage.multiSet([
        ['auth_user', JSON.stringify(newUser)],
        ['active_mode', mode],
      ]),
    ]);
    setToken(newToken);
    setUser(newUser);
    setActiveModeState(mode);
    registerPushToken().catch(() => {});
  }

  async function signOut() {
    await Promise.all([
      SecureStore.deleteItemAsync('auth_token').catch(() => {}),
      AsyncStorage.multiRemove(['auth_user', 'active_mode']),
    ]);
    setToken(null);
    setUser(null);
    setActiveModeState('customer');
  }

  async function refreshUser(): Promise<boolean> {
    try {
      const { user } = await authApi.getProfile();
      setUser(user);
      AsyncStorage.setItem('auth_user', JSON.stringify(user)).catch(() => {});
      return true;
    } catch {
      return false;
    }
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
