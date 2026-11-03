import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { User, UserRole } from '../types';
import { authApi } from '../api/auth';
import { refreshSession, setSessionExpiredListener } from '../api/client';
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
  /** True once the server has rejected the session, until acknowledged. */
  sessionExpired: boolean;
  acknowledgeSessionExpired: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeMode, setActiveModeState] = useState<ActiveMode>('customer');
  const [sessionExpired, setSessionExpired] = useState(false);

  // Drop the stored session. `expired` marks it as the server ending it (not the
  // user signing out), which SessionExpiryGuard turns into a trip to sign-in.
  function endSession(expired: boolean) {
    SecureStore.deleteItemAsync('auth_token').catch(() => {});
    AsyncStorage.removeItem('auth_user').catch(() => {});
    setToken(null);
    setUser(null);
    if (expired) setSessionExpired(true);
  }

  useEffect(() => {
    setSessionExpiredListener(async (rejected) => {
      // A slow request can come back 401 after the user signed out or signed in
      // again; only end the session the server actually rejected.
      const current = await SecureStore.getItemAsync('auth_token').catch(() => null);
      if (current && current === rejected) endSession(true);
    });
    return () => setSessionExpiredListener(null);
  }, []);

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

        // Background refresh — keeps user data fresh without blocking launch.
        // Renew the token first: the server only renews tokens under 14 days old
        // and they die at 30, so renewing on every launch is what keeps a user
        // who opens the app at least fortnightly signed in. A failed renewal is
        // harmless here; the old token is still used until it expires.
        refreshSession()
          .then((fresh) => { if (fresh) setToken(fresh); })
          .finally(() => authApi.getProfile().then(({ user: fresh }) => {
            setUser(fresh);
            AsyncStorage.setItem('auth_user', JSON.stringify(fresh)).catch(() => {});
            if (!cachedUser) {
              const mode = savedMode;
              setActiveModeState(mode === 'cook' || mode === 'customer' ? mode : (fresh.role as ActiveMode) ?? 'customer');
              setIsLoading(false);
            }
          }).catch((e: any) => {
            // Only the server saying no ends the session. Offline, a timeout or a
            // cold-starting server used to sign the user out too; now they keep
            // the cached profile and the next launch tries again.
            if (e?.status === 401 || e?.status === 403) endSession(e?.status === 401);
            setIsLoading(false);
          }));
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
        sessionExpired,
        acknowledgeSessionExpired: () => setSessionExpired(false),
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
