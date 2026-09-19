import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiGet, apiPost, setUnauthorizedHandler } from "../api/client";
import type { AuthUser, LoginResponse } from "../api/types";
import { roomStorage, tokenStorage } from "../storage";

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  ready: boolean;
  currentRoomId: string | null;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setRoom: (roomId: string | null) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null);
      setUser(null);
    });
    (async () => {
      const t = await tokenStorage.load();
      const rid = await roomStorage.get();
      if (t) {
        setToken(t);
        try {
          const me = await apiGet<AuthUser>("/auth/me");
          setUser(me);
        } catch {
          // token 失效由 client 的 401 处理已清空，这里兜底
          setToken(null);
        }
      }
      setCurrentRoomId(rid);
      setReady(true);
    })();
  }, []);

  const login = async (identifier: string, password: string) => {
    const res = await apiPost<LoginResponse>("/auth/login", {
      identifier,
      password,
    });
    await tokenStorage.save(res.accessToken);
    setToken(res.accessToken);
    const me = await apiGet<AuthUser>("/auth/me");
    setUser(me);
  };

  const logout = async () => {
    await tokenStorage.clear();
    await roomStorage.clear();
    setToken(null);
    setUser(null);
    setCurrentRoomId(null);
  };

  const setRoom = async (roomId: string | null) => {
    setCurrentRoomId(roomId);
    if (roomId) await roomStorage.save(roomId);
    else await roomStorage.clear();
  };

  const value = useMemo<AuthState>(
    () => ({ user, token, ready, currentRoomId, login, logout, setRoom }),
    [user, token, ready, currentRoomId]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
