import React, { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { apiCollect, apiGet, apiList, apiPost } from "../api/client";
import type { Customer, InventoryInstance, ItemInstanceHistory, Warehouse } from "../api/types";
import { useCan } from "../auth/permission";
import { Button, Card, EmptyState, Input, Loading, Sheet } from "../components/ui";
import { theme } from "../theme";

const OP_LABEL: Record<string, string> = {
  PURCHASE: "采购入库",
  RECEIVE: "收货",
  TRANSFER_IN: "转入",
  TRANSFER_OUT: "转出",
  TRANSFER: "调拨",
  CHECKOUT: "领用",
  CHECK_IN: "入库",
  CHECK_OUT: "出库",
  SHIP: "发运",
  RETURN: "归还",
  REPAIR: "送修",
  SCRAP: "报废",
  ADJUST: "盘点调整",
  INSTALL: "安装",
  IN: "入库",
  OUT: "出库",
};
const opLabel = (t?: string) => (t && OP_LABEL[t]) || t || "记录";

const STATUS_LABEL: Record<string, string> = {
  in_stock: "在库",
  in_use: "使用中",
  in_repair: "送修",
  scrapped: "已报废",
  reserved: "预留",
};
const statusLabel = (s?: string | null) => (s ? STATUS_LABEL[s] || s : "—");

const CONDITIONS = [
  { v: "new", label: "全新" },
  { v: "good", label: "良品" },
  { v: "faulty", label: "故障" },
  { v: "pending_check", label: "待检测" },
  { v: "scrapped", label: "已报废" },
];

export function InstanceDetailScreen({ route }: any) {
  const { instanceId } = route.params;
  const can = useCan();
  const canEdit = can("inventory", "update");

  const [item, setItem] = useState<InventoryInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // 出入库
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState("");

  // SN 轨迹
  const [history, setHistory] = useState<ItemInstanceHistory[]>([]);
  const [histLoading, setHistLoading] = useState(false);

  // 弹层
  const [sheet, setSheet] = useState<null | "transfer" | "transfer-wh" | "transfer-cust" | "status" | "rma">(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // 调拨表单
  const [tfWh, setTfWh] = useState<Warehouse | null>(null);
  const [tfCust, setTfCust] = useState<Customer | null>(null);
  const [tfQty, setTfQty] = useState("1");
  const [tfLoc, setTfLoc] = useState("");
  const [tfReason, setTfReason] = useState("");

  // 状态变更表单
  const [stCond, setStCond] = useState("good");
  const [stReason, setStReason] = useState("");
  const [stLoc, setStLoc] = useState("");

  // RMA 表单
  const [rmaNo, setRmaNo] = useState(`RMA-${Date.now()}`);
  const [rmaDisp, setRmaDisp] = useState<"repair" | "scrap">("repair");
  const [rmaReason, setRmaReason] = useState("");

  const load = async () => {
    try {
      const d = await apiGet<InventoryInstance>(`/inventory/instances/${instanceId}`);
      setItem(d);
    } finally {
      setLoading(false);
    }
  };
  const loadHistory = async () => {
    setHistLoading(true);
    try {
      const r = await apiList<ItemInstanceHistory>(`/inventory/instances/${instanceId}/history`, {
        page: 1,
        pageSize: 50,
      });
      setHistory(r.data || []);
    } catch {
      /* 忽略轨迹加载失败，不影响详情 */
    } finally {
      setHistLoading(false);
    }
  };

  useEffect(() => {
    load();
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceId]);

  // 打开弹层时拉取仓库 / 客户（供选择目标）
  const openSheet = async (s: "transfer" | "status" | "rma") => {
    if (s === "transfer") {
      if (!warehouses.length) setWarehouses(await apiCollect<Warehouse>("/inventory/warehouses"));
      if (!customers.length) setCustomers(await apiCollect<Customer>("/customers"));
    }
    setSheet(s);
  };

  if (loading) return <Loading />;
  if (!item) return <EmptyState text="未找到物料" />;

  const move = async (kind: "stock-in" | "stock-out") => {
    const quantity = Number(qty);
    if (!Number.isInteger(quantity) || quantity < 1) {
      Alert.alert("请填写有效的数量（≥1 整数）");
      return;
    }
    setBusy(true);
    try {
      await apiPost(`/inventory/instances/${instanceId}/${kind}`, {
        quantity,
        reason: reason.trim() || undefined,
      });
      Alert.alert(kind === "stock-in" ? "已入库" : "已出库", `数量 ${quantity}`);
      reason && setReason("");
      load();
      loadHistory();
    } catch (e: any) {
      Alert.alert("操作失败", e?.message || "操作失败");
    } finally {
      setBusy(false);
    }
  };

  const closeSheet = () => setSheet(null);

  const doTransfer = async () => {
    const quantity = Number(tfQty);
    if (!Number.isInteger(quantity) || quantity < 1) {
      Alert.alert("请填写有效的调拨数量（≥1 整数）");
      return;
    }
    setBusy(true);
    try {
      await apiPost(`/inventory/instances/${instanceId}/transfer`, {
        toWarehouseId: tfWh?.id,
        toCustomerId: tfCust?.id,
        quantity,
        toLocation: tfLoc.trim() || undefined,
        reason: tfReason.trim() || undefined,
      });
      Alert.alert("调拨成功");
      setTfWh(null);
      setTfCust(null);
      setTfLoc("");
      setTfReason("");
      closeSheet();
      load();
      loadHistory();
    } catch (e: any) {
      Alert.alert("调拨失败", e?.message || "操作失败");
    } finally {
      setBusy(false);
    }
  };

  const doStatus = async () => {
    if (!stReason.trim()) {
      Alert.alert("请填写变更原因");
      return;
    }
    setBusy(true);
    try {
      await apiPost(`/inventory/instances/${instanceId}/status-change`, {
        condition: stCond,
        reason: stReason.trim(),
        toLocation: stLoc.trim() || undefined,
      });
      Alert.alert("状态已更新");
      setStReason("");
      setStLoc("");
      closeSheet();
      load();
      loadHistory();
    } catch (e: any) {
      Alert.alert("操作失败", e?.message || "操作失败");
    } finally {
      setBusy(false);
    }
  };

  const doRma = async () => {
    setBusy(true);
    try {
      await apiPost(`/inventory/instances/${instanceId}/rma`, {
        rmaNo: rmaNo.trim() || `RMA-${Date.now()}`,
        disposition: rmaDisp,
        reason: rmaReason.trim() || undefined,
      });
      Alert.alert(rmaDisp === "repair" ? "已送修" : "已报废");
      setRmaReason("");
      closeSheet();
      load();
      loadHistory();
    } catch (e: any) {
      Alert.alert("操作失败", e?.message || "操作失败");
    } finally {
      setBusy(false);
    }
  };

  const rows: [string, string][] = [
    ["名称", item.name || "—"],
    ["SN", item.sn || "—"],
    ["品牌", item.brand || "—"],
    ["型号", item.model || "—"],
    ["分类", item.categoryName || "—"],
    ["状态", statusLabel(item.status)],
    ["数量", item.quantity != null ? String(item.quantity) : "—"],
    ["所在仓库", item.warehouseName || "—"],
    ["归属客户", item.customerName || "—"],
  ];

  return (
    <ScrollView style={styles.root}>
      <Card>
        {rows.map(([k, v]) => (
          <View key={k} style={styles.rv}>
            <Text style={styles.rk}>{k}</Text>
            <Text style={styles.rv2}>{v}</Text>
          </View>
        ))}
      </Card>

      <Card>
        <Text style={styles.secTitle}>出入库</Text>
        <Input placeholder="数量（默认 1）" value={qty} onChangeText={setQty} />
        <Input placeholder="原因（可选）" value={reason} onChangeText={setReason} />
        <View style={styles.btnRow}>
          <Button label="入库 +" onPress={() => move("stock-in")} loading={busy} style={styles.halfBtn} />
          <Button label="出库 -" onPress={() => move("stock-out")} loading={busy} danger style={styles.halfBtn} />
        </View>
      </Card>

      {canEdit ? (
        <Card>
          <Text style={styles.secTitle}>操作</Text>
          <View style={styles.btnRow}>
            <Button label="调拨" onPress={() => openSheet("transfer")} style={styles.halfBtn} />
            <Button label="状态变更" onPress={() => openSheet("status")} style={styles.halfBtn} />
            <Button label="送修/报废" onPress={() => openSheet("rma")} style={styles.halfBtn} />
          </View>
        </Card>
      ) : null}

      <Card>
        <Text style={styles.secTitle}>SN 轨迹 / 台账</Text>
        {histLoading ? (
          <Text style={styles.muted}>加载中…</Text>
        ) : history.length === 0 ? (
          <Text style={styles.muted}>暂无流水</Text>
        ) : (
          history.map((h) => {
            const q = h.quantity ?? 0;
            const qStr = q > 0 ? `+${q}` : `${q}`;
            return (
              <View key={h.id} style={styles.hist}>
                <View style={styles.histTop}>
                  <View style={[styles.opTag, { backgroundColor: q > 0 ? theme.okSoft : theme.dangerSoft }]}>
                    <Text style={[styles.opTagText, { color: q > 0 ? theme.ok : theme.danger2 }]}>
                      {opLabel(h.operationType)}
                    </Text>
                  </View>
                  <Text style={[styles.qty, { color: q > 0 ? theme.ok : theme.danger2 }]}>{qStr}</Text>
                </View>
                {h.reason ? <Text style={styles.histReason}>{h.reason}</Text> : null}
                <Text style={styles.histMeta}>
                  {h.warehouse?.name ? `仓库 ${h.warehouse.name}  ` : ""}
                  {h.customer?.name ? `客户 ${h.customer.name}  ` : ""}
                  {h.operatedAt ? new Date(h.operatedAt).toLocaleString() : ""}
                </Text>
                {h.snList && h.snList.length ? (
                  <Text style={styles.histSn}>SN: {h.snList.join(", ")}</Text>
                ) : null}
              </View>
            );
          })
        )}
      </Card>

      {/* ── 调拨弹层 ── */}
      <Sheet visible={sheet === "transfer"} title="调拨" onClose={closeSheet} scrollable>
        <Text style={styles.fLabel}>目标仓库</Text>
        <TouchableOpacity style={styles.picker} onPress={() => setSheet("transfer-wh")}>
          <Text style={tfWh ? styles.pickerVal : styles.pickerPh}>{tfWh?.name || "选择仓库（可选，仅变更库位可不选）"}</Text>
        </TouchableOpacity>
        <Text style={styles.fLabel}>目标客户（领用 / 归还，可选）</Text>
        <TouchableOpacity style={styles.picker} onPress={() => setSheet("transfer-cust")}>
          <Text style={tfCust ? styles.pickerVal : styles.pickerPh}>{tfCust?.name || "选择客户（可选）"}</Text>
        </TouchableOpacity>
        <Text style={styles.fLabel}>数量</Text>
        <Input value={tfQty} onChangeText={setTfQty} placeholder="调拨数量" />
        <Text style={styles.fLabel}>目标库位</Text>
        <Input value={tfLoc} onChangeText={setTfLoc} placeholder="如 A-01-12U" />
        <Text style={styles.fLabel}>原因</Text>
        <Input value={tfReason} onChangeText={setTfReason} placeholder="可选" />
        <Button label="确认调拨" onPress={doTransfer} loading={busy} />
      </Sheet>

      {/* ── 状态变更弹层 ── */}
      <Sheet visible={sheet === "status"} title="状态 / 成色变更" onClose={closeSheet} scrollable>
        <Text style={styles.fLabel}>成色</Text>
        <View style={styles.chipRow}>
          {CONDITIONS.map((c) => (
            <TouchableOpacity
              key={c.v}
              style={[styles.pickChip, stCond === c.v && styles.pickChipOn]}
              onPress={() => setStCond(c.v)}
            >
              <Text style={[styles.pickChipText, stCond === c.v && styles.pickChipTextOn]}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.fLabel}>变更后库位</Text>
        <Input value={stLoc} onChangeText={setStLoc} placeholder="如 拆下存放位（可选）" />
        <Text style={styles.fLabel}>原因（必填）</Text>
        <Input value={stReason} onChangeText={setStReason} placeholder="如 拆机下架 / 坏件检测" />
        <Button label="确认变更" onPress={doStatus} loading={busy} />
      </Sheet>

      {/* ── RMA 弹层 ── */}
      <Sheet visible={sheet === "rma"} title="送修 / 报废" onClose={closeSheet} scrollable>
        <Text style={styles.fLabel}>处置方式</Text>
        <View style={styles.chipRow}>
          <TouchableOpacity
            style={[styles.pickChip, rmaDisp === "repair" && styles.pickChipOn]}
            onPress={() => setRmaDisp("repair")}
          >
            <Text style={[styles.pickChipText, rmaDisp === "repair" && styles.pickChipTextOn]}>送修</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pickChip, rmaDisp === "scrap" && styles.pickChipOn]}
            onPress={() => setRmaDisp("scrap")}
          >
            <Text style={[styles.pickChipText, rmaDisp === "scrap" && styles.pickChipTextOn]}>报废</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.fLabel}>返修单号</Text>
        <Input value={rmaNo} onChangeText={setRmaNo} placeholder="RMA 单号（空则自动生成）" />
        <Text style={styles.fLabel}>原因</Text>
        <Input value={rmaReason} onChangeText={setRmaReason} placeholder="可选" />
        <Button label={rmaDisp === "repair" ? "确认送修" : "确认报废"} onPress={doRma} loading={busy} danger={rmaDisp === "scrap"} />
      </Sheet>

      {/* ── 仓库 / 客户选择弹层 ── */}
      <Sheet visible={sheet === "transfer-wh"} title="选择目标仓库" onClose={() => setSheet("transfer")} scrollable>
        <TouchableOpacity style={styles.pickItem} onPress={() => { setTfWh(null); setSheet("transfer"); }}>
          <Text style={styles.pickItemText}>（不选 · 仅变更库位）</Text>
        </TouchableOpacity>
        {warehouses.map((w) => (
          <TouchableOpacity
            key={w.id}
            style={styles.pickItem}
            onPress={() => { setTfWh(w); setSheet("transfer"); }}
          >
            <Text style={styles.pickItemText}>{w.name}</Text>
          </TouchableOpacity>
        ))}
      </Sheet>
      <Sheet visible={sheet === "transfer-cust"} title="选择目标客户" onClose={() => setSheet("transfer")} scrollable>
        <TouchableOpacity style={styles.pickItem} onPress={() => { setTfCust(null); setSheet("transfer"); }}>
          <Text style={styles.pickItemText}>（不选）</Text>
        </TouchableOpacity>
        {customers.map((c) => (
          <TouchableOpacity
            key={c.id}
            style={styles.pickItem}
            onPress={() => { setTfCust(c); setSheet("transfer"); }}
          >
            <Text style={styles.pickItemText}>{c.name}</Text>
          </TouchableOpacity>
        ))}
      </Sheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  rv: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.border },
  rk: { fontSize: 14, color: theme.text2 },
  rv2: { fontSize: 14, color: theme.text1, fontWeight: "600", maxWidth: "62%" },
  secTitle: { fontSize: 15, fontWeight: "700", color: theme.text1, marginBottom: 10 },
  btnRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  halfBtn: { flex: 1, minWidth: 100, marginHorizontal: 0, marginTop: 8 },
  muted: { fontSize: 13, color: theme.text3, paddingVertical: 6 },
  hist: { paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.border },
  histTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  opTag: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 7 },
  opTagText: { fontSize: 12, fontWeight: "700" },
  qty: { fontSize: 15, fontWeight: "800" },
  histReason: { fontSize: 13, color: theme.text1, marginTop: 5 },
  histMeta: { fontSize: 11.5, color: theme.text3, marginTop: 4 },
  histSn: { fontSize: 11.5, color: theme.text2, marginTop: 2 },
  fLabel: { fontSize: 13, color: theme.text2, marginTop: 12, marginBottom: 6 },
  picker: { backgroundColor: theme.surfaceAlt, borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  pickerVal: { fontSize: 15, color: theme.text1 },
  pickerPh: { fontSize: 15, color: theme.text3 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  pickChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceAlt },
  pickChipOn: { backgroundColor: theme.accentSoft, borderColor: theme.accent },
  pickChipText: { fontSize: 13, color: theme.text2, fontWeight: "600" },
  pickChipTextOn: { color: theme.accent },
  pickItem: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.border },
  pickItemText: { fontSize: 15, color: theme.text1 },
});
