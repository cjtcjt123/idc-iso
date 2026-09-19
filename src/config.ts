// 运行配置：默认后端地址（用户可在「我的」页修改）。
export const DEFAULT_BASE_URL = "http://192.168.0.109:3000";
export const API_PREFIX = "/api/v1";

/**
 * 服务器地址「应急入口」口令（与小程序一致）。
 * 触发方式：连点应用图标 / 登录页 Logo 5 次 → 输入本口令 → 出现地址编辑框。
 * 目的：地址变了又不想重新发版时可临时改，不把入口常驻在明面上。
 * 注意：前端没有真正的秘密，本口令作用仅是「防随手乱点」，不是防专业攻击。
 */
export const CONFIG_PASSKEY = "chenjingtao";
/** 是否允许运行时切换服务器地址（开发/生产均开启，入口由口令保护） */
export const ALLOW_SERVER_SWITCH = true;

/**
 * 校验 baseUrl 是否允许作为 API 基地址（与小程序同源逻辑）。
 * 两层防线：①公网域名强制 https（避免明文 token 经公网被嗅探）；②内网/本机允许 http。
 */
export function isAllowedBaseUrl(raw: string): boolean {
  const m = /^(https?):\/\/([^:/?#]+)(?::\d+)?(?:\/|$)/.exec(raw.trim());
  if (!m) return false;
  const protocol = m[1];
  const host = m[2];
  if (protocol !== "http" && protocol !== "https") return false;
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(host)) {
    return protocol === "https";
  }
  return false;
}
