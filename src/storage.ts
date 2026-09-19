import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { DEFAULT_BASE_URL } from "./config";

const isWeb = Platform.OS === "web";
const TOKEN_KEY = "idcops_token";
const BASE_KEY = "idcops_base_url";
const ROOM_KEY = "idcops_room_id";

// SecureStore 在 web 不可用，退化为内存（仅用于本地预览）。
let mem: Record<string, string> = {};

async function set(key: string, value: string): Promise<void> {
  if (isWeb) {
    mem[key] = value;
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function get(key: string): Promise<string | null> {
  if (isWeb) return mem[key] ?? null;
  return SecureStore.getItemAsync(key);
}

async function del(key: string): Promise<void> {
  if (isWeb) {
    delete mem[key];
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export const tokenStorage = {
  save: (t: string) => set(TOKEN_KEY, t),
  load: () => get(TOKEN_KEY),
  clear: () => del(TOKEN_KEY),
};

export const baseUrlStorage = {
  async get(): Promise<string> {
    return (await get(BASE_KEY)) ?? DEFAULT_BASE_URL;
  },
  save: (url: string) => set(BASE_KEY, url),
};

export const roomStorage = {
  get: () => get(ROOM_KEY),
  save: (id: string) => set(ROOM_KEY, id),
  clear: () => del(ROOM_KEY),
};
