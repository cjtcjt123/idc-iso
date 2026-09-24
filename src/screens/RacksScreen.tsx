import React, { useEffect, useMemo, useState } from "react";
import { Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { apiCollect, apiList, apiPatch, apiPost } from "../api/client";
import type { Customer, Floor, Rack, Zone } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { useCan, customerScopeId } from "../auth/permission";
import {
  Button,
  Chip,
  Count,
  EmptyState,
  Input,
  Loading,
  Pager,
  SearchBar,
  Sheet,
} from "../components/ui";
import { theme } from "../theme";

type Density = "list" | "grid";
type UsageFilter = "" | "low" | "high";

const DEFAULT_PAGE_SIZE = 20;
const POWER_FEED_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const FEED_COLORS: Record<string, string> = {
  A: "#1d6bff",
  B: "#22c55e",
  C: "#f97316",
  D: "#a855f7",
  E: "#06b6d4",
  F: "#e54d42",
  G: "#0ea5e9",
  H: "#7c3aed",
};

export function RacksScreen({ navigation }: any) {
  const { currentRoomId, user } = useAuth();
  const can = useCan();
  const canEditRack = can("rack", "update");
  // 客户组成员：强制只看自己客户的机柜（对齐小程序 forcedCustomerId）
  const forcedCust = customerScopeId(user);
  const [racks, setRacks] = useState<Rack[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [density, setDensity] = useState<Density>("list");
  const [usage, setUsage] = useState<UsageFilter>("");
  const [filterCustomerId, setFilterCustomerId] = useState<string | "">("");
  const [customers, setCustomers] = useState<Customer[]>([]);

  // 弹层状态
  const [showCreate, setShowCreate] = useState(false);
  const [editingRack, setEditingRack] = useState<Rack | null>(null);

  const load = async () => {
    if (!currentRoomId) {
      setLoading(false);
      return;
    }
    try {
      const res = await apiList<Rack>("/racks", {
        roomId: currentRoomId,
        search: keyword || undefined,
        customerId: filterCustomerId || undefined,
        page: keyword || filterCustomerId || usage ? 1 : page,
        pageSize: pageSize === -1 ? 1000 : pageSize,
      });
      setRacks(res.data);
      setTotal(res.total);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadCustomers = async () => {
    if (!currentRoomId) return;
    try {
      const cs = await apiCollect<Customer>("/customers", { pageSize: 200 });
      setCustomers(cs);
    } catch {
      /* 静默 */
    }
  };

  useEffect(() => {
    load();
    loadCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRoomId, page, pageSize]);

  // 搜索/筛选改动 → 跳回第 1 页
  useEffect(() => {
    setPage(1);
    setRefreshing(true);
    (async () => {
      if (!currentRoomId) return;
      try {
        const res = await apiList<Rack>("/racks", {
          roomId: currentRoomId,
          search: keyword || undefined,
          customerId: forcedCust || filterCustomerId || undefined,
          page: 1,
          pageSize: pageSize === -1 ? 1000 : pageSize,
        });
        setRacks(res.data);
        setTotal(res.total);
      } finally {
        setRefreshing(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword, filterCustomerId, usage]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / (pageSize === -1 ? Math.max(total, 1) : pageSize))),
    [total, pageSize]
  );

  // 客户端二次过滤（低/高载）
  const filtered = useMemo(() => {
    if (!usage) return racks;
    return racks.filter((r) => {
      const u = r.utilization ?? 0;
      return usage === "low" ? u < 0.7 : u >= 0.9;
    });
  }, [racks, usage]);

  // 顶部 3 统计
  const stats = useMemo(() => {
    const used = racks.filter((r) => (r.utilization ?? 0) > 0).length;
    return { total: racks.length, used, free: racks.length - used };
  }, [racks]);

  if (loading) return <Loading />;
  if (!currentRoomId)
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <EmptyState text="请先在「我的」页选择当前机房" />
      </View>
    );

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* 搜索 */}
      <SearchBar value={keyword} onChangeText={setKeyword} placeholder="搜索机柜名称" />

      {/* 工具条 */}
      <View style={styles.toolbar}>
        <Count total={total} label="台" />
        <View style={{ flex: 1 }} />
        <ToolBtn label={density === "grid" ? "☰ 单列" : "⊞ 双列"} onPress={() => setDensity((d) => (d === "grid" ? "list" : "grid"))} />
        <ToolBtn label="＋ 新增" tone="primary" onPress={() => setShowCreate(true)} />
      </View>

      {/* 顶部 3 统计 */}
      <View style={styles.statsRow}>
        <Stat label="机柜总数" value={stats.total} color={theme.text1} />
        <Stat label="已使用" value={stats.used} color={theme.ok} />
        <Stat label="未使用" value={stats.free} color={theme.warn} />
      </View>

      {/* 筛选 chips */}
      <View style={styles.chipRow}>
        <Chip label="全部" active={usage === ""} onPress={() => setUsage("")} />
        <Chip label="可上架" active={usage === "low"} onPress={() => setUsage("low")} />
        <Chip label="满载" active={usage === "high"} onPress={() => setUsage("high")} />
        <Chip
          label={filterCustomerId ? customers.find((c) => c.id === filterCustomerId)?.name || "客户" : "客户"}
          active={!!filterCustomerId}
          dropdown
          onPress={() => cyclePick(customers, filterCustomerId, setFilterCustomerId)}
        />
      </View>

      {/* 列表 */}
      <FlatList
        data={filtered}
        keyExtractor={(r) => r.id}
        numColumns={density === "grid" ? 2 : 1}
        key={density}
        columnWrapperStyle={density === "grid" ? styles.gridRow : undefined}
        contentContainerStyle={{ paddingBottom: 20 }}
        renderItem={({ item }) =>
          density === "grid" ? (
            <RackCardSm item={item} onPress={() => navigation.navigate("RackDetail", { rackId: item.id, rackCode: item.code })} />
          ) : (
            <RackCardFull
              item={item}
              onPress={() => navigation.navigate("RackDetail", { rackId: item.id, rackCode: item.code })}
              // 此前从未传入 onEdit，editingRack 恒为 null → 编辑弹层永远打不开
              onEdit={canEditRack ? () => setEditingRack(item) : undefined}
            />
          )
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListEmptyComponent={<EmptyState text={keyword || filterCustomerId ? "无匹配机柜" : "该机房暂无机柜"} />}
      />

      <Pager
        page={page}
        totalPages={totalPages}
        pageSize={pageSize === -1 ? total : pageSize}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
        onPageSize={(n) => {
          setPageSize(n);
          setPage(1);
        }}
      />

      {/* 新建机柜弹层 */}
      <RackFormSheet
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onDone={() => { setShowCreate(false); load(); }}
        currentRoomId={currentRoomId!}
        customers={customers}
        racks={racks}
      />

      {/* 编辑机柜弹层 */}
      <RackFormSheet
        visible={!!editingRack}
        editing={editingRack}
        onClose={() => setEditingRack(null)}
        onDone={() => { setEditingRack(null); load(); }}
        currentRoomId={currentRoomId!}
        customers={customers}
        racks={racks}
      />
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statVal, { color }]}>{value}</Text>
      <Text style={styles.statLb}>{label}</Text>
    </View>
  );
}

function ToolBtn({ label, onPress, tone }: { label: string; onPress: () => void; tone?: "primary" | "default" }) {
  const bg = tone === "primary" ? theme.accent : theme.surfaceAlt;
  const fg = tone === "primary" ? "#fff" : theme.text1;
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={[styles.toolBtn, { backgroundColor: bg }]}>
      <Text style={[styles.toolBtnText, { color: fg }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function cyclePick<T extends { id: string }>(items: T[], cur: string | "", set: (v: string | "") => void) {
  if (!items.length) return;
  const idx = items.findIndex((i) => i.id === cur);
  const next = idx < 0 ? items[0].id : idx >= items.length - 1 ? "" : items[idx + 1].id;
  set(next);
}

function rackMode(r: Rack): { text: string; tone: "ok" | "warn" | "neutral" } {
  if ((r.utilization ?? 0) === 0) return { text: "空柜", tone: "neutral" };
  if (r.customerName && r.customerName !== "-") return { text: "专属", tone: "ok" };
  return { text: "散户", tone: "warn" };
}

function usageColor(u: number): string {
  if (u < 0.5) return theme.ok;
  if (u < 0.8) return theme.warn;
  return theme.danger;
}

function usagePercent(r: Rack): number {
  return Math.round((r.utilization ?? 0) * 100);
}

/* 顶部小卡：图标 + 名称 + 模式徽章 + 利用率% + 进度条 + 回路dots + 编辑 */
function RackCardSm({ item, onPress }: { item: Rack; onPress: () => void }) {
  const mode = rackMode(item);
  const pct = usagePercent(item);
  const uColor = usageColor((item.utilization ?? 0));
  const feeds = item.powerFeeds || [];
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={[styles.rkCard, styles.rkCardSm]}>
      <View style={styles.rkSmTop}>
        <View style={styles.rkIco}>
          <Text style={styles.rkIcoText}>🗄</Text>
        </View>
        <Text style={styles.rkName} numberOfLines={1}>{item.code}</Text>
        <Text style={[styles.rkMode, styles[`mode_${mode.tone}`]]}>{mode.text}</Text>
      </View>
      <Text style={[styles.rkPct, { color: uColor }]}>{pct}%</Text>
      <View style={styles.rkBar}>
        <View style={[styles.rkBarFill, { width: `${pct}%`, backgroundColor: uColor }]} />
      </View>
      <Text style={styles.rkSmSub} numberOfLines={1}>
        {item.usedU ?? 0}/{item.uHeight ?? 0}U · {item.customerName && item.customerName !== "-" ? item.customerName : "散户"}
      </Text>
      <View style={styles.rkFeeds}>
        <View style={styles.rkDots}>
          {feeds.length > 0 ? feeds.map((f) => (
            <View key={f} style={[styles.rkDot, { backgroundColor: FEED_COLORS[f] || theme.text3 }]} />
          )) : <Text style={styles.rkFeedsNone}>未配回路</Text>}
        </View>
      </View>
    </TouchableOpacity>
  );
}

/* 完整卡：header + body mini U 位图 */
function RackCardFull({ item, onPress, onEdit }: { item: Rack; onPress: () => void; onEdit?: () => void }) {
  const mode = rackMode(item);
  const pct = usagePercent(item);
  const uColor = usageColor((item.utilization ?? 0));
  const feeds = item.powerFeeds || [];
  const uHeight = item.uHeight ?? 42;
  // 迷你 U 位图：42 格按 used 比例点亮（缩略示意）
  const miniRows = 12; // 用 12 行代替 42U，密度合理
  const uPerRow = Math.ceil(uHeight / miniRows);
  const usedU = item.usedU ?? 0;
  const miniOnCount = Math.round((usedU / uHeight) * miniRows);

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.rkCard}>
      {/* header */}
      <View style={styles.rkHead}>
        <View style={styles.rkIco}>
          <Text style={styles.rkIcoText}>🗄</Text>
        </View>
        <View style={styles.rkHeadBd}>
          <View style={styles.rkNameRow}>
            <Text style={styles.rkName} numberOfLines={1}>{item.code}</Text>
            <Text style={[styles.rkMode, styles[`mode_${mode.tone}`]]}>{mode.text}</Text>
          </View>
          <Text style={styles.rkSub} numberOfLines={1}>
            {usedU}/{uHeight}U · {item.customerName && item.customerName !== "-" ? item.customerName : "散户机柜"}
          </Text>
        </View>
        <View style={styles.rkHeadRt}>
          <Text style={[styles.rkPct, { color: uColor }]}>{pct}%</Text>
          <Text style={styles.rkPctLb}>利用率</Text>
        </View>
      </View>

      {/* body: mini U 位图 + 回路徽章 + 进度条 */}
      <View style={styles.rkBody}>
        <View style={styles.rkMini}>
          {Array.from({ length: miniRows }).map((_, i) => {
            const on = i < miniOnCount;
            return <View key={i} style={[styles.rkMiniU, on && { backgroundColor: uColor, opacity: 0.6 + (i / miniRows) * 0.4 }]} />;
          })}
        </View>
        <View style={styles.rkBodyBd}>
          <View style={styles.rkChips}>
            {feeds.length > 0 ? feeds.map((f) => (
              <Text key={f} style={[styles.rkChip, { color: FEED_COLORS[f], borderColor: FEED_COLORS[f] }]}>{f} 路</Text>
            )) : <Text style={[styles.rkChip, styles.rkChipGray]}>未配回路</Text>}
            <Text style={[styles.rkChip, styles.rkChipGray]}>{uHeight}U</Text>
          </View>
          <View style={styles.rkBar}>
            <View style={[styles.rkBarFill, { width: `${pct}%`, backgroundColor: uColor }]} />
          </View>
        </View>
        {onEdit ? (
          <TouchableOpacity onPress={onEdit} style={styles.rkEditBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.rkEditText}>编辑</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.rkArrow}>›</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  toolBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.rPill,
    backgroundColor: theme.surfaceAlt,
    marginLeft: 6,
  },
  toolBtnText: { fontSize: 12, color: theme.text1, fontWeight: "600" },

  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: theme.surface,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    shadowColor: "#101828",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  statVal: { fontSize: 20, fontWeight: "800" },
  statLb: { fontSize: 11, color: theme.text3, marginTop: 2 },

  chipRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 6,
    flexWrap: "wrap",
  },
  gridRow: { justifyContent: "space-between", paddingHorizontal: 16 },

  /* 机柜卡通用 */
  rkCard: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 5,
    padding: 12,
    shadowColor: "#101828",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  rkCardSm: {
    flex: 1,
    marginHorizontal: 4,
    minWidth: 0,
  },

  /* sm 卡 */
  rkSmTop: { flexDirection: "row", alignItems: "center", gap: 6 },
  rkIco: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: theme.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  rkIcoText: { fontSize: 14 },
  rkName: { flex: 1, fontSize: 13, fontWeight: "700", color: theme.text1, minWidth: 0 },
  rkMode: {
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    fontWeight: "700",
  },
  mode_ok: { color: theme.ok, backgroundColor: theme.okSoft },
  mode_warn: { color: theme.warn, backgroundColor: theme.warnSoft },
  mode_neutral: { color: theme.text3, backgroundColor: theme.accentSoft },
  rkPct: { fontSize: 18, fontWeight: "800", marginTop: 8 },
  rkBar: { height: 5, borderRadius: 3, backgroundColor: theme.track, marginTop: 4, overflow: "hidden" },
  rkBarFill: { height: "100%", borderRadius: 3 },
  rkSmSub: { fontSize: 11, color: theme.text2, marginTop: 6 },
  rkFeeds: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
  rkDots: { flexDirection: "row", gap: 4 },
  rkDot: { width: 8, height: 8, borderRadius: 4 },
  rkFeedsNone: { fontSize: 10, color: theme.text3 },

  /* full 卡 header */
  rkHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  rkHeadBd: { flex: 1, minWidth: 0 },
  rkNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  rkSub: { fontSize: 11, color: theme.text2, marginTop: 4 },
  rkHeadRt: { alignItems: "flex-end" },
  rkPctLb: { fontSize: 10, color: theme.text3, marginTop: 2 },

  /* full 卡 body */
  rkBody: { flexDirection: "row", marginTop: 12, gap: 12 },
  rkMini: {
    width: 18,
    flexDirection: "column-reverse",
    gap: 1,
    alignItems: "stretch",
  },
  rkMiniU: {
    height: 4,
    backgroundColor: theme.track,
    borderRadius: 1,
  },
  rkBodyBd: { flex: 1, minWidth: 0 },
  rkChips: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 8 },
  rkChip: {
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    fontWeight: "700",
  },
  rkChipGray: { color: theme.text3, borderColor: theme.border },

  rkEditBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: theme.accentSoft,
    marginLeft: 8,
  },
  rkEditText: { fontSize: 11, color: theme.accent, fontWeight: "700" },
  rkArrow: { fontSize: 18, color: theme.text3, marginLeft: 6 },

  /* 弹层表单 */
  formRow: { marginBottom: 12 },
  formRowInline: { flexDirection: "row", gap: 8, marginBottom: 12 },
  formLabel: { fontSize: 13, color: theme.text2, marginBottom: 6, fontWeight: "600" },
  formChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  formHint: { fontSize: 11, color: theme.text3, marginTop: 4 },
  formLink: { color: theme.accent, fontSize: 12, fontWeight: "700", paddingHorizontal: 8, paddingVertical: 4 },
  codePreview: { padding: 10, backgroundColor: theme.surfaceAlt, borderRadius: 8, marginBottom: 12 },
  codeText: { fontWeight: "700", color: theme.accent },
});

/* ──── 机柜表单弹层（新建 / 编辑共用） ──── */
function RackFormSheet({
  visible, onClose, onDone, editing, currentRoomId, customers, racks,
}: {
  visible: boolean;
  onClose: () => void;
  onDone: () => void;
  editing?: Rack | null;
  currentRoomId: string;
  customers: Customer[];
  racks: Rack[];
}) {
  const isEdit = !!editing;
  const [name, setName] = useState("");
  const [uHeight, setUHeight] = useState("42");
  const [customerId, setCustomerId] = useState<string | "">("");
  const [feeds, setFeeds] = useState<string[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [floorId, setFloorId] = useState<string | "">("");
  const [zoneId, setZoneId] = useState<string | "">("");
  /** 平面图点阵列/行：不传的话新机柜在平面图里不可见 */
  const [col, setCol] = useState("");
  const [row, setRow] = useState("");
  const [busy, setBusy] = useState(false);
  const [showLoc, setShowLoc] = useState(false);

  // 初始化
  useEffect(() => {
    if (!visible) return;
    if (editing) {
      setName(editing.name || editing.code || "");
      setUHeight(String(editing.uHeight || 42));
      setCustomerId(editing.customerId || "");
      setFeeds(editing.powerFeeds || []);
      setCol(editing.col != null ? String(editing.col) : "");
      setRow(editing.row != null ? String(editing.row) : "");
    } else {
      setName(""); setUHeight("42"); setCustomerId(""); setFeeds([]);
      setCol(""); setRow("");
    }
    setBusy(false);
    setFloorId(""); setZoneId(""); setShowLoc(false);
    // 加载当前机房的楼层/区域
    if (!isEdit) {
      (async () => {
        try {
          const fs = await apiCollect<Floor>("/floors", { roomId: currentRoomId });
          setFloors(fs);
          if (fs[0]) {
            const zs = await apiCollect<Zone>("/zones", { floorId: fs[0].id });
            setZones(zs);
            setFloorId(fs[0].id);
            setZoneId(zs[0]?.id || "");
          }
        } catch {/* 静默 */}
      })();
    }
  }, [visible, editing, currentRoomId, isEdit]);

  const codePreview = useMemo(() => {
    if (isEdit) return editing?.code || "";
    const fl = floors.find((f) => f.id === floorId);
    const z = zones.find((z) => z.id === zoneId);
    if (!fl || !z) return "";
    // 同区域内机柜序号 = 已有数 + 1（与小程序约定一致）
    const seq = racks.filter((r) => r.zoneId === z.id).length + 1;
    return `${fl.code || "F"}-${z.code || "Z"}${seq}`;
  }, [isEdit, editing, floors, zones, floorId, zoneId, racks]);

  const submit = async () => {
    const u = Number(uHeight);
    if (!Number.isInteger(u) || u < 1) return Alert.alert("请填写有效的 U 高（≥1 整数）");
    if (isEdit && editing) {
      setBusy(true);
      try {
        // 编辑走 PATCH（后端 PATCH /racks/:id）
        await apiPatch(`/racks/${editing.id}`, {
          name: name.trim() || undefined,
          uHeight: u,
          customerId: customerId || undefined,
          powerFeeds: feeds.length > 0 ? feeds : undefined,
          col: col ? Number(col) : undefined,
          row: row ? Number(row) : undefined,
        });
        onDone();
      } catch (e: any) {
        Alert.alert("保存失败", e?.message || "操作失败");
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!floorId) return Alert.alert("请选择楼层");
    if (!zoneId) return Alert.alert("请选择区域");
    const z = zones.find((x) => x.id === zoneId);
    const c = Number(col);
    const r = Number(row);
    if (!Number.isInteger(c) || c < 1) return Alert.alert("请填写平面图列号（≥1 整数）");
    if (!Number.isInteger(r) || r < 1) return Alert.alert("请填写平面图行号（≥1 整数）");
    if (z?.cols && c > z.cols) return Alert.alert(`列号超出区域范围（该区域共 ${z.cols} 列）`);
    if (z?.rows && r > z.rows) return Alert.alert(`行号超出区域范围（该区域共 ${z.rows} 行）`);
    setBusy(true);
    try {
      await apiPost("/racks", {
        roomId: currentRoomId,
        floorId,
        zoneId,
        // CreateRackDto.name 是必填字符串，留空必须回落到编码，否则 400
        name: name.trim() || codePreview || "机柜",
        uHeight: u,
        customerId: customerId || undefined,
        powerFeeds: feeds.length > 0 ? feeds : undefined,
        code: codePreview || undefined,
        // 落位：不传 col/row 时平面图里看不到这台机柜
        col: c,
        row: r,
      });
      onDone();
    } catch (e: any) {
      Alert.alert("创建失败", e?.message || "操作失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={isEdit ? "编辑机柜" : "新增机柜"} scrollable>
      {!isEdit ? (
        <>
          <View style={styles.formRow}>
            <Text style={styles.formLabel}>楼层</Text>
            <View style={styles.formChipRow}>
              {floors.length === 0 ? <Text style={styles.formHint}>该机房暂无楼层</Text> : null}
              {floors.map((f) => (
                <Chip key={f.id} label={f.name || f.code || "楼层"} active={floorId === f.id} onPress={() => setFloorId(f.id)} />
              ))}
            </View>
          </View>
          <View style={styles.formRow}>
            <Text style={styles.formLabel}>区域</Text>
            <View style={styles.formChipRow}>
              {zones.length === 0 ? <Text style={styles.formHint}>该楼层暂无区域</Text> : null}
              {zones.map((z) => (
                <Chip key={z.id} label={z.name || z.code || "区域"} active={zoneId === z.id} onPress={() => setZoneId(z.id)} />
              ))}
            </View>
            <TouchableOpacity onPress={() => setShowLoc(true)}>
              <Text style={styles.formLink}>＋ 新建楼层 / 区域</Text>
            </TouchableOpacity>
          </View>
          {codePreview ? (
            <View style={styles.codePreview}>
              <Text style={{ fontSize: 12, color: theme.text2 }}>机柜编码预览</Text>
              <Text style={styles.codeText}>{codePreview}</Text>
            </View>
          ) : null}
        </>
      ) : null}

      <View style={styles.formRow}>
        <Text style={styles.formLabel}>名称</Text>
        <Input value={name} onChangeText={setName} placeholder={isEdit ? "" : "留空则用编码"} />
      </View>

      <View style={styles.formRow}>
        <Text style={styles.formLabel}>U 高 *</Text>
        <Input value={uHeight} onChangeText={setUHeight} placeholder="如 42" keyboardType="numeric" />
      </View>

      {/* 平面图落位：不填列/行，新机柜在平面图里看不到 */}
      <View style={styles.formRowInline}>
        <View style={{ flex: 1 }}>
          <Text style={styles.formLabel}>平面图列号 *</Text>
          <Input value={col} onChangeText={setCol} placeholder="如 1" keyboardType="numeric" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.formLabel}>平面图行号 *</Text>
          <Input value={row} onChangeText={setRow} placeholder="如 1" keyboardType="numeric" />
        </View>
      </View>
      {zones.find((x) => x.id === zoneId)?.cols ? (
        <Text style={styles.formHint}>
          该区域网格：{zones.find((x) => x.id === zoneId)?.cols} 列 ×{" "}
          {zones.find((x) => x.id === zoneId)?.rows} 行
        </Text>
      ) : null}

      {isEdit ? (
        <>
          <View style={styles.formRow}>
            <Text style={styles.formLabel}>归属客户</Text>
            <View style={styles.formChipRow}>
              <Chip label="无（散户）" active={!customerId} onPress={() => setCustomerId("")} />
              {customers.map((c) => (
                <Chip key={c.id} label={c.name} active={customerId === c.id} onPress={() => setCustomerId(customerId === c.id ? "" : c.id)} />
              ))}
            </View>
          </View>
          <View style={styles.formRow}>
            <Text style={styles.formLabel}>供电回路</Text>
            <View style={styles.formChipRow}>
              {POWER_FEED_LETTERS.map((f) => (
                <Chip key={f} label={`${f} 路`} active={feeds.includes(f)} onPress={() => setFeeds(feeds.includes(f) ? feeds.filter((x) => x !== f) : [...feeds, f])} />
              ))}
            </View>
            <Text style={styles.formHint}>可多选：勾选实际接入的回路</Text>
          </View>
        </>
      ) : null}

      <Button label={busy ? "提交中…" : (isEdit ? "保存" : "创建机柜")} onPress={submit} loading={busy} />

      {/* 内嵌：新建楼层 / 区域 */}
      <LocationSheet
        visible={showLoc}
        onClose={() => setShowLoc(false)}
        onCreated={async (kind, id) => {
          setShowLoc(false);
          if (kind === "floor") {
            const fs = await apiCollect<Floor>("/floors", { roomId: currentRoomId });
            setFloors(fs);
            if (id) setFloorId(id);
          } else if (kind === "zone") {
            if (floorId) {
              const zs = await apiCollect<Zone>("/zones", { floorId });
              setZones(zs);
              if (id) setZoneId(id);
            }
          }
        }}
        floorId={floorId}
        currentRoomId={currentRoomId}
      />
    </Sheet>
  );
}

/* ──── 内嵌位置弹层（新建楼层 / 区域 / 机房） ──── */
function LocationSheet({
  visible, onClose, onCreated, floorId, currentRoomId,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (kind: "room" | "floor" | "zone", id: string) => void;
  floorId: string;
  currentRoomId: string;
}) {
  const [kind, setKind] = useState<"floor" | "zone">("floor");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [cols, setCols] = useState("6");
  const [rows, setRows] = useState("4");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setKind("floor"); setName(""); setCode(""); setCols("6"); setRows("4"); setBusy(false);
    }
  }, [visible]);

  const submit = async () => {
    if (!name.trim()) return Alert.alert("请填写名称");
    setBusy(true);
    try {
      if (kind === "floor") {
        const r = await apiPost<{ id: string }>("/floors", { name: name.trim(), code: code.trim() || undefined, roomId: currentRoomId });
        onCreated("floor", r.id);
      } else {
        if (!floorId) return Alert.alert("请先选择楼层");
        const r = await apiPost<{ id: string }>("/zones", {
          name: name.trim(),
          code: code.trim() || undefined,
          // 顶层 POST /zones 强制要求 roomId，缺失直接 400「缺少所属机房 roomId」
          roomId: currentRoomId,
          floorId,
          cols: Number(cols) || 6,
          rows: Number(rows) || 4,
        });
        onCreated("zone", r.id);
      }
    } catch (e: any) {
      Alert.alert("创建失败", e?.message || "操作失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={kind === "floor" ? "新建楼层" : "新建区域"} scrollable>
      <View style={styles.formRow}>
        <Text style={styles.formLabel}>类型</Text>
        <View style={styles.formChipRow}>
          <Chip label="楼层" active={kind === "floor"} onPress={() => setKind("floor")} />
          <Chip label="区域" active={kind === "zone"} onPress={() => setKind("zone")} />
        </View>
      </View>
      <View style={styles.formRow}>
        <Text style={styles.formLabel}>名称 *</Text>
        <Input value={name} onChangeText={setName} placeholder="如 6 号楼 / A 区" />
      </View>
      <View style={styles.formRow}>
        <Text style={styles.formLabel}>编码</Text>
        <Input value={code} onChangeText={setCode} placeholder="留空自动" />
      </View>
      {kind === "zone" ? (
        <View style={styles.formRowInline}>
          <View style={{ flex: 1 }}>
            <Text style={styles.formLabel}>列数</Text>
            <Input value={cols} onChangeText={setCols} placeholder="6" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.formLabel}>行数</Text>
            <Input value={rows} onChangeText={setRows} placeholder="4" />
          </View>
        </View>
      ) : null}
      <Button label={busy ? "提交中…" : "创建"} onPress={submit} loading={busy} />
    </Sheet>
  );
}