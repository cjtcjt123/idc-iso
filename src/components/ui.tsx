import React, { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "../theme";

/* ───────────────────────── 渐变背景（用已装的 react-native-svg，零新依赖）───────────────────────── */
export function GradientView({
  colors,
  style,
  children,
  radius = 0,
}: {
  colors: readonly [string, string];
  style?: any;
  children?: React.ReactNode;
  radius?: number;
}) {
  const gid = React.useId().replace(/:/g, "");
  return (
    <View style={[styles.gradWrap, { borderRadius: radius }, style]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={colors[0]} />
            <Stop offset="100%" stopColor={colors[1]} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gid})`} />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.gradCenter]}>{children}</View>
    </View>
  );
}

/* 渐变图标方块 */
export function IconChip({
  icon,
  colors,
  size = 40,
  radius = 12,
}: {
  icon: string;
  colors: readonly [string, string];
  size?: number;
  radius?: number;
}) {
  return (
    <GradientView colors={colors} radius={radius} style={{ width: size, height: size }}>
      <Text style={{ fontSize: size * 0.46, textAlign: "center" }}>{icon}</Text>
    </GradientView>
  );
}

/* 统计卡：渐变图标 + 标签 + 大数值 + 副文 + 可选进度条 */
export function StatCard({
  icon,
  colors,
  label,
  value,
  sub,
  bar,
  onPress,
}: {
  icon: string;
  colors: readonly [string, string];
  label: string;
  value: string;
  sub?: string;
  bar?: number; // 0-100
  onPress?: () => void;
}) {
  const body = (
    <View style={styles.statCard}>
      <IconChip icon={icon} colors={colors} size={40} radius={12} />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
      {bar !== undefined ? <ProgressBar percent={bar} colors={colors} /> : null}
    </View>
  );
  return onPress ? (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress}>{body}</TouchableOpacity>
  ) : (
    body
  );
}

/* 全宽渐变 hero（扫一扫等入口） */
export function HeroCard({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: string;
  title: string;
  subtitle: string;
  onPress?: () => void;
}) {
  const body = (
    <GradientView colors={theme.grad.hero} radius={theme.r} style={styles.hero}>
      <View style={styles.heroIcon}>
        <Text style={{ fontSize: 22 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.heroTitle}>{title}</Text>
        <Text style={styles.heroSub}>{subtitle}</Text>
      </View>
      <Text style={styles.heroArrow}>›</Text>
    </GradientView>
  );
  return onPress ? (
    <TouchableOpacity activeOpacity={0.92} onPress={onPress}>
      {body}
    </TouchableOpacity>
  ) : (
    body
  );
}

/* 带左侧强调竖条的区块卡（标题 + 内容） */
export function SectionCard({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHead}>
        <View style={styles.sectionBar} />
        <Text style={styles.sectionTitle}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

/* 进度条 */
export function ProgressBar({
  percent,
  colors,
}: {
  percent: number;
  colors?: readonly [string, string];
}) {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  const fill = colors ? colors[1] : theme.ok;
  return (
    <View style={styles.bar}>
      <View style={[styles.barFill, { width: `${p}%`, backgroundColor: fill }]} />
    </View>
  );
}

/* 近 12 月上下架双柱图（对齐预览 .chart） */
export function MiniBarChart({ data }: { data: { label: string; mount: number; dismount: number }[] }) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.mount, d.dismount)));
  return (
    <View style={styles.chart}>
      {data.map((d, i) => (
        <View key={i} style={styles.chartCol}>
          <View style={styles.chartPair}>
            <View style={[styles.chartBarUp, { height: (d.mount / max) * 56 }]} />
            <View style={[styles.chartBarDown, { height: (d.dismount / max) * 56 }]} />
          </View>
          <Text style={styles.chartLabel}>{d.label}</Text>
        </View>
      ))}
    </View>
  );
}

/* 操作记录行 */
export const ACTIVITY_LABEL: Record<string, string> = {
  mat: "物料",
  "dev-in": "入库",
  "dev-out": "出库",
  "dev-mount": "上架",
  "dev-dismount": "下架",
  audit: "审计",
};
const ACTIVITY_TINT: Record<string, { fg: string; bg: string }> = {
  "dev-mount": { fg: theme.ok, bg: theme.okSoft },
  "dev-in": { fg: theme.info, bg: theme.infoSoft },
  "dev-out": { fg: theme.warn, bg: theme.warnSoft },
  "dev-dismount": { fg: theme.danger2, bg: theme.dangerSoft },
  mat: { fg: theme.purple, bg: theme.purpleSoft },
  audit: { fg: theme.text2, bg: theme.accentSoft },
};

export function ActivityRow({
  kind,
  desc,
  meta,
  onPress,
}: {
  kind?: string;
  desc: string;
  meta?: string;
  onPress?: () => void;
}) {
  const tint = (kind && ACTIVITY_TINT[kind]) || ACTIVITY_TINT.mat;
  const label = (kind && ACTIVITY_LABEL[kind]) || kind || "记录";
  const body = (
    <View style={styles.actRow}>
      <View style={[styles.kBadge, { backgroundColor: tint.bg }]}>
        <Text style={[styles.kBadgeText, { color: tint.fg }]}>{label}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.actDesc} numberOfLines={1}>
          {desc}
        </Text>
        {meta ? <Text style={styles.actMeta}>{meta}</Text> : null}
      </View>
    </View>
  );
  if (onPress) {
    return <TouchableOpacity activeOpacity={0.7} onPress={onPress}>{body}</TouchableOpacity>;
  }
  return body;
}

/* 顶栏机房胶囊 */
export function RoomPill({ name, online = true }: { name: string; online?: boolean }) {
  return (
    <View style={styles.roomPill}>
      <View style={[styles.dot, online ? styles.dotOn : null]} />
      <Text style={styles.roomName}>{name}</Text>
    </View>
  );
}

/* 列表行卡片：渐变图标 + 标题 + 副文 + 右侧徽章 + 箭头 */
export function CardRow({
  icon,
  colors,
  title,
  subtitle,
  right,
  onPress,
}: {
  icon?: string;
  colors?: readonly [string, string];
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
}) {
  const body = (
    <View style={styles.cardRow}>
      {icon && colors ? <IconChip icon={icon} colors={colors} size={38} radius={11} /> : null}
      <View style={{ flex: 1, marginLeft: icon ? 12 : 0, minWidth: 0 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.rowSub} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      <Text style={styles.chevron}>›</Text>
    </View>
  );
  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
        <Card>{body}</Card>
      </TouchableOpacity>
    );
  }
  return <Card>{body}</Card>;
}

export function ScreenHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>{title}</Text>
      {right}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function ListRow({
  title,
  subtitle,
  right,
  onPress,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
}) {
  const body = (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {right}
        <Text style={styles.chevron}>›</Text>
      </View>
    </View>
  );
  if (onPress) return <TouchableOpacity onPress={onPress}>{body}</TouchableOpacity>;
  return body;
}

export function Badge({ label, color }: { label: string; color?: string }) {
  return (
    <View style={[styles.badge, color ? { backgroundColor: color + "22" } : null]}>
      <Text style={[styles.badgeText, color ? { color } : null]}>{label}</Text>
    </View>
  );
}

export function Input({
  value,
  onChangeText,
  placeholder,
  secure,
  style,
  keyboardType,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secure?: boolean;
  style?: any;
  keyboardType?: "default" | "numeric" | "email-address" | "phone-pad";
}) {
  return (
    <TextInput
      style={[styles.input, style]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.text3}
      secureTextEntry={secure}
      keyboardType={keyboardType}
      autoCapitalize="none"
      autoCorrect={false}
    />
  );
}

export function Button({
  label,
  onPress,
  loading,
  danger,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  danger?: boolean;
  disabled?: boolean;
  style?: any;
}) {
  const off = disabled || loading;
  return (
    <TouchableOpacity
      style={[styles.btn, danger ? styles.btnDanger : null, off && styles.btnDisabled, style]}
      onPress={off ? () => {} : onPress}
      disabled={off}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.btnText}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

/* 搜索条（图标 + 输入 + ✕清除） */
export function SearchBar({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={styles.searchBar}>
      <Text style={styles.searchIcon}>⌕</Text>
      <TextInput
        style={styles.searchInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.text3}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      {value ? (
        <TouchableOpacity onPress={() => onChangeText("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.searchClear}>✕</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/* 单选 chip（on/off），可附带右侧 ▾ 表示这是下拉选择 */
export function Chip({
  label,
  active,
  onPress,
  dropdown,
  tone,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  dropdown?: boolean;
  tone?: "accent" | "ok" | "warn" | "neutral";
}) {
  const bg =
    tone === "ok" ? theme.okSoft : tone === "warn" ? theme.warnSoft : active ? theme.accentSoft : theme.surfaceAlt;
  const fg =
    tone === "ok" ? theme.ok : tone === "warn" ? theme.warn : active ? theme.accent : theme.text2;
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={[styles.chipText, { color: fg }]} numberOfLines={1}>
        {label}
        {dropdown ? "  ▾" : ""}
      </Text>
    </TouchableOpacity>
  );
}

/* 弹层：mask + sheet 主体，键盘弹出由各表单自管 */
export function Sheet({
  visible,
  title,
  onClose,
  children,
  scrollable,
}: {
  visible: boolean;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  scrollable?: boolean;
}) {
  // 必须在 early return 之前调用 hook
  const homeInset = useSafeAreaInsets().bottom;
  if (!visible) return null;
  const Body = scrollable ? require("react-native").ScrollView : View;
  return (
    <View style={styles.mask}>
      <TouchableOpacity activeOpacity={1} style={StyleSheet.absoluteFill} onPress={onClose} />
      {/* 底部弹层是自己铺满整屏的层：必须加 Home 指示条留白，
          否则 iPhone 底部操作按钮会被 Home 横条压住点不到 */}
      <View style={[styles.sheet, { paddingBottom: homeInset + 16 }]}>
        {title ? (
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.sheetClose}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <Body style={scrollable ? styles.sheetBodyScroll : styles.sheetBody}>{children}</Body>
      </View>
    </View>
  );
}

/* 分页：上一页 / 第N/M页 + pageSize ▾ / 下一页 */
export function Pager({
  page,
  totalPages,
  pageSize,
  pageSizeOptions = [20, 30, 40],
  onPrev,
  onNext,
  onPageSize,
}: {
  page: number;
  totalPages: number;
  pageSize: number;
  pageSizeOptions?: number[];
  onPrev: () => void;
  onNext: () => void;
  onPageSize?: (n: number) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <View style={styles.pager}>
      <TouchableOpacity onPress={onPrev} disabled={page <= 1} style={[styles.pgBtn, page <= 1 && styles.pgBtnDis]}>
        <Text style={[styles.pgBtnText, page <= 1 && styles.pgBtnTextDis]}>上一页</Text>
      </TouchableOpacity>
      <View style={styles.pgMid}>
        <Text style={styles.pgInfo}>第 {page}/{totalPages} 页</Text>
        {onPageSize ? (
          <View>
            <TouchableOpacity onPress={() => setPickerOpen((v) => !v)} style={styles.pgSizeBtn}>
              <Text style={styles.pgSizeText}>{pageSize} 条 ▾</Text>
            </TouchableOpacity>
            {pickerOpen ? (
              <View style={styles.pgSizePop}>
                {pageSizeOptions.map((n) => (
                  <TouchableOpacity
                    key={n}
                    onPress={() => {
                      onPageSize(n);
                      setPickerOpen(false);
                    }}
                    style={styles.pgSizeItem}
                  >
                    <Text style={[styles.pgSizeItemText, n === pageSize && styles.pgSizeItemTextOn]}>{n} 条/页</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  onPress={() => {
                    onPageSize(-1); // -1 = 全部（取后端最大 pageSize）
                    setPickerOpen(false);
                  }}
                  style={styles.pgSizeItem}
                >
                  <Text style={styles.pgSizeItemText}>全部</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
      <TouchableOpacity
        onPress={onNext}
        disabled={page >= totalPages}
        style={[styles.pgBtn, page >= totalPages && styles.pgBtnDis]}
      >
        <Text style={[styles.pgBtnText, page >= totalPages && styles.pgBtnTextDis]}>下一页</Text>
      </TouchableOpacity>
    </View>
  );
}

/* 行内计数文本 "共 N 台" */
export function Count({ total, label }: { total: number; label: string }) {
  return (
    <Text style={styles.countText}>
      共 <Text style={styles.countNum}>{total}</Text> {label}
    </Text>
  );
}

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={theme.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: { fontSize: 22, fontWeight: "700", color: theme.text1 },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: "#101828",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: theme.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
  },
  rowTitle: { fontSize: 15, color: theme.text1, fontWeight: "600" },
  rowSub: { fontSize: 12, color: theme.text3, marginTop: 2 },
  chevron: { fontSize: 20, color: theme.text3, marginLeft: 8 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: theme.accentSoft,
    alignSelf: "flex-start",
  },
  badgeText: { fontSize: 12, color: theme.accent, fontWeight: "600" },
  input: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.text1,
  },
  btn: {
    backgroundColor: theme.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 10,
  },
  btnDisabled: { opacity: 0.4 },
  btnDanger: { backgroundColor: theme.danger },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  empty: { padding: 40, alignItems: "center" },
  emptyText: { color: theme.text3, fontSize: 14 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },

  /* ── 渐变 / 组件库 ── */
  gradWrap: { overflow: "hidden", position: "relative" },
  gradCenter: { alignItems: "center", justifyContent: "center" },
  statCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.r,
    padding: 14,
    shadowColor: "#101828",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    flex: 1,
    margin: 6,
  },
  statLabel: { fontSize: 12, color: theme.text2, marginTop: 10 },
  statValue: { fontSize: 24, fontWeight: "800", color: theme.text1, lineHeight: 28, marginTop: 1 },
  statSub: { fontSize: 10.5, color: theme.text3, marginTop: 3 },
  hero: { flexDirection: "row", alignItems: "center", padding: 16, gap: 14 },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: { fontSize: 17, fontWeight: "700", color: "#fff" },
  heroSub: { fontSize: 12, color: "#fff", opacity: 0.85, marginTop: 2 },
  heroArrow: { fontSize: 22, color: "#fff", opacity: 0.8, marginLeft: 6 },
  sectionCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.r,
    padding: 16,
    marginTop: 12,
    shadowColor: "#101828",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  sectionHead: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  sectionBar: { width: 4, height: 15, borderRadius: 3, backgroundColor: theme.accent, marginRight: 8 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: theme.text1, flex: 1 },
  bar: { height: 5, borderRadius: 4, backgroundColor: theme.track, marginTop: 9, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 4 },
  chart: { flexDirection: "row", alignItems: "flex-end", gap: 6, height: 76, marginTop: 6 },
  chartCol: { flex: 1, alignItems: "center", gap: 3 },
  chartPair: { flexDirection: "row", alignItems: "flex-end", gap: 3, height: 58 },
  chartBarUp: { width: 7, borderRadius: 3, backgroundColor: theme.accent },
  chartBarDown: { width: 7, borderRadius: 3, backgroundColor: "#cdd6e6" },
  chartLabel: { fontSize: 9, color: theme.text3 },
  actRow: { flexDirection: "row", alignItems: "flex-start", gap: 11, paddingVertical: 11, borderTopWidth: 1, borderColor: "#f1f3f7" },
  kBadge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 7, alignSelf: "flex-start" },
  kBadgeText: { fontSize: 10.5, fontWeight: "700" },
  actDesc: { fontSize: 13, fontWeight: "500", color: theme.text1 },
  actMeta: { fontSize: 11, color: theme.text3, marginTop: 3 },
  roomPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: theme.surface,
    borderRadius: theme.rPill,
    paddingVertical: 7,
    paddingHorizontal: 13,
    shadowColor: "#101828",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.text3 },
  dotOn: { backgroundColor: theme.ok, shadowColor: theme.ok, shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
  roomName: { fontSize: 13, fontWeight: "600", color: theme.text1 },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 4 },

  /* ── 机柜设备模块新组件（SearchBar / Chip / Sheet / Pager / Count）── */
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: theme.border,
    height: 40,
  },
  searchIcon: { fontSize: 16, color: theme.text3, marginRight: 6 },
  searchInput: { flex: 1, fontSize: 14, color: theme.text1, paddingVertical: 0 },
  searchClear: { fontSize: 14, color: theme.text3, paddingHorizontal: 6 },

  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.rPill,
    borderWidth: 1,
    borderColor: theme.border,
    marginRight: 6,
  },
  chipText: { fontSize: 12, fontWeight: "600" },

  mask: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(16,24,40,0.45)",
    justifyContent: "flex-end",
    zIndex: 999,
  },
  sheet: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: "85%",
    paddingBottom: 24,
  },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
  },
  sheetTitle: { fontSize: 16, fontWeight: "700", color: theme.text1 },
  sheetClose: { fontSize: 16, color: theme.text3, padding: 4 },
  sheetBody: { paddingHorizontal: 16, paddingTop: 12 },
  sheetBodyScroll: { paddingHorizontal: 16, paddingTop: 12, maxHeight: 480 },

  pager: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginVertical: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: theme.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  pgBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: theme.surfaceAlt,
  },
  pgBtnDis: { opacity: 0.4 },
  pgBtnText: { fontSize: 13, color: theme.text1, fontWeight: "600" },
  pgBtnTextDis: { color: theme.text3 },
  pgMid: { flexDirection: "row", alignItems: "center", gap: 8 },
  pgInfo: { fontSize: 12, color: theme.text2 },
  pgSizeBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  pgSizeText: { fontSize: 12, color: theme.accent, fontWeight: "600" },
  pgSizePop: {
    position: "absolute",
    bottom: 24,
    right: 0,
    backgroundColor: theme.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    paddingVertical: 4,
    minWidth: 96,
    shadowColor: "#101828",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  pgSizeItem: { paddingVertical: 6, paddingHorizontal: 12 },
  pgSizeItemText: { fontSize: 12, color: theme.text2 },
  pgSizeItemTextOn: { color: theme.accent, fontWeight: "700" },

  countText: { fontSize: 12, color: theme.text2 },
  countNum: { fontSize: 14, fontWeight: "700", color: theme.text1, marginHorizontal: 2 },
});
