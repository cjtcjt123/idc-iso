import React, { useEffect, useMemo, useState } from "react";
import { Alert, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { apiCollect, apiList, apiPost } from "../api/client";
import type { Customer, Device, DeviceCategory, DeviceModel, DeviceType, Rack } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import {
  Badge,
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
import { customerScopeId } from "../auth/permission";

type Density = "list" | "grid";

const DEFAULT_PAGE_SIZE = 20;

// 设备类型 → 颜色（与小程序约定一致）
const TYPE_COLORS: Record<string, string> = {
  server: "#3b82f6",
  switch: "#06b6d4",
  router: "#0ea5e9",
  firewall: "#ef4444",
  storage: "#a855f7",
  ups: "#f97316",
  other: "#94a3b8",
};

function typeColorOf(t?: string): string {
  if (!t) return "#94a3b8";
  return TYPE_COLORS[t.toLowerCase()] || TYPE_COLORS.other;
}

const PLACEMENT_TONE: Record<string, { fg: string; bg: string; text: string }> = {
  mounted: { fg: theme.ok, bg: theme.okSoft, text: "上架" },
  inventory: { fg: theme.warn, bg: theme.warnSoft, text: "库存" },
  shipped: { fg: theme.text3, bg: theme.accentSoft, text: "迁出" },
};

export function DevicesScreen({ navigation }: any) {
  const { currentRoomId, user } = useAuth();
  // 客户组成员：强制只看自己客户的设备（对齐小程序 forcedCustomerId）
  const forcedCust = customerScopeId(user);
  const [devices, setDevices] = useState<Device[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [density, setDensity] = useState<Density>("list");

  // 筛选数据
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [types, setTypes] = useState<DeviceType[]>([]);
  const [categories, setCategories] = useState<DeviceCategory[]>([]);
  const [models, setModels] = useState<DeviceModel[]>([]);
  const [filterCustomerId, setFilterCustomerId] = useState<string | "">("");
  const [filterTypeId, setFilterTypeId] = useState<string | "">("");
  const [filterCategoryId, setFilterCategoryId] = useState<string | "">("");

  // 弹层状态
  const [showMount, setShowMount] = useState(false);
  const [showDismount, setShowDismount] = useState(false);

  // 业务加载器（机柜/类型）
  const [allRacks, setAllRacks] = useState<Rack[]>([]);
  const loadBusinessData = async () => {
    if (!currentRoomId) return;
    try {
      const [ts, ms, rs] = await Promise.all([
        apiCollect<DeviceType>("/device-types", { roomId: currentRoomId }),
        apiCollect<DeviceModel>("/device-models", { roomId: currentRoomId }),
        apiCollect<Rack>("/racks", { roomId: currentRoomId, pageSize: 500 }),
      ]);
      setTypes(ts);
      setModels(ms);
      setAllRacks(rs);
    } catch {
      /* 静默 */
    }
  };

  const load = async () => {
    if (!currentRoomId) {
      setLoading(false);
      return;
    }
    try {
      const res = await apiList<Device>("/devices", {
        roomId: currentRoomId,
        search: keyword || undefined,
        customerId: filterCustomerId || undefined,
        typeId: filterTypeId || undefined,
        categoryId: filterCategoryId || undefined,
        page: keyword || filterCustomerId || filterTypeId || filterCategoryId ? 1 : page,
        pageSize: pageSize === -1 ? 1000 : pageSize,
      });
      setDevices(res.data);
      setTotal(res.total);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadFilters = async () => {
    if (!currentRoomId) return;
    try {
      const [cs, ts, cs2, ms] = await Promise.all([
        apiCollect<Customer>("/customers", { pageSize: 200 }),
        apiCollect<DeviceType>("/device-types", { roomId: currentRoomId }),
        apiCollect<DeviceCategory>("/device-categories", { roomId: currentRoomId }),
        apiCollect<DeviceModel>("/device-models", { roomId: currentRoomId }),
      ]);
      setCustomers(cs);
      setTypes(ts);
      setCategories(cs2);
      setModels(ms);
    } catch {
      /* 筛选失败不阻塞主列表 */
    }
  };

  useEffect(() => {
    load();
    loadFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRoomId, page, pageSize]);

  // 搜索/筛选改动 → 跳回第 1 页（用 ref 避免依赖环）
  useEffect(() => {
    setPage(1);
    setRefreshing(true);
    (async () => {
      if (!currentRoomId) return;
      try {
        const res = await apiList<Device>("/devices", {
          roomId: currentRoomId,
          search: keyword || undefined,
          customerId: forcedCust || filterCustomerId || undefined,
          typeId: filterTypeId || undefined,
          categoryId: filterCategoryId || undefined,
          page: 1,
          pageSize: pageSize === -1 ? 1000 : pageSize,
        });
        setDevices(res.data);
        setTotal(res.total);
      } finally {
        setRefreshing(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword, filterCustomerId, filterTypeId, filterCategoryId]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / (pageSize === -1 ? Math.max(total, 1) : pageSize))),
    [total, pageSize]
  );

  // 客户组成员强制作用域：前端兜底只显示自己客户的设备
  const visibleDevices = useMemo(
    () => (forcedCust ? devices.filter((d) => !d.customerId || d.customerId === forcedCust) : devices),
    [devices, forcedCust]
  );

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
      <SearchBar
        value={keyword}
        onChangeText={setKeyword}
        placeholder="搜索名称 / SN / 资产编号 / IP"
      />

      {/* 筛选：客户 / 类型 / 分类 */}
      <View style={styles.filterRow}>
        <Chip
          label={filterCustomerId ? customers.find((c) => c.id === filterCustomerId)?.name || "客户" : "客户"}
          active={!!filterCustomerId}
          dropdown
          onPress={() => cyclePick(customers, filterCustomerId, setFilterCustomerId, "name")}
        />
        <Chip
          label={filterTypeId ? types.find((t) => t.id === filterTypeId)?.name || "类型" : "类型"}
          active={!!filterTypeId}
          dropdown
          onPress={() => cyclePick(types, filterTypeId, setFilterTypeId, "name")}
        />
        <Chip
          label={filterCategoryId ? categories.find((c) => c.id === filterCategoryId)?.name || "分类" : "分类"}
          active={!!filterCategoryId}
          dropdown
          onPress={() => cyclePick(categories, filterCategoryId, setFilterCategoryId, "name")}
        />
      </View>

      {/* 工具条 */}
      <View style={styles.toolbar}>
        <Count total={total} label="台" />
        <View style={{ flex: 1 }} />
        <ToolBtn label={density === "grid" ? "☰ 单列" : "⊞ 双列"} onPress={() => setDensity((d) => (d === "grid" ? "list" : "grid"))} />
        <ToolBtn label="＋ 上架" tone="primary" onPress={() => { loadBusinessData(); setShowMount(true); }} />
        <ToolBtn label="⤓ 下架" tone="warn" onPress={() => setShowDismount(true)} />
      </View>

      {/* 设备列表 */}
      <FlatList
        data={visibleDevices}
        keyExtractor={(d) => d.id}
        numColumns={density === "grid" ? 2 : 1}
        key={density}
        columnWrapperStyle={density === "grid" ? styles.gridRow : undefined}
        contentContainerStyle={{ paddingBottom: 20 }}
        renderItem={({ item }) =>
          density === "grid" ? (
            <DeviceCardSm item={item} onPress={() => navigation.navigate("DeviceDetail", { deviceId: item.id })} />
          ) : (
            <DeviceCardFull item={item} onPress={() => navigation.navigate("DeviceDetail", { deviceId: item.id })} />
          )
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListEmptyComponent={
          !loading ? <EmptyState text={keyword || filterCustomerId ? "无匹配设备" : "该机房暂无设备"} /> : null
        }
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

      {/* 上架弹层 */}
      <MountSheet
        visible={showMount}
        onClose={() => setShowMount(false)}
        onDone={() => {
          setShowMount(false);
          load();
        }}
        currentRoomId={currentRoomId!}
        customers={customers}
        racks={allRacks}
        types={types}
        models={models}
      />

      {/* 下架弹层 */}
      <DismountSheet
        visible={showDismount}
        onClose={() => setShowDismount(false)}
        onDone={() => {
          setShowDismount(false);
          load();
        }}
        currentRoomId={currentRoomId!}
      />
    </View>
  );
}

/* 在客户/类型/分类间轮转（点击 chip 依次切换：全部 → 选项1 → 选项2 → ... → 全部） */
function cyclePick<T extends { id: string }>(items: T[], cur: string | "", set: (v: string | "") => void, _labelKey: keyof T) {
  if (!items.length) {
    set(cur ? "" : "");
    return;
  }
  const idx = items.findIndex((i) => i.id === cur);
  const next = idx < 0 ? items[0].id : idx >= items.length - 1 ? "" : items[idx + 1].id;
  set(next);
}

function ToolBtn({ label, onPress, tone }: { label: string; onPress: () => void; tone?: "primary" | "warn" | "default" }) {
  const bg = tone === "primary" ? theme.accent : tone === "warn" ? theme.warnSoft : theme.surfaceAlt;
  const fg = tone === "primary" ? "#fff" : tone === "warn" ? theme.warn : theme.text1;
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={[styles.toolBtn, { backgroundColor: bg }]}>
      <Text style={[styles.toolBtnText, { color: fg }]}>{label}</Text>
    </TouchableOpacity>
  );
}

/* 4 段式完整卡：色条 + 型号/状态 + SN·类型·U高 + 位置/客户 */
function DeviceCardFull({ item, onPress }: { item: Device; onPress: () => void }) {
  const tone = PLACEMENT_TONE[item.placement || ""] || PLACEMENT_TONE.mounted;
  const tColor = item.typeColor || typeColorOf(item.type);
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.dvCard}>
      <View style={[styles.dvBar, { backgroundColor: tColor }]} />
      <View style={styles.dvBody}>
        <View style={styles.dvLine1}>
          <Text style={styles.dvModel} numberOfLines={1}>
            {item.modelName || item.name || item.sn || "未命名设备"}
          </Text>
          <Badge label={tone.text} color={tone.fg} />
        </View>
        <View style={styles.dvLine2}>
          <Text style={styles.dvSn} numberOfLines={1}>
            {item.sn || "—"}
          </Text>
          {item.type ? (
            <>
              <Text style={styles.dvDot}>·</Text>
              <Text style={[styles.dvType, { color: tColor }]}>{item.type}</Text>
            </>
          ) : null}
          {item.uHeight ? (
            <>
              <Text style={styles.dvDot}>·</Text>
              <Text style={styles.dvU}>{item.uHeight}U</Text>
            </>
          ) : null}
        </View>
        <View style={styles.dvLine3}>
          <Text style={styles.dvLoc} numberOfLines={1}>
            {item.rackText || (item.rackCode ? `${item.rackCode}` : "未上架")}
            {item.uText && item.uText !== "—" ? ` · ${item.uText}` : ""}
          </Text>
          <Text style={styles.dvCust} numberOfLines={1}>
            {item.customerName || "散户"}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

/* 双列精简卡：色条 + 型号/状态 + SN + 位置/客户（去除 U 高行） */
function DeviceCardSm({ item, onPress }: { item: Device; onPress: () => void }) {
  const tone = PLACEMENT_TONE[item.placement || ""] || PLACEMENT_TONE.mounted;
  const tColor = item.typeColor || typeColorOf(item.type);
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={[styles.dvCard, styles.dvCardSm]}>
      <View style={[styles.dvBar, { backgroundColor: tColor }]} />
      <View style={styles.dvBody}>
        <View style={styles.dvLine1}>
          <Text style={styles.dvModel} numberOfLines={1}>
            {item.modelName || item.name || item.sn || "未命名设备"}
          </Text>
          <Badge label={tone.text} color={tone.fg} />
        </View>
        <Text style={styles.dvSn} numberOfLines={1}>
          {item.sn || "—"}
        </Text>
        <Text style={styles.dvLoc} numberOfLines={1}>
          {item.rackText || "未上架"}
        </Text>
        <Text style={styles.dvCust} numberOfLines={1}>
          {item.customerName || "散户"}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 6,
    flexWrap: "wrap",
  },
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

  gridRow: { justifyContent: "space-between", paddingHorizontal: 16 },

  /* 4 段式设备卡 */
  dvCard: {
    flexDirection: "row",
    backgroundColor: theme.surface,
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 5,
    overflow: "hidden",
    shadowColor: "#101828",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  dvCardSm: {
    flex: 1,
    marginHorizontal: 4,
    minWidth: 0,
  },
  dvBar: { width: 4 },
  dvBody: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, minWidth: 0 },
  dvLine1: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  dvModel: { fontSize: 14, fontWeight: "700", color: theme.text1, flex: 1, minWidth: 0 },
  dvLine2: { flexDirection: "row", alignItems: "center", marginTop: 5, gap: 4 },
  dvSn: { fontSize: 11, color: theme.text2, flexShrink: 1 },
  dvDot: { fontSize: 11, color: theme.text3 },
  dvType: { fontSize: 11, fontWeight: "700" },
  dvU: { fontSize: 11, color: theme.text2 },
  dvLine3: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    gap: 6,
  },
  dvLoc: { fontSize: 11, color: theme.text2, flex: 1, minWidth: 0 },
  dvCust: { fontSize: 11, color: theme.accent, fontWeight: "600", maxWidth: 100 },

  /* ── 弹层表单（Mount/Dismount） ── */
  formRow: { marginBottom: 12 },
  formRowInline: { flexDirection: "row", gap: 8, marginBottom: 12 },
  formLabel: { fontSize: 13, color: theme.text2, marginBottom: 6, fontWeight: "600" },
  formChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  formHint: { fontSize: 11, color: theme.text3, marginTop: 4 },
  snList: { marginTop: 6, gap: 4 },
  snItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: theme.surfaceAlt,
    borderRadius: 8,
  },
  snItemText: { fontSize: 12, color: theme.text1, fontWeight: "600" },
  snItemSub: { fontSize: 11, marginTop: 2 },
  snItemRemove: { fontSize: 14, color: theme.danger, paddingHorizontal: 4 },
});

/* ──── 上架弹层 ──── */
function MountSheet({
  visible, onClose, onDone,
  currentRoomId, customers, racks, types, models,
}: {
  visible: boolean;
  onClose: () => void;
  onDone: () => void;
  currentRoomId: string;
  customers: Customer[];
  racks: Rack[];
  types: DeviceType[];
  models: DeviceModel[];
}) {
  const [customerId, setCustomerId] = useState<string | "">("");
  const [sn, setSn] = useState("");
  const [rackId, setRackId] = useState<string | "">("");
  const [uPosition, setUPosition] = useState("");
  const [typeId, setTypeId] = useState<string | "">("");
  const [modelId, setModelId] = useState<string | "">("");
  const [busy, setBusy] = useState(false);

  // 每次打开清空
  useEffect(() => {
    if (visible) {
      setCustomerId(""); setSn(""); setRackId(""); setUPosition("");
      setTypeId(""); setModelId(""); setBusy(false);
    }
  }, [visible]);

  const submit = async () => {
    if (!customerId) return Alert.alert("请选择客户");
    if (!sn.trim()) return Alert.alert("请填写设备 SN");
    if (!rackId) return Alert.alert("请选择上架机柜");
    const u = Number(uPosition);
    if (!Number.isInteger(u) || u < 1) return Alert.alert("请填写 U 位（≥1 整数）");
    setBusy(true);
    try {
      await apiPost("/devices", {
        sn: sn.trim(),
        customerId,
        roomId: currentRoomId,
        rackId,
        uPosition: u,
        typeId: typeId || undefined,
        modelId: modelId || undefined,
      });
      onDone();
    } catch (e: any) {
      Alert.alert("上架失败", e?.message || "操作失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="上架设备" scrollable>
      <View style={styles.formRow}>
        <Text style={styles.formLabel}>归属客户 *</Text>
        <View style={styles.formChipRow}>
          {customers.length === 0 ? <Text style={styles.formHint}>暂无可选客户</Text> : null}
          {customers.map((c) => (
            <Chip key={c.id} label={c.name} active={customerId === c.id} onPress={() => setCustomerId(customerId === c.id ? "" : c.id)} />
          ))}
        </View>
      </View>

      <View style={styles.formRow}>
        <Text style={styles.formLabel}>序列号 SN *</Text>
        <Input value={sn} onChangeText={setSn} placeholder="设备 SN" />
      </View>

      <View style={styles.formRow}>
        <Text style={styles.formLabel}>上架机柜 *</Text>
        <View style={styles.formChipRow}>
          {racks.length === 0 ? <Text style={styles.formHint}>当前机房无可上架机柜，请先在「机柜」页新建</Text> : null}
          {racks.map((r) => (
            <Chip
              key={r.id}
              label={r.code + (r.uHeight ? ` ${r.uHeight}U` : "")}
              active={rackId === r.id}
              onPress={() => setRackId(rackId === r.id ? "" : r.id)}
            />
          ))}
        </View>
      </View>

      <View style={styles.formRow}>
        <Text style={styles.formLabel}>起始 U 位 *</Text>
        <Input value={uPosition} onChangeText={setUPosition} placeholder="自下而上，如 10" />
      </View>

      {types.length > 0 ? (
        <View style={styles.formRow}>
          <Text style={styles.formLabel}>设备类型</Text>
          <View style={styles.formChipRow}>
            <Chip label="不限" active={!typeId} onPress={() => setTypeId("")} />
            {types.map((t) => (
              <Chip key={t.id} label={t.name} active={typeId === t.id} onPress={() => setTypeId(typeId === t.id ? "" : t.id)} />
            ))}
          </View>
        </View>
      ) : null}

      {models.length > 0 ? (
        <View style={styles.formRow}>
          <Text style={styles.formLabel}>设备型号</Text>
          <View style={styles.formChipRow}>
            <Chip label="不限" active={!modelId} onPress={() => setModelId("")} />
            {models.map((m) => (
              <Chip key={m.id} label={m.name} active={modelId === m.id} onPress={() => setModelId(modelId === m.id ? "" : m.id)} />
            ))}
          </View>
        </View>
      ) : null}

      <Button label={busy ? "提交中…" : "确认上架"} onPress={submit} loading={busy} />
    </Sheet>
  );
}

/* ──── 下架弹层（按 SN 批量 → 解析为设备 UUID 后提交） ──── */
type DismountItem = {
  sn: string;
  deviceId: string | null;
  label: string; // 解析结果说明
  ok: boolean; // 是否已解析到「已上架」设备
};

function DismountSheet({
  visible, onClose, onDone, currentRoomId,
}: {
  visible: boolean;
  onClose: () => void;
  onDone: () => void;
  currentRoomId: string;
}) {
  const [snInput, setSnInput] = useState("");
  const [items, setItems] = useState<DismountItem[]>([]);
  const [reason, setReason] = useState("");
  const [destination, setDestination] = useState<"inventory" | "shipped">("inventory");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setSnInput(""); setItems([]); setReason(""); setDestination("inventory"); setBusy(false);
    }
  }, [visible]);

  /**
   * SN → 设备 UUID。
   * 后端 BatchDismountDto 的 deviceIds 是 @IsUUID("4", { each: true })，直接传 SN 必然 400；
   * 且设备必须已在机柜上（!rackId 会被后端拒绝）。
   */
  const resolveSn = async (sn: string): Promise<DismountItem> => {
    try {
      // 坑：/devices 的 search 与 roomId 共用同一 OR key，同时传搜索会静默失效 → 只传 search，客户端再按机房过滤
      const res = await apiList<Device>("/devices", { search: sn, pageSize: 50 });
      const hit = (res.data || []).find(
        (d) => (d.sn || "").toLowerCase() === sn.toLowerCase() && (!d.roomId || d.roomId === currentRoomId)
      );
      if (!hit) return { sn, deviceId: null, label: "未找到该 SN", ok: false };
      if (!hit.rackId) return { sn, deviceId: hit.id, label: "未在机柜上，无需下架", ok: false };
      return { sn, deviceId: hit.id, label: hit.rackText || hit.rackCode || "已上架", ok: true };
    } catch (e: any) {
      return { sn, deviceId: null, label: "查询失败", ok: false };
    }
  };

  const addSn = async () => {
    const s = snInput.trim();
    if (!s || busy) return;
    if (items.some((i) => i.sn.toLowerCase() === s.toLowerCase())) {
      setSnInput("");
      return;
    }
    setSnInput("");
    setBusy(true);
    const item = await resolveSn(s);
    setItems((prev) => [...prev, item]);
    setBusy(false);
  };

  const submit = async () => {
    if (items.length === 0) return Alert.alert("请输入至少一个设备 SN");
    const bad = items.filter((i) => !i.ok);
    if (bad.length > 0) {
      return Alert.alert("以下 SN 无法下架", bad.map((i) => `${i.sn}（${i.label}）`).join("\n"));
    }
    if (!reason.trim()) return Alert.alert("请填写下架原因");
    const deviceIds = [...new Set(items.map((i) => i.deviceId!))];
    if (deviceIds.length > 200) return Alert.alert("单次最多下架 200 台");
    setBusy(true);
    try {
      await apiPost("/devices/batch-dismount", {
        deviceIds,
        reason: reason.trim(),
        destination,
      });
      onDone();
    } catch (e: any) {
      Alert.alert("下架失败", e?.message || "操作失败");
    } finally {
      setBusy(false);
    }
  };

  const okCount = items.filter((i) => i.ok).length;

  return (
    <Sheet visible={visible} onClose={onClose} title="批量下架" scrollable>
      <Text style={styles.formHint}>依次输入设备 SN 加入下架队列（会自动解析为设备），填写去向与原因后提交</Text>

      <View style={[styles.formRowInline, { marginTop: 10 }]}>
        <View style={{ flex: 1 }}>
          <Input value={snInput} onChangeText={setSnInput} placeholder="设备 SN" />
        </View>
        <TouchableOpacity onPress={addSn} style={styles.toolBtn}>
          <Text style={styles.toolBtnText}>{busy ? "…" : "追加"}</Text>
        </TouchableOpacity>
      </View>

      {items.length > 0 ? (
        <View style={styles.snList}>
          {items.map((it) => (
            <View key={it.sn} style={styles.snItem}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.snItemText}>{it.sn}</Text>
                <Text style={[styles.snItemSub, { color: it.ok ? theme.text3 : theme.danger }]}>{it.label}</Text>
              </View>
              <TouchableOpacity onPress={() => setItems(items.filter((x) => x.sn !== it.sn))}>
                <Text style={styles.snItemRemove}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : null}

      <View style={[styles.formRow, { marginTop: 12 }]}>
        <Text style={styles.formLabel}>去向</Text>
        <View style={styles.formChipRow}>
          <Chip label="回库存" active={destination === "inventory"} onPress={() => setDestination("inventory")} />
          <Chip label="迁出" active={destination === "shipped"} onPress={() => setDestination("shipped")} />
        </View>
      </View>

      <View style={styles.formRow}>
        <Text style={styles.formLabel}>下架原因 *</Text>
        <Input value={reason} onChangeText={setReason} placeholder="必填" />
      </View>

      <Button label={busy ? "提交中…" : `确认下架 (${okCount})`} onPress={submit} loading={busy} danger />
    </Sheet>
  );
}