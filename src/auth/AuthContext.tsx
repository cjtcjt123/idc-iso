import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiCollect, apiGet, apiPost, setUnauthorizedHandler } from "../api/client";
import type { AuthUser, LoginResponse } from "../api/types";
import { roomStorage, tokenStorage } from "../storage";

type RoomWithCount = { id: string; name?: string; _count?: { racks?: number } };

/**
 * 对齐小程序 utils/scope.ts 的 bootstrapRoom：
 * 优先落在「有机柜的机房」，避免停在空机房导致机柜/平面图/ODF 全空。
 */
function pickRoomId(rooms: RoomWithCount[], curId: string | null): string | null {
  if (!rooms.length) return null;
  const racksOf = (r: RoomWithCount) => r._count?.racks ?? 0;
  const withRacks = rooms.find((r) => racksOf(r) > 0);
  const cur = rooms.find((r) => r.id === curId);
  if (cur) return racksOf(cur) > 0 ? cur.id : (withRacks ?? cur).id;
  return (withRacks ?? rooms[0]).id;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  ready: boolean;
  currentRoomId: string | null;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setRoom: (roomId: string | null) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);

  /** 拉取可切换机房并选出默认机房（有机柜者优先），返回最终机房 id */
  const bootstrapRoom = async (curId: string | null): Promise<string | null> => {
    try {
      const rooms = await apiCollect<RoomWithCount>("/rooms/mine");
      const id = pickRoomId(rooms, curId);
      if (id) await roomStorage.save(id);
      return id;
    } catch {
      return curId;
    }
  };

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null);
      setUser(null);
    });
    (async () => {
      const t = await tokenStorage.load();
      let rid = await roomStorage.get();
      let authed = false;
      if (t) {
        setToken(t);
        try {
          const me = await apiGet<AuthUser>("/auth/me");
          setUser(me);
          authed = true;
        } catch {
          // token 失效由 client 的 401 处理已清空，这里兜底
          setToken(null);
        }
      }
      // 登录态下自动引导默认机房，避免首页显示未选中的机房、其余页全空
      if (authed) rid = await bootstrapRoom(rid);
      setCurrentRoomId(rid);
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setCurrentRoomId(await bootstrapRoom(await roomStorage.get()));
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

  /** 重新拉取当前账号信息（对齐小程序 profile onShow 调 /auth/me）。 */
  const refreshUser = async () => {
    try {
      const me = await apiGet<AuthUser>("/auth/me");
      setUser(me);
    } catch {
      /* 401 已由 client 处理并清空登录态 */
    }
  };

  const value = useMemo<AuthState>(
    () => ({ user, token, ready, currentRoomId, login, logout, setRoom, refreshUser }),
    [user, token, ready, currentRoomId]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
