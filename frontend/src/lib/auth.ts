import { useUserStore } from '../stores/useUserStore';

export const authTokenStorageKey = 'x-thread-token';

export type AccountProfile = {
  id: string;
  account?: string | null;
  email?: string | null;
  nickname: string;
  avatar?: string | null;
  isGuest: boolean;
};

type TokenPayload = {
  sub?: string;
  account?: string | null;
  email?: string | null;
  nickname?: string;
  isGuest?: boolean;
  exp?: number;
};

const decodeBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return window.atob(padded);
};

export const getStoredAuthToken = () => localStorage.getItem(authTokenStorageKey)?.trim() || '';

export const setStoredAuthToken = (token: string) => {
  localStorage.setItem(authTokenStorageKey, token);
};

export const parseAuthToken = (token?: string | null): TokenPayload | null => {
  if (!token) {
    return null;
  }

  const [, payload] = token.split('.');
  if (!payload) {
    return null;
  }

  try {
    return JSON.parse(decodeBase64Url(payload)) as TokenPayload;
  } catch {
    return null;
  }
};

export const syncUserFromProfile = (profile: AccountProfile) => {
  useUserStore.getState().setUser({
    id: profile.id,
    name: profile.nickname,
    account: profile.account ?? null,
    email: profile.email ?? null,
    avatar: profile.avatar ?? null,
    isGuest: profile.isGuest,
  });
};

export const clearAuthSession = () => {
  localStorage.removeItem(authTokenStorageKey);
  useUserStore.getState().clearUser();
};

export const applyAuthSession = (session: {
  accessToken: string;
  user: AccountProfile;
}) => {
  setStoredAuthToken(session.accessToken);
  syncUserFromProfile(session.user);
};

export const hydrateUserFromStoredToken = () => {
  const token = getStoredAuthToken();
  const payload = parseAuthToken(token);

  if (!token || !payload?.sub || payload.isGuest) {
    if (token) {
      clearAuthSession();
    }
    return null;
  }

  if (payload.exp && payload.exp * 1000 <= Date.now()) {
    clearAuthSession();
    return null;
  }

  useUserStore.getState().setUser({
    id: payload.sub,
    name: payload.nickname ?? 'User',
    account: payload.account ?? null,
    email: payload.email ?? null,
    avatar: null,
    isGuest: false,
  });

  return payload;
};
