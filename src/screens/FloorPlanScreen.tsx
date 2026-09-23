import React, { useEffect, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { apiCollect, apiDelete, apiGet, apiList, apiPatch, apiPost, apiPut } from "../api/client";
import type { Floor, Rack, Room, Zone, ZoneGrid } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { useCan } from "../auth/permission";
import { EmptyState, Input, ListRow, Loading, Sheet } from "../components/ui";
import { theme } from "../theme";

/** 对齐小程序 room-floor.ts 的 KIND_OPTIONS：种类 + 默认名前缀 + 固定色 */
const KIND_OPTIONS: { value: string; label: string; prefix: string; color: string }[] = [
  { value: "it", label: "IT机柜", prefix: "R", color: "#3b82f6" },
  { value: "ups", label: "UPS柜", prefix: "UPS", color: "#f97316" },
  { value: "ac", label: "列间空调", prefix: "AC", color: "#22c55e" },
  { value: "pdu", label: "配电柜", prefix: "PDU", color: "#a855f7" },
  { value: "odf", label: "ODF柜", prefix: "ODF", color: "#06b6d4" },
  { value: "door", label: "移门", prefix: "M", color: "#ef4444" },
];
const KIND_LABEL: Record<string, string> = {
  it: "IT机柜", ups: "UPS", ac: "空调", pdu: "配电", odf: "ODF", door: "移门",
};
const KIND_COLOR: Record<string, string> = {
  it: "#3b82f6", ups: "#f97316", ac: "#22c55e", pdu: "#a855f7", odf: "#06b6d4", door: "#ef4444",
};
const U_OF: Record<string, number> = { it: 42, ups: 42, ac: 42, pdu: 42, odf: 42, door: 1 };
const PH_COLOR = "#a855f7";

const UTIL_OK = "#22c55e";
const UTIL_WARN = "#f79009";
const UTIL_HI = "#e54d42";
function utilColor(pct: number): string {
  return pct >= 80 ? UTIL_HI : pct >= 50 ? UTIL_WARN : UTIL_OK;
}

type GridCell = {
  col: number;
  row: number;
  occupied: boolean;
  rackId?: string;
  rackName?: string;
  kind?: string;
  utilization?: number;
  status?: string;
  customerId?: string | null;
  customerName?: string | null;
  temperature?: number | null;
  humidity?: number | null;
  isPlaceholder?: boolean;
  placeholderId?: string;
};
type CellItem =
  | { kind: "cell"; cell: GridCell }
  | { kind: "merged"; startRow: number; span: number; sample: { col: number; row: number } };
type Column =
  | { type: "aisle"; boundary: number; wall: boolean; t: "cold" | "hot" }
  | { type: "rack"; col: number; items: CellItem[] };

function emptyCell(col: number, row: number): GridCell {
  return { col, row, occupied: false };
}

/** 列向布局：机柜列与通道列交替；列内连续空格合并成一块（对齐小程序 merged-empty） */
function buildColumns(
  cols: number,
  rows: number,
  cells: Map<string, GridCell>,
  cold: number[],
  hot: number[]
): Column[] {
  const aisleType = (b: number): "cold" | "hot" => {
    if (cold.includes(b)) return "cold";
    if (hot.includes(b)) return "hot";
    if (b === 0 || b === cols) return "hot";
    return b % 2 === 1 ? "cold" : "hot";
  };
  const out: Column[] = [];
  out.push({ type: "aisle", boundary: 0, wall: true, t: aisleType(0) });
  for (let c = 0; c < cols; c++) {
    const items: CellItem[] = [];
    let runStart = -1;
    let runLen = 0;
    const flush = () => {
      if (runLen > 0) {
        if (runLen === 1) items.push({ kind: "cell", cell: emptyCell(c, runStart) });
        else
          items.push({
            kind: "merged",
            startRow: runStart,
            span: runLen,
            sample: { col: c, row: runStart },
          });
        runStart = -1;
        runLen = 0;
      }
    };
    for (let r = 1; r <= rows; r++) {
      const cell = cells.get(`${c}-${r}`);
      if (cell) {
        flush();
        items.push({ kind: "cell", cell });
      } else {
        if (runStart < 0) runStart = r;
        runLen++;
      }
    }
    flush();
    out.push({ type: "rack", col: c, items });
    out.push({ type: "aisle", boundary: c + 1, wall: c + 1 === cols, t: aisleType(c + 1) });
  }
  return out;
}

type RackPick = { id: string; name?: string; code?: string; sub: string; customerName?: string };
type SheetKind =
  | "nav" | "customer" | "cell" | "kind" | "name" | "rackPick" | "rackAct" | "phAct" | "zone";

export function FloorPlanScreen({ navigation }: any) {
  const { currentRoomId } = useAuth();
  const can = useCan();
  const canEditRack = can("rack", "update") || can("rack", "create");
  const canCreateRoom = can("room", "create");

  const [roomName, setRoomName] = useState("");
  const [floors, setFloors] = useState<Floor[]>([]);
  const [floorId, setFloorId] = useState<string | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [grid, setGrid] = useState<ZoneGrid | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [customers, setCustomers] = useState<{ id: string; name?: string }[]>([]);
  const [filterCustomerId, setFilterCustomerId] = useState("");
  const [showUtil, setShowUtil] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const [sheet, setSheet] = useState<SheetKind | null>(null);
  const [pendingCell, setPendingCell] = useState<{ col: number; row: number } | null>(null);
  const [pendingIsPlaceholder, setPendingIsPlaceholder] = useState(false);
  const [pendingKind, setPendingKind] = useState("it");
  const [newName, setNewName] = useState("");
  const [rackPickList, setRackPickList] = useState<RackPick[]>([]);
  const [moving, setMoving] = useState<{ id: string; name: string } | null>(null);
  const [rackTarget, setRackTarget] = useState<{ id: string; name: string } | null>(null);
  const [phTarget, setPhTarget] = useState<{ id: string; name: string } | null>(null);
  const [inspect, setInspect] = useState<GridCell | null>(null);
  const [confirming, setConfirming] = useState<"rack" | "ph" | null>(null);
  const [zName, setZName] = useState("");
  const [zCols, setZCols] = useState("");
  const [zRows, setZRows] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!currentRoomId) { setLoading(false); return; }
    (async () => {
      try {
        const rooms = await apiList<Room>("/rooms", { pageSize: 100 });
        const cur = rooms.data.find((r) => r.id === currentRoomId);
        if (cur) setRoomName(cur.name || "");
        const [fl, cs] = await Promise.all([
          apiCollect<Floor>("/floors", { roomId: currentRoomId }),
          apiCollect<{ id: string; name?: string }>("/customers"),
        ]);
        setFloors(fl);
        setCustomers(cs);
        if (fl.length) setFloorId(fl[0].id);
      } finally { setLoading(false); }
    })();
  }, [currentRoomId]);

  useEffect(() => {
    if (!floorId) { setZones([]); setZoneId(null); setGrid(null); return; }
    (async () => {
      const zs = await apiCollect<Zone>("/zones", { floorId });
      setZones(zs);
      if (zs.length) setZoneId(zs[0].id); else { setZoneId(null); setGrid(null); }
    })();
  }, [floorId]);

  const loadGrid = async () => {
    if (!zoneId) { setGrid(null); setRefreshing(false); return; }
    try { const g = await apiGet<ZoneGrid>(`/zones/${zoneId}/grid`); setGrid(g); }
    finally { setRefreshing(false); }
  };
  useEffect(() => { loadGrid(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [zoneId]);

  if (loading) return <Loading />;
  if (!currentRoomId)
    return (
      <View style={styles.center}>
        <EmptyState text="请先在「我的」页选择当前机房" />
      </View>
    );

  const cols = grid?.zone.cols ?? 0;
  const rows = grid?.zone.rows ?? 0;
  const rawRacks = grid?.racks ?? [];
  const placeholders = grid?.placeholders ?? [];

  const cells = new Map<string, GridCell>();
  for (const r of rawRacks) {
    const col = r.col ?? 0;
    const row = r.row ?? 0;
    cells.set(`${col}-${row}`, {
      col, row, occupied: true, rackId: r.id,
      rackName: r.code || r.name || "", kind: r.kind,
      utilization: r.utilization, status: r.status,
      customerId: r.customerId, customerName: r.customerName,
      temperature: r.temperature, humidity: r.humidity,
      isPlaceholder: false,
    });
  }
  for (const p of placeholders) {
    cells.set(`${p.col}-${p.row}`, {
      col: p.col, row: p.row, occupied: true, isPlaceholder: true, placeholderId: p.id,
      rackName: p.label || KIND_LABEL[p.type || ""] || "占位", kind: p.type,
    });
  }
  const columns = buildColumns(cols, rows, cells, grid?.zone.coldAisles ?? [], grid?.zone.hotAisles ?? []);

  const used = rawRacks.filter((r) => (r.utilization ?? 0) > 0).length;
  const warnings = rawRacks.filter((r) => r.status === "warning" || r.status === "critical").length;
  const filterName = filterCustomerId
    ? customers.find((c) => c.id === filterCustomerId)?.name || "所选客户"
    : "全部客户";

  /** 该格是否因客户筛选而变暗（对齐小程序 dimmed） */
  const dimmedOf = (cell: GridCell): boolean =>
    !!filterCustomerId && !cell.isPlaceholder && cell.customerId !== filterCustomerId;

  // ── 交互 ──
  const onCellPress = (cell: GridCell) => {
    // 移动模式：点空格落位
    if (moving) {
      if (cell.occupied) { setMoving(null); return; }
      const mv = moving;
      setMoving(null);
      apiPatch(`/racks/${mv.id}`, {
        col: cell.col, row: cell.row, zoneId: zoneId!, floorId: floorId!, roomId: currentRoomId!,
      })
        .then(() => loadGrid())
        .catch((e: any) => Alert.alert("移动失败", e?.message || ""));
      return;
    }
    if (!cell.occupied) {
      if (!editMode) return;
      if (!canEditRack && !canCreateRoom) { Alert.alert("没有权限", "需要机柜或机房创建权限"); return; }
      setPendingCell({ col: cell.col, row: cell.row });
      setSheet("cell");
      return;
    }
    if (cell.isPlaceholder) {
      if (!editMode || !canCreateRoom) return;
      setPhTarget({ id: cell.placeholderId || "", name: cell.rackName || "占位块" });
      setConfirming(null);
      setSheet("phAct");
      return;
    }
    if (editMode) {
      if (!canEditRack) { Alert.alert("没有权限", "需要机柜编辑权限"); return; }
      setRackTarget({ id: cell.rackId || "", name: cell.rackName || "机柜" });
      setConfirming(null);
      setSheet("rackAct");
    } else {
      setInspect(cell);
    }
  };
  const onMergedPress = (it: Extract<CellItem, { kind: "merged" }>) => {
    onCellPress(emptyCell(it.sample.col, it.startRow));
  };
  const onAisle = (boundary: number, cur: "cold" | "hot") => {
    if (!editMode || !canCreateRoom) return;
    const cold = grid?.zone.coldAisles ?? [];
    const hot = grid?.zone.hotAisles ?? [];
    const nc = cur === "cold" ? cold.filter((x) => x !== boundary) : [...cold, boundary];
    const nh = cur === "cold" ? [...hot, boundary] : hot.filter((x) => x !== boundary);
    apiPut(`/zones/${zoneId}/aisles`, { cold: nc, hot: nh })
      .then(() => loadGrid())
      .catch((e: any) => Alert.alert("切换失败", e?.message || ""));
  };

  /** 空格「摆放机柜」：列出本机房已建且未摆在本网格的机柜 */
  const openRackPicker = async (col: number, row: number) => {
    try {
      const res = await apiList<Rack>("/racks", { roomId: currentRoomId, pageSize: 200 });
      const placedIds = new Set(rawRacks.map((r) => r.id));
      const zoneNameMap: Record<string, string> = {};
      zones.forEach((z) => { zoneNameMap[z.id] = z.name || ""; });
      const list: RackPick[] = (res.data || [])
        .filter((r) => !placedIds.has(r.id))
        .map((r) => ({
          id: r.id, name: r.name, code: r.code,
          sub: !r.zoneId ? "未摆放" : r.zoneId === zoneId ? "本区域" : zoneNameMap[r.zoneId] || "其他区域",
          customerName: r.customerName || "",
        }));
      setPendingCell({ col, row });
      if (list.length === 0) { openKindPicker(col, row, false); return; }
      setRackPickList(list);
      setSheet("rackPick");
    } catch (_e) {
      Alert.alert("加载机柜失败", "");
    }
  };
  const pickRack = (rackId: string) => {
    const cell = pendingCell;
    setSheet(null);
    if (!cell) return;
    apiPatch(`/racks/${rackId}`, {
      col: cell.col, row: cell.row, zoneId: zoneId!, floorId: floorId!, roomId: currentRoomId!,
    })
      .then(() => loadGrid())
      .catch((e: any) => Alert.alert("摆放失败", e?.message || ""));
  };
  /** 打开种类选择器（新建机柜 / 新建占位块 共用） */
  const openKindPicker = (col: number, row: number, isPh: boolean) => {
    setPendingCell({ col, row });
    setPendingIsPlaceholder(isPh);
    setSheet("kind");
  };
  const onPickKind = (kind: string) => {
    const opt = KIND_OPTIONS.find((o) => o.value === kind) || KIND_OPTIONS[0];
    setPendingKind(kind);
    setNewName(`${opt.prefix}-${String(pendingCell?.row ?? 1).padStart(2, "0")}`);
    setSheet("name");
  };
  const submitName = () => {
    const cell = pendingCell;
    if (!cell) return;
    const name = newName.trim();
    if (!name) { Alert.alert("名称不能为空"); return; }
    setBusy(true);
    const req = pendingIsPlaceholder
      ? apiPost(`/zones/${zoneId}/placeholders`, { col: cell.col, row: cell.row, type: pendingKind, label: name })
      : apiPost(`/rooms/${currentRoomId}/racks`, {
          name, roomId: currentRoomId, floorId, zoneId,
          col: cell.col, row: cell.row,
          uHeight: U_OF[pendingKind] || 42, kind: pendingKind,
        });
    req
      .then(() => { setSheet(null); setNewName(""); loadGrid(); })
      .catch((e: any) => Alert.alert("创建失败", e?.message || ""))
      .finally(() => setBusy(false));
  };
  const removeRack = () => {
    const t = rackTarget;
    setSheet(null);
    setConfirming(null);
    if (!t) return;
    apiPatch(`/racks/${t.id}`, { zoneId: null, col: null, row: null })
      .then(() => loadGrid())
      .catch((e: any) => Alert.alert("移出失败", e?.message || ""));
  };
  const removePlaceholder = () => {
    const t = phTarget;
    setSheet(null);
    setConfirming(null);
    if (!t) return;
    apiDelete(`/zones/${zoneId}/placeholders/${t.id}`)
      .then(() => loadGrid())
      .catch((e: any) => Alert.alert("移除失败", e?.message || ""));
  };
  const createZone = () => {
    const c = Number(zCols);
    const r = Number(zRows);
    if (!zName.trim() || !c || !r) { Alert.alert("请填写区域名、列数、行数"); return; }
    setBusy(true);
    apiPost("/zones", { name: zName.trim(), roomId: currentRoomId, floorId, cols: c, rows: r })
      .then(() => { setSheet(null); setZName(""); setZCols(""); setZRows(""); })
      .catch((e: any) => Alert.alert("创建失败", e?.message || ""))
      .finally(() => setBusy(false));
  };
  const goVisual = (rackId: string, code?: string) => {
    setSheet(null);
    setInspect(null);
    navigation.navigate("RackDetail", { rackId, rackCode: code });
  };

  const cellH = showUtil ? 78 : 46;

  return (
    <View style={styles.page}>
      {/* 面包屑：机房 / 楼层 / 区域（对齐小程序 crumb） */}
      <TouchableOpacity style={styles.crumb} onPress={() => setSheet("nav")}>
        <Text style={styles.crumbTxt} numberOfLines={1}>
          {roomName || "未选择机房"}
          <Text style={styles.crumbSep}> / </Text>
          {floors.find((f) => f.id === floorId)?.name || "—"}
          <Text style={styles.crumbSep}> / </Text>
          {zones.find((z) => z.id === zoneId)?.name || "—"}
        </Text>
        <Text style={styles.crumbSwitch}>切换 ▾</Text>
      </TouchableOpacity>

      {/* 工具行：客户筛选 + 使用率 + 布局 */}
      <View style={styles.toolRow}>
        <TouchableOpacity onPress={() => setSheet("customer")}>
          <View style={styles.toolPill}>
            <Text style={styles.toolPillTxt} numberOfLines={1}>{filterName} ▾</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toolPill, showUtil && styles.toolPillOn]}
          onPress={() => setShowUtil((v) => !v)}
        >
          <Text style={[styles.toolPillTxt, showUtil && styles.toolPillTxtOn]}>使用率</Text>
        </TouchableOpacity>
        {canEditRack || canCreateRoom ? (
          <TouchableOpacity
            style={[styles.toolEdit, editMode && styles.toolEditOn]}
            onPress={() => { setEditMode((v) => !v); setMoving(null); }}
          >
            <Text style={[styles.toolEditText, editMode && styles.toolEditTextOn]}>
              {editMode ? "完成" : "布局"}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* 统计卡 5 宫格 */}
      <View style={styles.statRow}>
        <Stat label="机柜" value={rawRacks.length} />
        <Stat label="使用中" value={used} color={theme.ok} />
        <Stat label="空闲" value={rawRacks.length - used} color={theme.text3} />
        <Stat label="占位" value={placeholders.length} color={theme.purple} />
        <Stat label="告警" value={warnings} color={theme.danger} />
      </View>

      {moving ? (
        <View style={styles.movingBar}>
          <Text style={styles.movingTxt} numberOfLines={1}>已选中「{moving.name}」，点空格落位</Text>
          <TouchableOpacity onPress={() => setMoving(null)}>
            <Text style={styles.movingCancel}>取消</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.gridScroll}
        contentContainerStyle={styles.gridPad}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadGrid} tintColor={theme.accent} />}
      >
        {cols > 0 && rows > 0 ? (
          <View style={styles.floor}>
            {columns.map((col, i) =>
              col.type === "aisle" ? (
                <TouchableOpacity
                  key={`a${i}`}
                  activeOpacity={editMode && canCreateRoom ? 0.6 : 1}
                  onPress={() => onAisle(col.boundary, col.t)}
                  style={[
                    styles.aisle,
                    col.wall && styles.aisleWall,
                    { backgroundColor: col.t === "cold" ? "#e8f2fe" : "#fef3e2" },
                  ]}
                >
                  <Text style={styles.aisleLabel}>{col.t === "cold" ? "冷通道" : "热通道"}</Text>
                  {col.wall ? <Text style={styles.wallTag}>靠墙</Text> : null}
                  <Text style={styles.aisleArrow}>{col.t === "cold" ? "⇅" : "▲"}</Text>
                </TouchableOpacity>
              ) : (
                <View key={`r${i}`} style={styles.rackCol}>
                  {col.items.map((it, j) => {
                    if (it.kind === "merged") {
                      return (
                        <TouchableOpacity
                          key={j}
                          activeOpacity={editMode ? 0.6 : 1}
                          onPress={() => onMergedPress(it)}
                          style={[
                            styles.cell, styles.cellEmpty,
                            { height: it.span * (cellH + 6) - 6 },
                            editMode && styles.cellEdit,
                          ]}
                        >
                          <Text style={styles.mergedHint}>空格 ×{it.span}</Text>
                        </TouchableOpacity>
                      );
                    }
                    const cell = it.cell;
                    if (!cell.occupied) {
                      return (
                        <TouchableOpacity
                          key={j}
                          activeOpacity={editMode ? 0.6 : 1}
                          onPress={() => onCellPress(cell)}
                          style={[
                            styles.cell, styles.cellEmpty, { height: cellH },
                            editMode && styles.cellEdit,
                          ]}
                        >
                          <Text style={styles.cellDot}>·</Text>
                        </TouchableOpacity>
                      );
                    }
                    const color = cell.isPlaceholder
                      ? KIND_COLOR[cell.kind || ""] || PH_COLOR
                      : KIND_COLOR[cell.kind || "it"] || KIND_COLOR.it;
                    const warn = cell.status === "critical" || cell.status === "warning";
                    const pct = Math.round((cell.utilization ?? 0) * 100);
                    return (
                      <TouchableOpacity
                        key={j}
                        activeOpacity={0.85}
                        onPress={() => onCellPress(cell)}
                        style={[
                          styles.cell, { height: cellH, backgroundColor: color },
                          warn && styles.cellWarn,
                          dimmedOf(cell) && styles.cellDim,
                        ]}
                      >
                        <Text style={styles.cellName} numberOfLines={1}>{cell.rackName}</Text>
                        {showUtil && !cell.isPlaceholder ? (
                          <View style={styles.utilWrap}>
                            <View style={styles.utilTrack}>
                              <View
                                style={[styles.utilFill, { width: `${pct}%`, backgroundColor: utilColor(pct) }]}
                              />
                            </View>
                            <Text style={styles.utilPct}>{pct}%</Text>
                          </View>
                        ) : null}
                        {showUtil && !cell.isPlaceholder &&
                        (cell.temperature != null || cell.humidity != null) ? (
                          <Text style={styles.cellTemp} numberOfLines={1}>
                            {cell.temperature != null ? `${cell.temperature}°C` : ""}
                            {cell.temperature != null && cell.humidity != null ? " " : ""}
                            {cell.humidity != null ? `${cell.humidity}%` : ""}
                          </Text>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )
            )}
          </View>
        ) : (
          <EmptyState
            text={
              zones.length === 0
                ? "该楼层暂无区域，点「切换 ▾」新建区域"
                : "该区域暂无机柜，点「布局」后在空格摆放"
            }
          />
        )}
      </ScrollView>

      {/* 图例 */}
      <View style={styles.legend}>
        {KIND_OPTIONS.map((k) => (
          <View key={k.value} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: k.color }]} />
            <Text style={styles.legendText}>{k.label}</Text>
          </View>
        ))}
      </View>

      {editMode ? (
        <Text style={styles.hint}>
          点空格 → 摆放机柜 / 新建占位块 · 点机柜 → 查看 / 移动 / 移出 · 点占位块 → 移除 · 点通道 → 冷/热切换
        </Text>
      ) : null}

      {/* 导航选择器：楼层 / 区域 / 新建区域 */}
      <Sheet visible={sheet === "nav"} title="切换楼层 / 区域" onClose={() => setSheet(null)}>
        <Text style={styles.sLabel}>楼层</Text>
        <View style={styles.wrapRow}>
          {floors.map((f) => (
            <Chip key={f.id} label={f.name || f.code || "楼层"} active={f.id === floorId}
              onPress={() => { setFloorId(f.id); setSheet(null); }} />
          ))}
        </View>
        <Text style={styles.sLabel}>区域</Text>
        <View style={styles.wrapRow}>
          {zones.map((z) => (
            <Chip key={z.id} label={z.name || z.code || "区域"} active={z.id === zoneId}
              onPress={() => { setZoneId(z.id); setSheet(null); }} />
          ))}
          {canCreateRoom ? (
            <Chip label="＋ 新建区域" active={false}
              onPress={() => { setZName(""); setZCols(""); setZRows(""); setSheet("zone"); }} />
          ) : null}
        </View>
      </Sheet>

      {/* 客户筛选 */}
      <Sheet visible={sheet === "customer"} title="客户筛选" onClose={() => setSheet(null)}>
        <View style={styles.wrapRow}>
          <Chip label="全部客户" active={filterCustomerId === ""} onPress={() => { setFilterCustomerId(""); setSheet(null); }} />
          {customers.map((c) => (
            <Chip key={c.id} label={c.name || "客户"} active={filterCustomerId === c.id}
              onPress={() => { setFilterCustomerId(c.id); setSheet(null); }} />
          ))}
        </View>
      </Sheet>

      {/* 空格二选一 */}
      <Sheet visible={sheet === "cell"} title={pendingCell ? `${pendingCell.col} 列 ${pendingCell.row} 行 · 选择操作` : "选择操作"} onClose={() => setSheet(null)}>
        {canEditRack ? (
          <ActionItem label="摆放机柜" onPress={() => { const c = pendingCell; setSheet(null); if (c) openRackPicker(c.col, c.row); }} />
        ) : null}
        {canCreateRoom ? (
          <ActionItem label="新建占位块（UPS/空调/配电/移门）"
            onPress={() => { const c = pendingCell; if (c) openKindPicker(c.col, c.row, true); }} />
        ) : null}
        <ActionItem label="取消" cancel onPress={() => setSheet(null)} />
      </Sheet>

      {/* 种类选择 */}
      <Sheet visible={sheet === "kind"} title={pendingIsPlaceholder ? "选择占位块类型" : "选择机柜类型"} onClose={() => setSheet(null)}>
        <View style={styles.wrapRow}>
          {KIND_OPTIONS.map((k) => (
            <TouchableOpacity key={k.value} style={[styles.kindItem, { borderColor: k.color }]}
              onPress={() => onPickKind(k.value)}>
              <View style={[styles.kindDot, { backgroundColor: k.color }]} />
              <Text style={styles.kindText}>{k.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Sheet>

      {/* 名称输入 → 创建 */}
      <Sheet visible={sheet === "name"} title={pendingIsPlaceholder ? "占位块名称" : "机柜名称"} onClose={() => setSheet(null)}>
        <Text style={styles.tip}>
          位置：{pendingCell?.col} 列 {pendingCell?.row} 行 · 类型：{KIND_LABEL[pendingKind] || pendingKind}
        </Text>
        <Input
          placeholder={pendingIsPlaceholder ? "标签，如 UPS-01" : "名称，如 R-01"}
          value={newName}
          onChangeText={setNewName}
        />
        <TouchableOpacity style={styles.okBtn} disabled={busy} onPress={submitName}>
          <Text style={styles.okBtnTxt}>{busy ? "创建中…" : "确认创建"}</Text>
        </TouchableOpacity>
      </Sheet>

      {/* 机柜选择器 */}
      <Sheet visible={sheet === "rackPick"} title="选择要摆放的机柜" onClose={() => setSheet(null)}>
        {rackPickList.map((r) => (
          <TouchableOpacity key={r.id} style={styles.pickRow} onPress={() => pickRack(r.id)}>
            <Text style={styles.pickName} numberOfLines={1}>{r.code || r.name || "机柜"}</Text>
            <Text style={styles.pickSub} numberOfLines={1}>
              {r.sub}{r.customerName ? ` · ${r.customerName}` : ""}
            </Text>
          </TouchableOpacity>
        ))}
        {canEditRack ? (
          <TouchableOpacity style={styles.pickCreate}
            onPress={() => { const c = pendingCell; if (c) openKindPicker(c.col, c.row, false); }}>
            <Text style={styles.pickCreateTxt}>＋ 新建机柜并摆放</Text>
          </TouchableOpacity>
        ) : null}
      </Sheet>

      {/* 机柜动作 */}
      <Sheet visible={sheet === "rackAct"} title={rackTarget?.name || "机柜操作"} onClose={() => setSheet(null)}>
        {confirming === "rack" ? (
          <View>
            <Text style={styles.tip}>确认将「{rackTarget?.name}」移出本区域？（保留机柜数据）</Text>
            <TouchableOpacity style={styles.okBtn} onPress={removeRack}>
              <Text style={[styles.okBtnTxt, { color: theme.danger }]}>确认移出</Text>
            </TouchableOpacity>
            <ActionItem label="取消" cancel onPress={() => setConfirming(null)} />
          </View>
        ) : (
          <View>
            <ActionItem label="查看 U 位立面" onPress={() => goVisual(rackTarget?.id || "", rackTarget?.name)} />
            <ActionItem label="移动机柜" onPress={() => {
              setMoving({ id: rackTarget?.id || "", name: rackTarget?.name || "机柜" });
              setSheet(null);
            }} />
            <ActionItem label="移出本区域" danger onPress={() => setConfirming("rack")} />
            <ActionItem label="取消" cancel onPress={() => setSheet(null)} />
          </View>
        )}
      </Sheet>

      {/* 占位块动作 */}
      <Sheet visible={sheet === "phAct"} title={phTarget?.name || "占位块"} onClose={() => setSheet(null)}>
        {confirming === "ph" ? (
          <View>
            <Text style={styles.tip}>确认移除「{phTarget?.name}」？（纯展示块，仅从平面图移除）</Text>
            <TouchableOpacity style={styles.okBtn} onPress={removePlaceholder}>
              <Text style={[styles.okBtnTxt, { color: theme.danger }]}>确认移除</Text>
            </TouchableOpacity>
            <ActionItem label="取消" cancel onPress={() => setConfirming(null)} />
          </View>
        ) : (
          <View>
            <ActionItem label="移除占位块" danger onPress={() => setConfirming("ph")} />
            <ActionItem label="取消" cancel onPress={() => setSheet(null)} />
          </View>
        )}
      </Sheet>

      {/* 机柜检视器（非编辑态点击） */}
      <Sheet visible={!!inspect} title="机柜检视" onClose={() => setInspect(null)}>
        {inspect ? (
          <View>
            <ListRow title="编码" subtitle={inspect.rackName || "—"} />
            <ListRow title="类型" subtitle={KIND_LABEL[inspect.kind || ""] || "—"} />
            <ListRow title="位置" subtitle={`${inspect.col} 列 · ${inspect.row} 行`} />
            <ListRow title="客户" subtitle={inspect.customerName || "公共"} />
            <ListRow
              title="利用率"
              subtitle={inspect.utilization != null ? `${Math.round((inspect.utilization ?? 0) * 100)}%` : "—"}
            />
            {inspect.temperature != null ? (
              <ListRow title="温度" subtitle={`${inspect.temperature}°C`} />
            ) : null}
            {inspect.humidity != null ? (
              <ListRow title="湿度" subtitle={`${inspect.humidity}%`} />
            ) : null}
            <TouchableOpacity style={styles.okBtn} onPress={() => goVisual(inspect.rackId || "", inspect.rackName)}>
              <Text style={styles.okBtnTxt}>查看 U 位立面</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </Sheet>

      {/* 新建区域 */}
      <Sheet visible={sheet === "zone"} title="新建区域" onClose={() => setSheet(null)}>
        <Input placeholder="区域名称" value={zName} onChangeText={setZName} />
        <Input placeholder="列数（如 12）" value={zCols} onChangeText={setZCols} />
        <Input placeholder="行数（如 8）" value={zRows} onChangeText={setZRows} />
        <TouchableOpacity style={styles.okBtn} disabled={busy} onPress={createZone}>
          <Text style={styles.okBtnTxt}>{busy ? "创建中…" : "确认创建"}</Text>
        </TouchableOpacity>
      </Sheet>
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={[styles.chip, active && styles.chipOn]}>
      <Text style={[styles.chipText, active && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
}
function ActionItem({ label, onPress, danger, cancel }: { label: string; onPress: () => void; danger?: boolean; cancel?: boolean }) {
  return (
    <TouchableOpacity style={styles.asItem} onPress={onPress}>
      <Text
        style={[
          styles.asText,
          danger && styles.asTextDanger,
          cancel && styles.asTextCancel,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statVal, color ? { color } : null]}>{value}</Text>
      <Text style={styles.statLbl}>{label}</Text>
    </View>
  );
}

const CELL = 46;
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.bg },
  center: { flex: 1, backgroundColor: theme.bg, justifyContent: "center" },
  crumb: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8,
  },
  crumbTxt: { flex: 1, fontSize: 15, fontWeight: "700", color: theme.text1 },
  crumbSep: { color: theme.text3, fontWeight: "500" },
  crumbSwitch: { fontSize: 12, color: theme.accent, fontWeight: "700", marginLeft: 8 },
  toolRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, marginBottom: 6 },
  toolPill: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.rPill,
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, marginRight: 8,
    maxWidth: 150,
  },
  toolPillOn: { backgroundColor: theme.accent, borderColor: theme.accent },
  toolPillTxt: { fontSize: 12, fontWeight: "600", color: theme.text2 },
  toolPillTxtOn: { color: "#fff" },
  toolEdit: {
    marginLeft: "auto", paddingHorizontal: 16, paddingVertical: 7,
    borderRadius: theme.rPill, backgroundColor: theme.surface,
    borderWidth: 1, borderColor: theme.border,
  },
  toolEditOn: { backgroundColor: theme.accent, borderColor: theme.accent },
  toolEditText: { fontSize: 13, fontWeight: "700", color: theme.text2 },
  toolEditTextOn: { color: "#fff" },
  statRow: { flexDirection: "row", paddingHorizontal: 8, marginBottom: 6 },
  statCard: {
    flex: 1, alignItems: "center", backgroundColor: theme.surface, borderRadius: 14,
    paddingVertical: 10, marginHorizontal: 4,
    shadowColor: "#101828", shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  statVal: { fontSize: 20, fontWeight: "800", color: theme.text1 },
  statLbl: { fontSize: 11, color: theme.text3, marginTop: 2 },
  movingBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginHorizontal: 12, marginBottom: 6, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, backgroundColor: theme.accentSoft || theme.surface,
  },
  movingTxt: { flex: 1, fontSize: 12, fontWeight: "700", color: theme.accent },
  movingCancel: { fontSize: 12, fontWeight: "700", color: theme.danger, marginLeft: 10 },
  gridScroll: { flex: 1 },
  gridPad: { padding: 12, paddingBottom: 24 },
  floor: { flexDirection: "row" },
  aisle: {
    width: 18, marginHorizontal: 3, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: theme.border,
  },
  aisleWall: { width: 26 },
  aisleLabel: { fontSize: 8, color: theme.text3, fontWeight: "700" },
  wallTag: { fontSize: 7, color: theme.text3, marginTop: 2 },
  aisleArrow: { fontSize: 10, color: theme.text3, marginTop: 2 },
  rackCol: { marginHorizontal: 3 },
  cell: {
    width: CELL, borderRadius: 8, marginVertical: 3,
    alignItems: "center", justifyContent: "center", paddingHorizontal: 2,
  },
  cellEmpty: { backgroundColor: "#eef1f6", borderWidth: 1, borderColor: theme.border },
  cellEdit: { borderStyle: "dashed", borderColor: theme.accent, borderWidth: 1.5 },
  cellWarn: { borderWidth: 2, borderColor: theme.danger },
  cellDim: { opacity: 0.32 },
  cellDot: { color: theme.text3, fontSize: 14 },
  mergedHint: { fontSize: 9, color: theme.text3, fontWeight: "700" },
  cellName: { color: "#fff", fontSize: 9, fontWeight: "700", textAlign: "center" },
  utilWrap: { flexDirection: "row", alignItems: "center", marginTop: 3, width: "86%" },
  utilTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.45)" },
  utilFill: { height: 3, borderRadius: 2 },
  utilPct: { color: "#fff", fontSize: 8, fontWeight: "700", marginLeft: 3 },
  cellTemp: { color: "#fff", fontSize: 8, marginTop: 2, opacity: 0.9 },
  legend: {
    flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: theme.surface, borderTopWidth: 1, borderColor: theme.border,
  },
  legendItem: { flexDirection: "row", alignItems: "center", marginRight: 12, marginVertical: 2 },
  legendDot: { width: 10, height: 10, borderRadius: 3, marginRight: 5 },
  legendText: { fontSize: 11, color: theme.text2 },
  hint: { fontSize: 11, color: theme.text3, paddingHorizontal: 16, paddingVertical: 8 },
  chip: {
    paddingVertical: 7, paddingHorizontal: 14, borderRadius: theme.rPill,
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, margin: 4,
  },
  chipOn: { backgroundColor: theme.accent, borderColor: theme.accent },
  chipText: { fontSize: 13, fontWeight: "600", color: theme.text2 },
  chipTextOn: { color: "#fff" },
  wrapRow: { flexDirection: "row", flexWrap: "wrap" },
  sLabel: { fontSize: 13, fontWeight: "700", color: theme.text1, marginTop: 8, marginBottom: 2 },
  kindItem: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 10, borderWidth: 1, margin: 4,
  },
  kindDot: { width: 10, height: 10, borderRadius: 3, marginRight: 6 },
  kindText: { fontSize: 13, fontWeight: "600", color: theme.text1 },
  pickRow: { paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: theme.border },
  pickName: { fontSize: 14, fontWeight: "700", color: theme.text1 },
  pickSub: { fontSize: 11, color: theme.text3, marginTop: 2 },
  pickCreate: { marginTop: 12, alignItems: "center", paddingVertical: 10 },
  pickCreateTxt: { color: theme.accent, fontSize: 14, fontWeight: "700" },
  asItem: { paddingVertical: 14, alignItems: "center", borderBottomWidth: 1, borderBottomColor: theme.border },
  asText: { fontSize: 15, fontWeight: "600", color: theme.text1 },
  asTextDanger: { color: theme.danger },
  asTextCancel: { color: theme.text3 },
  tip: { fontSize: 12, color: theme.text2, marginBottom: 10 },
  okBtn: { backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 13, alignItems: "center", marginTop: 14 },
  okBtnTxt: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
