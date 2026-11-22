import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, {
  getApiBaseUrl,
  loadSavedServer,
  saveServer,
  setAuthToken,
  setSessionHooks,
  setUnauthorizedHandler,
} from '../utils/api';

const TOKEN_KEY = '@civicfix/token';
const REFRESH_KEY = '@civicfix/refresh';
const USER_KEY = '@civicfix/user';

const GOOGLE_ERRORS = {
  cancelled: 'Google sign-in was cancelled.',
  google_failed: 'Google sign-in did not work. Please try again.',
};

// civicfix://auth?google_code=...  or  civicfix://auth?error=...
const readAuthLink = (url) => {
  if (!url || !/^civicfix:\/\/auth/.test(url)) return null;
  const param = (name) => {
    const match = url.match(new RegExp(`[?&]${name}=([^&#]+)`));
    return match ? decodeURIComponent(match[1]) : null;
  };
  return { code: param('google_code'), error: param('error') };
};

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [serverUrl, setServerUrl] = useState('');
  const [providers, setProviders] = useState({ google: false, phone: false, passwordReset: false });
  const [authNotice, setAuthNotice] = useState(null);

  const persistSession = async ({ token: nextToken, refreshToken, user: nextUser }) => {
    setToken(nextToken);
    setUser(nextUser);
    setAuthToken(nextToken);
    await AsyncStorage.multiSet([
      [TOKEN_KEY, nextToken],
      [REFRESH_KEY, refreshToken || ''],
      [USER_KEY, JSON.stringify(nextUser)],
    ]);
  };

  const clearSession = async () => {
    setToken(null);
    setUser(null);
    setAuthToken(null);
    await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_KEY, USER_KEY]);
  };

  const loadProviders = useCallback(async () => {
    try {
      const { data } = await api.get('/api/auth/providers');
      setProviders(data);
    } catch {
      setProviders({ google: false, phone: false, passwordReset: false });
    }
  }, []);

  // Back from Google: swap the one-time code for a session.
  const handleAuthLink = useCallback(async (url) => {
    const link = readAuthLink(url);
    if (!link) return;
    if (link.error) {
      setAuthNotice(GOOGLE_ERRORS[link.error] || GOOGLE_ERRORS.google_failed);
      return;
    }
    if (link.code) {
      try {
        const { data } = await api.post('/api/auth/google/exchange', { code: link.code });
        setAuthNotice(null);
        await persistSession(data);
      } catch (error) {
        setAuthNotice(error.message);
      }
    }
  }, []);

  useEffect(() => {
    // Renewed tokens from utils/api are stored here.
    setSessionHooks({
      getRefreshToken: () => AsyncStorage.getItem(REFRESH_KEY),
      onRenewed: async (data) => {
        setToken(data.token);
        if (data.user) setUser(data.user);
        await AsyncStorage.multiSet([
          [TOKEN_KEY, data.token],
          [REFRESH_KEY, data.refreshToken],
          ...(data.user ? [[USER_KEY, JSON.stringify(data.user)]] : []),
        ]);
      },
    });

    const bootstrapAsync = async () => {
      try {
        // The server address must be known before any request is made.
        const url = await loadSavedServer();
        setServerUrl(url);

        const [[, storedToken], [, storedUser]] = await AsyncStorage.multiGet([TOKEN_KEY, USER_KEY]);
        if (storedToken) {
          setToken(storedToken);
          setAuthToken(storedToken);
        }
        if (storedUser) setUser(JSON.parse(storedUser));
        if (url) loadProviders();

        // Opened by the Google sign-in link while the app was closed.
        await handleAuthLink(await Linking.getInitialURL());
      } catch (error) {
        console.warn('Failed to load auth state', error);
      } finally {
        setInitializing(false);
      }
    };

    bootstrapAsync();
    const subscription = Linking.addEventListener('url', ({ url }) => handleAuthLink(url));
    return () => subscription.remove();
  }, [handleAuthLink, loadProviders]);

  // A revoked session (signed out elsewhere, password reset) or a failed
  // renewal sends the user back to the login screen.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession().catch((error) => console.warn('Failed to clear session', error));
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = async ({ email, password }) => {
    const { data } = await api.post('/api/auth/login', { email, password });
    await persistSession(data);
    return data.user;
  };

  const register = async ({ name, email, password }) => {
    const { data } = await api.post('/api/auth/register', { name, email, password });
    await persistSession(data);
    return data.user;
  };

  const requestPhoneCode = async (phone) => {
    const { data } = await api.post('/api/auth/otp/request', { phone });
    return data;
  };

  const loginWithPhone = async ({ phone, code, name }) => {
    const { data } = await api.post('/api/auth/otp/verify', { phone, code, ...(name ? { name } : {}) });
    await persistSession(data);
    return data.user;
  };

  const forgotPassword = async (email) => (await api.post('/api/auth/password/forgot', { email })).data;
  const resetPassword = async ({ email, code, newPassword }) =>
    (await api.post('/api/auth/password/reset', { email, code, newPassword })).data;

  // Opens Google in the browser; the server sends the user back to
  // civicfix://auth, which handleAuthLink picks up.
  const signInWithGoogle = async () => {
    setAuthNotice(null);
    await Linking.openURL(`${getApiBaseUrl()}/api/auth/google/start?client=app`);
  };

  const logout = async () => {
    try {
      const refreshToken = await AsyncStorage.getItem(REFRESH_KEY);
      await api.post('/api/auth/logout', { refreshToken });
    } catch {
      // Signing out on this phone still works if the server can't be reached.
    }
    await clearSession();
  };

  const logoutEverywhere = async () => {
    await api.post('/api/auth/logout-all');
    await clearSession();
  };

  const refreshUser = async () => {
    const { data } = await api.get('/api/auth/me');
    setUser(data.user);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));
    return data.user;
  };

  // Accounts belong to one server, so switching servers signs the user out.
  const changeServer = async (address) => {
    const url = await saveServer(address);
    await clearSession();
    setServerUrl(url);
    loadProviders();
    return url;
  };

  const value = useMemo(
    () => ({
      user,
      token,
      initializing,
      serverUrl,
      providers,
      authNotice,
      setAuthNotice,
      login,
      register,
      requestPhoneCode,
      loginWithPhone,
      forgotPassword,
      resetPassword,
      signInWithGoogle,
      logout,
      logoutEverywhere,
      refreshUser,
      changeServer,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, token, initializing, serverUrl, providers, authNotice]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
