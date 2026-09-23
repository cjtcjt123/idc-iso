import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { apiCollect, apiList, apiPatch, apiPost } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useCan } from "../auth/permission";
import type { Rack } from "../api/types";
import { Badge, Button, Chip, EmptyState, Input, ListRow, Loading, Pager, Sheet } from "../components/ui";
import { theme } from "../theme";

/** 对齐小程序 pages/inventory：库存 = 物料实例 + 下架待用设备，单页合并展示 + 上架/出库/移位/批量上架 */
const STATUS_TEXT: Record<string, string> = {
  in_stock: "在库",
  in_use: "使用中",
  in_repair: "维修中",
  scrapped: "已报废",
  reserved: "已预留",
};
const STATUS_COLOR: Record<string, string> = {
  in_stock: theme.ok,
  in_use: theme.info,
  in_repair: theme.warn,
  scrapped: theme.text3,
  reserved: theme.purple,
};
const STATUS_OPTS: { id: string; name: string }[] = [
  { id: "all", name: "全部状态" },
  { id: "in_stock", name: "在库" },
  { id: "in_use", name: "已领用" },
  { id: "in_repair", name: "维修中" },
  { id: "scrapped", name: "已报废" },
  { id: "reserved", name: "预留" },
];

type Kind = "all" | "device" | "material";
type StockVM = {
  id: string;
  kind: "material" | "device";
  name: string;
  sub: string;
  statusText: string;
  statusColor: string;
  location: string;
  customerName: string;
  customerId?: string | null;
  quantityText: string;
  serialNumber?: string;
  uHeight?: number;
  categoryName?: string;
  isServer?: boolean;
  picked?: boolean;
};

function flattenCats(nodes: any[], out: { id: string; name: string }[] = []): { id: string; name: string }[] {
  for (const n of nodes || []) {
    if (n && n.id) out.push({ id: n.id, name: n.name || "" });
    if (n && n.children && n.children.length) flattenCats(n.children, out);
  }
  return out;
}

function toMaterialVM(it: any): StockVM {
  const prod = it.inventoryItem || {};
  return {
    id: it.id,
    kind: "material",
    name: it.name || prod.name || "未命名物料",
    sub: `物料：${prod.name || it.categoryName || "-"}`,
    statusText: STATUS_TEXT[it.status] || it.status || "-",
    statusColor: STATUS_COLOR[it.status] || theme.text3,
    location: it.location || "未定位",
    customerName: it.customer?.name || "未分配",
    customerId: it.customerId || null,
    quantityText: `${it.quantity ?? 1}${it.unit || ""}`,
  };
}

function toDeviceVM(d: any, locMap: Record<string, string>): StockVM {
  const catName = (d as any).category?.name || "";
  return {
    id: d.id,
    kind: "device",
    name: d.model?.name || d.type || d.name || "未指定型号",
    sub: "库存待用设备",
    statusText: "库存待用",
    statusColor: theme.info,
    location: (d.locationId && locMap[d.locationId]) || (d.locationId ? "已定位" : "未分配库位"),
    customerName: d.customer?.name || "未分配",
    customerId: d.customerId || null,
    serialNumber: d.serialNumber || "",
    uHeight: d.uHeight || 1,
    categoryName: catName,
    isServer: /服务器/.test(catName),
    quantityText: "1 台",
  };
}

/** 可上架机柜：专属柜本人 / 共享柜（仅散户客户）。与后端 assertRackAssignable 同规则，后端仍兜底。 */
function racksForCustomer(racks: Rack[], custId: string, custType: string): Rack[] {
  if (!custId) return [];
  const isRetail = custType === "retail";
  return racks.filter((r) =>
    r.ownershipMode === "shared" ? isRetail : r.customerId === custId
  );
}

export function InventoryScreen({ navigation }: any) {
  const { currentRoomId } = useAuth();
  const can = useCan();
  const canDevice = can("device", "update");
  const canInventory = can("inventory", "update");

  const [keyword, setKeyword] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const [materials, setMaterials] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [locMap, setLocMap] = useState<Record<string, string>>({});
  const [racks, setRacks] = useState<Rack[]>([]);
  const [custType, setCustType] = useState<Record<string, string>>({});
  const [custOptions, setCustOptions] = useState<{ id: string; name: string }[]>([]);
  const [catOptions, setCatOptions] = useState<{ id: string; name: string }[]>([]);
  const [devCatOptions, setDevCatOptions] = useState<{ id: string; name: string }[]>([]);
  const [locations, setLocations] = useState<{ id: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const firstRun = useRef(true);

  // ── 二级筛选（客户 / 状态 / 分类 / 设备类型）──
  const [filterCustomerId, setFilterCustomerId] = useState("");
  const [filterCategoryId, setFilterCategoryId] = useState("");
  const [filterDeviceTypeId, setFilterDeviceTypeId] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [activeFilter, setActiveFilter] = useState<"" | "customer" | "status" | "category" | "deviceType">("");

  // ── 前端分页 ──
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // ── 上架弹层（单台）──
  const [mountDev, setMountDev] = useState<StockVM | null>(null);
  const [mountRackId, setMountRackId] = useState("");
  const [mountU, setMountU] = useState("");
  const [mounting, setMounting] = useState(false);

  // ── 出库发走弹层 ──
  const [shipDev, setShipDev] = useState<StockVM | null>(null);
  const [shipTo, setShipTo] = useState("");
  const [shipCarrier, setShipCarrier] = useState("");
  const [shipTrackingNo, setShipTrackingNo] = useState("");
  const [shipNote, setShipNote] = useState("");
  const [shipping, setShipping] = useState(false);

  // ── 移位弹层 ──
  const [relDev, setRelDev] = useState<StockVM | null>(null);
  const [relLocId, setRelLocId] = useState("");
  const [relocating, setRelocating] = useState(false);

  // ── 批量上架 ──
  const [batchMode, setBatchMode] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [batchRackId, setBatchRackId] = useState("");
  const [batchU, setBatchU] = useState("1");
  const [batchCsv, setBatchCsv] = useState("");
  const [batchCsvHint, setBatchCsvHint] = useState("");
  const [batchUMode, setBatchUMode] = useState<"auto" | "manual" | "import">("auto");
  const [batchItems, setBatchItems] = useState<{ deviceId: string; name: string; sn: string; uHeight: number; uPos: string; rackId?: string }[]>([]);
  const [batchMounting, setBatchMounting] = useState(false);

  const load = async () => {
    const kw = keyword.trim();
    setPage(1);
    const [inst, dev, locs, rks, custs, cats, devCats] = await Promise.allSettled([
      kind === "device"
        ? Promise.resolve({ data: [] as any[] })
        : apiList<any>("/inventory/instances", {
            page: 1, pageSize: 200, search: kw || undefined,
            roomId: currentRoomId || undefined,
            categoryId: filterCategoryId || undefined,
            status: filterStatus === "all" ? undefined : filterStatus,
            customerId: filterCustomerId || undefined,
            sort: "name:asc",
          }),
      kind === "material"
        ? Promise.resolve({ data: [] as any[] })
        : apiList<any>("/devices", {
            page: 1, pageSize: 200, placement: "inventory",
            search: kw || undefined,
            roomId: kw ? undefined : currentRoomId || undefined,
            customerId: filterCustomerId || undefined,
            categoryId: kind === "device" ? (filterDeviceTypeId || undefined) : (filterCategoryId || undefined),
            sort: "name:asc",
          }),
      apiCollect<any>("/inventory/locations"),
      currentRoomId ? apiList<Rack>("/racks", { roomId: currentRoomId, pageSize: 200 }) : Promise.resolve({ data: [] as Rack[] }),
      currentRoomId ? apiList<any>("/customers", { roomId: currentRoomId, pageSize: 100 }) : Promise.resolve({ data: [] as any[] }),
      apiCollect<any>("/inventory/categories"),
      apiCollect<any>("/device-categories"),
    ]);

    let devList = dev.status === "fulfilled" ? dev.value.data || [] : [];
    if (kw && currentRoomId) devList = devList.filter((d: any) => !d.roomId || d.roomId === currentRoomId);

    setMaterials(inst.status === "fulfilled" ? inst.value.data || [] : []);
    setDevices(devList);
    if (locs.status === "fulfilled") {
      const map: Record<string, string> = {};
      const locs2: { id: string; label: string }[] = [];
      for (const l of locs.value) { map[l.id] = l.code || l.name || ""; locs2.push({ id: l.id, label: l.code || l.name || "" }); }
      setLocMap(map); setLocations(locs2);
    }
    if (rks.status === "fulfilled") setRacks(rks.value.data || []);
    if (custs.status === "fulfilled") {
      const list = custs.value.data || [];
      const m: Record<string, string> = {};
      const opts: { id: string; name: string }[] = [{ id: "", name: "全部客户" }];
      for (const c of list) { m[c.id] = c.type || c.customerType || ""; opts.push({ id: c.id, name: c.name || "" }); }
      setCustType(m); setCustOptions(opts);
    }
    if (cats.status === "fulfilled") {
      const flat = flattenCats(cats.value as any[]);
      setCatOptions([{ id: "", name: "全部分类" }].concat(flat));
    }
    if (devCats.status === "fulfilled") {
      const flat = flattenCats(devCats.value as any[]);
      setDevCatOptions([{ id: "", name: "全部类型" }].concat(flat));
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; load(); return; }
    const t = setTimeout(load, keyword ? 350 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword, kind, currentRoomId, filterCustomerId, filterCategoryId, filterDeviceTypeId, filterStatus]);

  const items = useMemo(() => {
    const merged = [...materials.map(toMaterialVM), ...devices.map((d) => toDeviceVM(d, locMap))];
    const pickedSet = new Set(picked);
    merged.forEach((m) => { if (m.kind === "device") m.picked = pickedSet.has(m.id); });
    return merged.sort((a, b) => a.name.localeCompare(b.name));
  }, [materials, devices, locMap, picked]);

  const statMat = items.filter((i) => i.kind === "material").length;
  const statDev = items.filter((i) => i.kind === "device").length;

  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(items.length / pageSize)) : 1;
  const pagedItems = pageSize > 0 ? items.slice((page - 1) * pageSize, page * pageSize) : items;

  const hasFilter = !!(filterCustomerId || filterCategoryId || filterDeviceTypeId || filterStatus !== "all");
  const clearFilters = () => { setFilterCustomerId(""); setFilterCategoryId(""); setFilterDeviceTypeId(""); setFilterStatus("all"); };

  // ── 单台上架 ──
  const openMount = (d: StockVM) => {
    if (!d.customerId) { alert("该设备未归属客户，请先指定客户"); return; }
    const assignable = racksForCustomer(racks, d.customerId, custType[d.customerId] || "");
    if (!assignable.length) { alert("该客户暂无可用机柜"); return; }
    setMountDev(d); setMountRackId(""); setMountU("");
  };
  const confirmMount = async () => {
    if (!mountDev) return;
    if (!mountRackId) { alert("请选择目标机柜"); return; }
    const u = Number(mountU);
    if (!Number.isInteger(u) || u < 1) { alert("请填写有效 U 位（≥1 整数）"); return; }
    setMounting(true);
    try {
      await apiPost(`/devices/${mountDev.id}/mount`, { rackId: mountRackId, uPosition: u });
      toast("已上架"); setMountDev(null); load();
    } catch (e: any) { alert(e?.message || "上架失败"); }
    finally { setMounting(false); }
  };

  // ── 出库发走 ──
  const confirmShip = async () => {
    if (!shipDev) return;
    if (!shipTo.trim()) { alert("请填写收货方"); return; }
    setShipping(true);
    try {
      await apiPost(`/devices/${shipDev.id}/dismount`, {
        reason: "库存出库发走", destination: "shipped",
        shipTo: shipTo.trim(),
        carrier: shipCarrier.trim() || undefined,
        trackingNo: shipTrackingNo.trim() || undefined,
        note: shipNote.trim() || undefined,
      });
      toast("已出库发走"); setShipDev(null); load();
    } catch (e: any) { alert(e?.message || "出库失败"); }
    finally { setShipping(false); }
  };

  // ── 移位 ──
  const confirmRelocate = async () => {
    if (!relDev) return;
    if (!relLocId) { alert("请选择库位"); return; }
    setRelocating(true);
    try {
      await apiPatch(`/devices/${relDev.id}`, { locationId: relLocId });
      toast("已更新库位"); setRelDev(null); load();
    } catch (e: any) { alert(e?.message || "移位失败"); }
    finally { setRelocating(false); }
  };

  // ── 批量上架 ──
  const togglePick = (id: string) => {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };
  const openBatch = () => {
    const ds = items.filter((i) => i.kind === "device" && picked.includes(i.id) && i.customerId && !i.isServer);
    if (!ds.length) { alert("请勾选同一客户的库存设备（服务器不可上架）"); return; }
    const cids = Array.from(new Set(ds.map((i) => i.customerId!)));
    if (cids.length > 1) { alert("请勾选同一客户的设备"); return; }
    const assignable = racksForCustomer(racks, cids[0], custType[cids[0]] || "");
    if (!assignable.length) { alert("该客户暂无可用机柜"); return; }
    setBatchRackId(""); setBatchU("1"); setBatchCsv(""); setBatchCsvHint(""); setBatchUMode("auto");
    setBatchItems(ds.map((i) => ({ deviceId: i.id, name: i.name, sn: i.serialNumber || "", uHeight: i.uHeight || 1, uPos: "" })));
  };
  const parseCsv = () => {
    const rackByKey: Record<string, string> = {};
    for (const r of racks) { const k = (r.code || r.name || "").trim().toUpperCase(); if (k) rackByKey[k] = r.id; }
    const devBySn: Record<string, StockVM> = {};
    for (const i of items) if (i.kind === "device" && i.serialNumber) devBySn[i.serialNumber.trim().toUpperCase()] = i;
    const lines = batchCsv.trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const out: typeof batchItems = []; const errs: string[] = [];
    for (const line of lines) {
      const [sn, rk, up] = line.split(/[,，\t]/).map((x) => x.trim());
      const dev = sn ? devBySn[sn.toUpperCase()] : null;
      if (!dev) { errs.push(`SN 不在库存:${sn || "(空)"}`); continue; }
      const rid = rk ? rackByKey[rk.toUpperCase()] : "";
      if (!rid) { errs.push(`机柜未找到:${rk || "(空)"}`); continue; }
      const u = Number(up);
      if (!u || u < 1) { errs.push(`U 位无效:${sn || ""}`); continue; }
      out.push({ deviceId: dev.id, name: dev.name, sn: dev.serialNumber || "", uHeight: dev.uHeight || 1, uPos: String(u), rackId: rid });
    }
    setBatchItems(out);
    setBatchCsvHint(errs.length ? errs.slice(0, 4).join("；") : (out.length ? `已解析 ${out.length} 台` : "未解析到有效行"));
  };
  const updateBatchU = (idx: number, t: string) => {
    setBatchItems((arr) => arr.map((x, i) => (i === idx ? { ...x, uPos: t } : x)));
  };
  const confirmBatch = async () => {
    const useCsv = batchUMode === "import";
    if (!useCsv && !batchRackId) { alert("请选择目标机柜"); return; }
    if (useCsv && !batchItems.length) { alert("请先解析 CSV"); return; }
    const list = batchItems.map((it) => {
      const uPos = batchUMode === "auto" ? (Number(batchU) || 1) : Number(it.uPos);
      const rackId = batchUMode === "import" ? it.rackId! : batchRackId;
      return { deviceId: it.deviceId, rackId, uPosition: uPos };
    }).filter((x) => x.uPosition >= 1 && x.rackId);
    if (!list.length) { alert("请填写有效 U 位"); return; }
    setBatchMounting(true);
    try {
      const res: any = await apiPost("/devices/batch-mount", { items: list });
      toast(`已上架 ${res?.success || list.length} 台`);
      setBatchMode(false); setPicked([]); setBatchItems([]); load();
    } catch (e: any) { alert(e?.message || "批量上架失败"); }
    finally { setBatchMounting(false); }
  };

  const onFilterPick = (id: string) => {
    if (activeFilter === "customer") setFilterCustomerId(id);
    else if (activeFilter === "status") setFilterStatus(id);
    else if (activeFilter === "category") setFilterCategoryId(id);
    else if (activeFilter === "deviceType") setFilterDeviceTypeId(id);
    setActiveFilter("");
  };
  const filterOptions = (): { id: string; name: string }[] => {
    if (activeFilter === "customer") return custOptions;
    if (activeFilter === "status") return STATUS_OPTS;
    if (activeFilter === "category") return catOptions;
    if (activeFilter === "deviceType") return devCatOptions;
    return [];
  };
  const filterTitle = (): string => {
    if (activeFilter === "customer") return "选择客户";
    if (activeFilter === "status") return "选择状态";
    if (activeFilter === "category") return "选择分类";
    if (activeFilter === "deviceType") return "选择设备类型";
    return "";
  };
  const currentFilterId = (): string => {
    if (activeFilter === "customer") return filterCustomerId;
    if (activeFilter === "status") return filterStatus;
    if (activeFilter === "category") return filterCategoryId;
    if (activeFilter === "deviceType") return filterDeviceTypeId;
    return "";
  };
  const filterChipLabel = (which: string): string => {
    if (which === "customer") return custOptions.find((o) => o.id === filterCustomerId)?.name || "客户";
    if (which === "status") return STATUS_OPTS.find((o) => o.id === filterStatus)?.name || "状态";
    if (which === "category") return catOptions.find((o) => o.id === filterCategoryId)?.name || "分类";
    if (which === "deviceType") return devCatOptions.find((o) => o.id === filterDeviceTypeId)?.name || "类型";
    return which;
  };

  if (loading) return <Loading />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={s.searchWrap}>
        <Input value={keyword} onChangeText={setKeyword} placeholder="搜索名称 / 型号 / SN / 批次" />
      </View>

      <View style={s.stats}>
        <Stat n={items.length} label="在库件数" />
        <Stat n={statMat} label="物料种类" divider />
        <Stat n={statDev} label="库存设备" divider />
      </View>

      <View style={s.chips}>
        <Chip label={`全部 ${items.length}`} active={kind === "all"} onPress={() => setKind("all")} />
        <Chip label={`设备 ${statDev}`} active={kind === "device"} onPress={() => setKind("device")} />
        <Chip label="物料" active={kind === "material"} onPress={() => setKind("material")} />
        {canDevice ? (
          <Chip label={batchMode ? "✓ 批量" : "批量上架"} active={batchMode} onPress={() => { setBatchMode((v) => !v); setPicked([]); }} />
        ) : null}
        <Chip label="盘点" dropdown onPress={() => navigation.navigate("CountList")} />
        <Chip label="操作日志" dropdown onPress={() => navigation.navigate("Logs")} />
        <Chip label="库位" dropdown onPress={() => navigation.navigate("Locations")} />
        <Chip label="分类/物料" dropdown onPress={() => navigation.navigate("Categories")} />
      </View>

      <View style={s.chips}>
        <Chip label={filterChipLabel("customer")} dropdown active={!!filterCustomerId} onPress={() => setActiveFilter("customer")} />
        <Chip label={filterChipLabel("status")} dropdown active={filterStatus !== "all"} onPress={() => setActiveFilter("status")} />
        <Chip label={filterChipLabel("category")} dropdown active={!!filterCategoryId} onPress={() => setActiveFilter("category")} />
        <Chip label={filterChipLabel("deviceType")} dropdown active={!!filterDeviceTypeId} onPress={() => setActiveFilter("deviceType")} />
        {hasFilter ? (
          <Chip label="清除" tone="warn" onPress={clearFilters} />
        ) : null}
      </View>

      <FlatList
        data={pagedItems}
        keyExtractor={(d) => `${d.kind}-${d.id}`}
        contentContainerStyle={{ paddingBottom: canInventory ? 96 : 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        renderItem={({ item }) => {
          const isDev = item.kind === "device";
          const showActions = canDevice && isDev && !batchMode;
          return (
            <View style={s.card}>
              <View style={[s.bar, { backgroundColor: isDev ? theme.accent : theme.purple }]} />
              <View style={{ flex: 1 }}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() =>
                    batchMode
                      ? togglePick(item.id)
                      : navigation.navigate(isDev ? "DeviceDetail" : "InstanceDetail", isDev ? { deviceId: item.id } : { instanceId: item.id })
                  }
                  style={{ flexDirection: "row", paddingVertical: 11, paddingRight: 12 }}
                >
                  {batchMode && isDev ? (
                    <View style={[s.check, item.picked && s.checkOn]}>
                      {item.picked ? <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>✓</Text> : null}
                    </View>
                  ) : null}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={s.line1}>
                      <Text style={s.name} numberOfLines={1}>{item.name}</Text>
                      <Badge label={item.statusText} color={item.statusColor} />
                    </View>
                    <Text style={s.sub} numberOfLines={1}>{item.sub}</Text>
                    <View style={s.line3}>
                      <Text style={s.loc} numberOfLines={1}>{item.location}</Text>
                      <Text style={s.cust} numberOfLines={1}>{item.customerName}</Text>
                      <Text style={s.qty}>{item.quantityText}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
                {showActions ? (
                  <View style={s.actions}>
                    {!item.isServer ? <ActBtn label="上架" onPress={() => openMount(item)} /> : null}
                    <ActBtn label="出库发走" onPress={() => { setShipDev(item); setShipTo(""); setShipCarrier(""); setShipTrackingNo(""); setShipNote(""); }} />
                    <ActBtn label="移位" onPress={() => { setRelDev(item); setRelLocId(""); }} />
                  </View>
                ) : null}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={<EmptyState text="库存为空" />}
      />

      {/* 分页器 */}
      <Pager page={page} totalPages={totalPages} pageSize={pageSize > 0 ? pageSize : items.length} onPrev={() => setPage((p) => Math.max(1, p - 1))} onNext={() => setPage((p) => Math.min(totalPages, p + 1))} onPageSize={(n) => setPageSize(n === -1 ? 0 : n)} />

      {/* 批量上架底部条 */}
      {batchMode && canDevice ? (
        <View style={s.batchBar}>
          <Text style={s.batchCount}>已选 {picked.length} 台</Text>
          <TouchableOpacity style={[s.batchGo, !picked.length && s.batchGoDis]} disabled={!picked.length} onPress={openBatch}>
            <Text style={s.batchGoTxt}>批量上架</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* 底部常驻：入库 / 出库（仅库存写权限） */}
      {canInventory ? (
        <View style={s.bottomBar}>
          <TouchableOpacity style={[s.botBtn, s.botIn]} onPress={() => navigation.navigate("StockIn")}>
            <Text style={s.botBtnTxt}>＋ 入库</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.botBtn, s.botOut]} onPress={() => navigation.navigate("StockOut")}>
            <Text style={s.botBtnTxt}>－ 出库</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* 二级筛选选择弹层 */}
      <Sheet visible={!!activeFilter} title={filterTitle()} onClose={() => setActiveFilter("")} scrollable>
        <View>
          <ListRow title="全部" right={currentFilterId() === "" ? <Text style={{ color: theme.accent, fontWeight: "700" }}>已选</Text> : null} onPress={() => onFilterPick("")} />
          {filterOptions().filter((o) => o.id !== "").map((o) => (
            <ListRow key={o.id} title={o.name} right={currentFilterId() === o.id ? <Text style={{ color: theme.accent, fontWeight: "700" }}>已选</Text> : null} onPress={() => onFilterPick(o.id)} />
          ))}
        </View>
      </Sheet>

      {/* 单台上架弹层 */}
      <Sheet visible={!!mountDev} title="上架到机柜" onClose={() => setMountDev(null)} scrollable>
        {mountDev ? (
          <View>
            <Text style={s.tip}>设备：{mountDev.name}（{mountDev.customerName}）</Text>
            <Text style={s.fieldLabel}>目标机柜</Text>
            <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
              {racksForCustomer(racks, mountDev.customerId!, custType[mountDev.customerId!] || "").map((r) => (
                <ListRow key={r.id} title={r.code} subtitle={r.uHeight ? `${r.uHeight}U` : undefined}
                  right={mountRackId === r.id ? <Text style={{ color: theme.accent, fontWeight: "700" }}>已选</Text> : null}
                  onPress={() => setMountRackId(r.id)} />
              ))}
            </ScrollView>
            <Input placeholder="U 位（自下而上，如 10）" value={mountU} onChangeText={setMountU} />
            <Button label="确认上架" onPress={confirmMount} loading={mounting} />
          </View>
        ) : null}
      </Sheet>

      {/* 出库发走弹层 */}
      <Sheet visible={!!shipDev} title="出库发走" onClose={() => setShipDev(null)}>
        {shipDev ? (
          <View>
            <Text style={s.tip}>{shipDev.name}</Text>
            <Input placeholder="收货方 *" value={shipTo} onChangeText={setShipTo} />
            <Input placeholder="承运商（选填）" value={shipCarrier} onChangeText={setShipCarrier} />
            <Input placeholder="运单号（选填）" value={shipTrackingNo} onChangeText={setShipTrackingNo} />
            <Input placeholder="备注（选填）" value={shipNote} onChangeText={setShipNote} />
            <Button label="确认出库发走" onPress={confirmShip} loading={shipping} danger />
          </View>
        ) : null}
      </Sheet>

      {/* 移位弹层 */}
      <Sheet visible={!!relDev} title="移位（改库位）" onClose={() => setRelDev(null)}>
        {relDev ? (
          <View>
            <Text style={s.tip}>{relDev.name}</Text>
            {locations.length ? (
              <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>
                {locations.map((l) => (
                  <ListRow key={l.id} title={l.label} right={relLocId === l.id ? <Text style={{ color: theme.accent, fontWeight: "700" }}>已选</Text> : null} onPress={() => setRelLocId(l.id)} />
                ))}
              </ScrollView>
            ) : <Text style={s.tip}>请先到「库位」新建库位</Text>}
            <Button label="确认移位" onPress={confirmRelocate} loading={relocating} />
          </View>
        ) : null}
      </Sheet>

      {/* 批量上架弹层 */}
      <Sheet visible={batchMode && batchItems.length > 0} title="批量上架" onClose={() => setBatchItems([])} scrollable>
        <View>
          <Text style={s.tip}>共 {batchItems.length} 台</Text>
          <View style={s.seg}>
            <Chip label="顺排" active={batchUMode === "auto"} onPress={() => setBatchUMode("auto")} />
            <Chip label="逐台指定" active={batchUMode === "manual"} onPress={() => setBatchUMode("manual")} />
            <Chip label="导入 CSV" active={batchUMode === "import"} onPress={() => setBatchUMode("import")} />
          </View>
          {batchUMode !== "import" ? (
            <View>
              <Text style={s.fieldLabel}>目标机柜</Text>
              <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled>
                {racksForCustomer(racks, items.find((i) => i.kind === "device" && picked.includes(i.id) && !i.isServer)?.customerId || "", custType[items.find((i) => i.kind === "device" && picked.includes(i.id) && !i.isServer)?.customerId || ""] || "").map((r) => (
                  <ListRow key={r.id} title={r.code} right={batchRackId === r.id ? <Text style={{ color: theme.accent, fontWeight: "700" }}>已选</Text> : null} onPress={() => setBatchRackId(r.id)} />
                ))}
              </ScrollView>
              <Input placeholder="起始 U（如 1）" value={batchU} onChangeText={setBatchU} />
            </View>
          ) : null}
          {batchUMode === "manual" ? (
            <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>
              {batchItems.map((it, i) => (
                <View key={it.deviceId} style={s.batchRow}>
                  <Text style={s.batchRowName} numberOfLines={1}>{it.name}</Text>
                  <TextInput style={s.uInput} value={it.uPos} onChangeText={(t) => updateBatchU(i, t)} placeholder="U" keyboardType="number-pad" placeholderTextColor={theme.text3} />
                </View>
              ))}
            </ScrollView>
          ) : null}
          {batchUMode === "import" ? (
            <View>
              <Text style={s.fieldLabel}>粘贴 CSV（设备SN,机柜编码,U位）</Text>
              <TextInput style={s.csv} value={batchCsv} onChangeText={setBatchCsv} placeholder="SN,机柜,U&#10;一行一台" multiline numberOfLines={4} placeholderTextColor={theme.text3} />
              {batchCsv ? <TouchableOpacity onPress={parseCsv}><Text style={s.link}>解析 CSV</Text></TouchableOpacity> : null}
              {batchCsvHint ? <Text style={s.tip}>{batchCsvHint}</Text> : null}
            </View>
          ) : null}
          <Button label="确认批量上架" onPress={confirmBatch} loading={batchMounting} />
        </View>
      </Sheet>
    </View>
  );
}

function Stat({ n, label, divider }: { n: number; label: string; divider?: boolean }) {
  return <View style={[s.stat, divider ? s.statDiv : null]}><Text style={s.statNum}>{n}</Text><Text style={s.statLab}>{label}</Text></View>;
}
function ActBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return <TouchableOpacity activeOpacity={0.7} style={s.actBtn} onPress={onPress}><Text style={s.actBtnTxt}>{label}</Text></TouchableOpacity>;
}

// ponytail：沿用 RN Alert 做轻量提示，避免再引入 toast 库
function alert(msg: string) { Alert.alert("提示", msg); }
function toast(msg: string) { Alert.alert("成功", msg); }

const s = {
  searchWrap: { paddingHorizontal: 14, paddingTop: 12 },
  stats: { flexDirection: "row" as const, backgroundColor: theme.surface, marginHorizontal: 14, marginTop: 12, borderRadius: theme.r, borderWidth: 1, borderColor: theme.border },
  stat: { flex: 1, alignItems: "center" as const, paddingVertical: 12 },
  statDiv: { borderLeftWidth: 1, borderLeftColor: theme.border },
  statNum: { fontSize: 20, fontWeight: "800" as const, color: theme.text1 },
  statLab: { fontSize: 11, color: theme.text3, marginTop: 2 },
  chips: { flexDirection: "row" as const, gap: 8, paddingHorizontal: 14, paddingTop: 12, flexWrap: "wrap" as const },
  card: { flexDirection: "row" as const, backgroundColor: theme.surface, marginHorizontal: 14, marginTop: 10, borderRadius: theme.r, borderWidth: 1, borderColor: theme.border, overflow: "hidden" as const },
  bar: { width: 4 },
  line1: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: 8 },
  name: { flex: 1, fontSize: 15, fontWeight: "700" as const, color: theme.text1 },
  sub: { fontSize: 12, color: theme.text2, marginTop: 3 },
  line3: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10, marginTop: 5 },
  loc: { flex: 1, fontSize: 11, color: theme.text3 },
  cust: { fontSize: 11, color: theme.text3, maxWidth: 110 },
  qty: { fontSize: 11, fontWeight: "700" as const, color: theme.accent },
  actions: { flexDirection: "row" as const, borderTopWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceAlt },
  actBtn: { flex: 1, alignItems: "center" as const, paddingVertical: 9, borderRightWidth: 1, borderColor: theme.border },
  actBtnTxt: { fontSize: 12, color: theme.accent, fontWeight: "600" as const },
  check: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: theme.border, alignItems: "center" as const, justifyContent: "center" as const, marginRight: 10, alignSelf: "center" as const },
  checkOn: { backgroundColor: theme.accent, borderColor: theme.accent },
  batchBar: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: theme.surface, borderTopWidth: 1, borderColor: theme.border },
  batchCount: { fontSize: 14, color: theme.text1, fontWeight: "600" as const },
  batchGo: { backgroundColor: theme.accent, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 10 },
  batchGoDis: { opacity: 0.4 },
  batchGoTxt: { color: "#fff", fontWeight: "700" as const, fontSize: 14 },
  bottomBar: { flexDirection: "row" as const, gap: 12, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: theme.surface, borderTopWidth: 1, borderColor: theme.border },
  botBtn: { flex: 1, alignItems: "center" as const, paddingVertical: 11, borderRadius: 12 },
  botIn: { backgroundColor: theme.accent },
  botOut: { backgroundColor: theme.danger },
  botBtnTxt: { color: "#fff", fontWeight: "700" as const, fontSize: 15 },
  tip: { fontSize: 12, color: theme.text2, marginBottom: 8 },
  fieldLabel: { fontSize: 13, fontWeight: "700" as const, color: theme.text1, marginTop: 10, marginBottom: 6 },
  link: { color: theme.accent, fontWeight: "700" as const, fontSize: 13, marginTop: 6 },
  csv: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 10, fontSize: 13, color: theme.text1, minHeight: 88, textAlignVertical: "top" as const },
  seg: { flexDirection: "row" as const, gap: 8, marginTop: 10 },
  batchRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderColor: theme.border },
  batchRowName: { flex: 1, fontSize: 13, color: theme.text1 },
  uInput: { width: 64, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, fontSize: 13, color: theme.text1, textAlign: "center" as const },
};
