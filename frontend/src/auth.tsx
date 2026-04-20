import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, type User } from "./api";

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  register: (email: string, password: string, displayName?: string, referredByCode?: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
};

// Token is stored in either localStorage (remember me) or sessionStorage (until tab close).
// We read from both so existing sessions keep working.
function getToken(): string | null {
  return localStorage.getItem("token") || sessionStorage.getItem("token");
}
function setToken(token: string, remember: boolean) {
  if (remember) {
    localStorage.setItem("token", token);
    sessionStorage.removeItem("token");
  } else {
    sessionStorage.setItem("token", token);
    localStorage.removeItem("token");
  }
}
function clearToken() {
  localStorage.removeItem("token");
  sessionStorage.removeItem("token");
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api.get<User>("/auth/me");
      setUser(me);
    } catch {
      clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string, remember = true) => {
      const { access_token } = await api.post<{ access_token: string }>("/auth/login", {
        email,
        password,
      });
      setToken(access_token, remember);
      await refresh();
    },
    [refresh],
  );

  const register = useCallback(
    async (email: string, password: string, displayName?: string, referredByCode?: string) => {
      const { access_token } = await api.post<{ access_token: string }>("/auth/register", {
        email,
        password,
        display_name: displayName,
        referred_by_code: referredByCode,
      });
      setToken(access_token, true); // new signups remember by default
      await refresh();
    },
    [refresh],
  );

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refresh }),
    [user, loading, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
