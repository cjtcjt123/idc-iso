import { API_PREFIX, normalizeBaseUrl } from "../config";
import { baseUrlStorage, tokenStorage } from "../storage";
import type { PaginatedResult } from "./types";

// 401 时由 AuthContext 注册：清空登录态并返回登录页。
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function resolveBase(): Promise<string> {
  // 容错：用户可能把 /api/v1 一并填进地址，先归一化再拼 API_PREFIX，避免拼成 /api/v1/api/v1/...
  return normalizeBaseUrl(await baseUrlStorage.get());
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string | number | undefined>
): Promise<T> {
  const base = await resolveBase();
  const url = new URL(base + API_PREFIX + path);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
  }
  const token = await tokenStorage.load();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    await tokenStorage.clear();
    onUnauthorized?.();
    throw new ApiError(401, "登录已失效，请重新登录");
  }
  if (!res.ok) {
    let msg = `请求失败 (${res.status})`;
    try {
      const err = await res.json();
      msg = err?.message || err?.error || msg;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, msg);
  }
  return (await res.json()) as T;
}

/** 列表接口：直接返回信封（含 data / total / page ...） */
export function apiList<T>(
  path: string,
  params?: Record<string, string | number | undefined>
): Promise<PaginatedResult<T>> {
  return request<PaginatedResult<T>>("GET", path, undefined, params);
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>("GET", path);
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>("POST", path, body);
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>("PATCH", path, body);
}

export function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return request<T>("PUT", path, body);
}

export function apiDelete<T>(path: string): Promise<T> {
  return request<T>("DELETE", path);
}

/** 二进制下载（如备份文件）：返回 ArrayBuffer，调用方自行落盘。仅后端已门禁的接口可走此路。 */
export async function apiDownloadBuffer(path: string): Promise<ArrayBuffer> {
  const base = await resolveBase();
  const url = new URL(base + API_PREFIX + path);
  const token = await tokenStorage.load();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url.toString(), { method: "GET", headers });
  if (res.status === 401) {
    await tokenStorage.clear();
    onUnauthorized?.();
    throw new ApiError(401, "登录已失效，请重新登录");
  }
  if (!res.ok) throw new ApiError(res.status, `下载失败 (${res.status})`);
  return await res.arrayBuffer();
}

/** 列表类接口统一收成数组：兼容「分页信封 {data:[]}」与「裸数组」两种返回 */
export async function apiCollect<T>(
  path: string,
  params?: Record<string, string | number | undefined>
): Promise<T[]> {
  const res = await request<any>("GET", path, undefined, params);
  if (Array.isArray(res)) return res as T[];
  if (res && Array.isArray(res.data)) return res.data as T[];
  return [];
}

export { request };
