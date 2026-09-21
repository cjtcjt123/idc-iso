export const theme = {
  // ── 强调色（与小程序 app.wxss --primary 同源 #1D6BFF）──
  accent: "#1d6bff",
  accent2: "#2e90fa",
  accentDeep: "#1552cc",
  accentSoft: "#e8f0ff",
  danger: "#e54d42",

  // ── 背景 / 表面 ──
  bg: "#f5f7fa",
  surface: "#ffffff",
  surfaceAlt: "#fbfcfe",
  border: "#e6e9ef",

  // ── 文字 ──
  text1: "#101828",
  text2: "#5b6573",
  text3: "#98a2b3",

  // ── 语义状态色（主色 + 浅底衍生，对应小程序 badge tinted bg）──
  ok: "#12b76a",
  okSoft: "#e7f7ef",
  warn: "#f79009",
  warnSoft: "#fef3e2",
  danger2: "#f04438",
  dangerSoft: "#fdeceb",
  info: "#2e90fa",
  infoSoft: "#e8f2fe",
  purple: "#7c3aed",
  purpleSoft: "#f1ebfe",

  // ── 圆角（对齐 home-target 预览）──
  rSm: 10,
  r: 16,
  rLg: 22,
  rPill: 999,

  // ── 阴影 ──
  shadow: "0px 4px 16px rgba(16,24,40,0.06)",
  shadowSm: "0px 2px 10px rgba(16,24,40,0.05)",
  shadowAccent: "0px 8px 22px rgba(29,107,255,0.28)",

  // ── 渐变（[起,止]，与小程序图标方块 / 预览 hero 同源）──
  grad: {
    device: ["#5aa9ff", "#1d6bff"],
    rack: ["#5ce0a8", "#12b76a"],
    customer: ["#fbc17d", "#f79009"],
    inventory: ["#b6a4fb", "#7c3aed"],
    odf: ["#22d3ee", "#06b6d4"],
    hero: ["#1d6bff", "#2e90fa"],
  },

  // 进度条底色
  track: "#eef1f6",
} as const;

export type Theme = typeof theme;
