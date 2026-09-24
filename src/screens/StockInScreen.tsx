import React, { useEffect, useRef, useState } from "react";
import { Alert, FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { apiCollect, apiList, apiPost } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useCan } from "../auth/permission";
import type { Rack } from "../api/types";
import { Badge, Button, EmptyState, Input, ListRow, Loading, Sheet } from "../components/ui";
import { theme } from "../theme";

const INBOUND_TYPES = [
  { value: "PURCHASE", label: "采购入库" },
  { value: "CONSIGN_IN", label: "寄存入库" },
  { value: "RETURN_IN", label: "退库入库" },
];

type Row = {
  key: string;
  kind: "material" | "newDevice";
  productId: string;
  productName: string;
  productModel: string;
  instanceId: string;
  serialNumber: string;
  deviceType: string;
  modelId: string;
  categoryId: string;
  quantity: string;
  serialsText: string;
  locationId: string;
  note: string;
  added: boolean;
  mountNow: boolean;
  rackId: string;
  rackName: string;
  uPosition: string;
  renamed?: boolean;
};

let _seq = 0;
function racksForCustomer(racks: Rack[], custId: string, custType: string): Rack[] {
  if (!custId) return [];
  const isRetail = custType === "retail";
  return racks.filter((r) => (r.ownershipMode === "shared" ? isRetail : r.customerId === custId));
}
function splitSerials(t: string): string[] {
  return String(t || "").split(/[\n,，\s]+/).map((s) => s.trim()).filter(Boolean);
}
function flattenCats(nodes: any[], out: { id: string; name: string }[] = []): { id: string; name: string }[] {
  for (const n of nodes || []) { if (n && n.id) out.push({ id: n.id, name: n.name || "" }); if (n && n.children?.length) flattenCats(n.children, out); }
  return out;
}

export function StockInScreen({ navigation }: any) {
  const { currentRoomId } = useAuth();
  const can = useCan();
  const canInventory = can("inventory", "update");

  const [customers, setCustomers] = useState<{ id: string; name: string; customerType: string }[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [custType, setCustType] = useState("");
  const [activePicker, setActivePicker] = useState<"" | "customer" | "inbound" | "location" | "category" | "rack">("");
  const [activeRowKey, setActiveRowKey] = useState("");
  const [inboundIdx, setInboundIdx] = useState(0);
  const [locations, setLocations] = useState<{ id: string; label: string }[]>([]);
  const [racks, setRacks] = useState<Rack[]>([]);
  const [devCats, setDevCats] = useState<{ id: string; name: string }[]>([]);

  const [keyword, setKeyword] = useState("");
  const [products, setProducts] = useState<any[]>([]);
  const [showProductSheet, setShowProductSheet] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<{ name: string; ok: boolean; error?: string }[]>([]);
  const [showResult, setShowResult] = useState(false);
  const loading = useRef(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const room = currentRoomId || undefined;
    const [c, loc, rk, dc] = await Promise.allSettled([
      apiList<any>("/customers", { pageSize: 100, roomId: room }),
      apiCollect<any>("/inventory/locations"),
      room ? apiList<Rack>("/racks", { roomId: room, pageSize: 200 }) : Promise.resolve({ data: [] as Rack[] }),
      apiCollect<any>("/device-categories"),
    ]);
    if (c.status === "fulfilled") setCustomers(c.value.data || []);
    if (loc.status === "fulfilled") setLocations((loc.value as any[]).map((l) => ({ id: l.id, label: l.code || l.name || "" })));
    if (rk.status === "fulfilled") setRacks(rk.value.data || []);
    if (dc.status === "fulfilled") setDevCats(flattenCats(dc.value as any[]));
  };

  const searchProducts = async (q: string) => {
    loading.current = true;
    try {
      const res = await apiList<any>("/inventory/items", { q: q || undefined, pageSize: 50 });
      setProducts(res.data || []);
    } catch { setProducts([]); }
    finally { loading.current = false; }
  };

  /** 扫码回来：按条码查物品，唯一命中直接加入入库单，否则打开选择弹层 */
  const onScanned = async (code: string) => {
    setKeyword(code);
    try {
      const res = await apiList<any>("/inventory/items", { q: code, pageSize: 50 });
      const list = res.data || [];
      setProducts(list);
      if (list.length === 1) addMaterial(list[0]);
      else setShowProductSheet(true);
    } catch { setShowProductSheet(true); }
  };

  const addMaterial = (p: any) => {
    const key = `r-${++_seq}`;
    setRows((rs) => [...rs, {
      key, kind: "material", productId: p.id || "", productName: p.name || "未命名物料",
      productModel: p.model || "", instanceId: "", serialNumber: "", deviceType: "", modelId: "",
      categoryId: "", quantity: "1", serialsText: "", locationId: locations[0]?.id || "", note: "",
      added: true, mountNow: false, rackId: "", rackName: "", uPosition: "",
    }]);
    setShowProductSheet(false);
  };
  const addDevice = () => {
    const key = `r-${++_seq}`;
    setRows((rs) => [...rs, {
      key, kind: "newDevice", productId: "", productName: "新建设备入库", productModel: "", instanceId: "",
      serialNumber: "", deviceType: "", modelId: "", categoryId: "", quantity: "1", serialsText: "",
      locationId: locations[0]?.id || "", note: "", added: true, mountNow: false, rackId: "", rackName: "", uPosition: "",
    }]);
  };

  const setRow = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const removeRow = (key: string) => setRows((rs) => rs.filter((r) => r.key !== key));

  const onCustomerPick = (id: string) => {
    const c = customers.find((x) => x.id === id);
    setCustomerId(id); setCustType(c?.customerType || ""); setActivePicker("");
  };

  const canSubmit = rows.some((r) => r.added) && !!customerId && canInventory;

  const submit = async () => {
    if (!customerId) { alert("请先选择所属客户"); return; }
    if (!rows.some((r) => r.added)) { alert("请先加入至少一个入库物品"); return; }
    const devMissing = rows.filter((r) => r.added && r.kind === "newDevice" && !r.serialNumber.trim());
    if (devMissing.length) { alert("设备入库行请填写 SN"); return; }
    const devNoType = rows.filter((r) => r.added && r.kind === "newDevice" && !r.deviceType.trim());
    if (devNoType.length) { alert("设备入库行请填写设备型号"); return; }
    const confirmed = await new Promise<boolean>((res) => Alert.alert("确认入库", `将对 ${rows.filter((r) => r.added).length} 种物品执行入库`, [{ text: "取消", onPress: () => res(false) }, { text: "确认", onPress: () => res(true) }]));
    if (!confirmed) return;
    setSubmitting(true);
    const room = currentRoomId || undefined;
    const op = INBOUND_TYPES[inboundIdx]?.value || "PURCHASE";
    const out: { name: string; ok: boolean; error?: string }[] = [];
    for (const r of rows.filter((x) => x.added)) {
      const label = r.productName || r.serialNumber || "物品";
      try {
        if (r.kind === "newDevice") {
          const mountNow = !!r.mountNow && !!r.rackId && Number(r.uPosition) > 0;
          await apiPost("/devices", {
            placement: "inventory",
            ...(mountNow ? { rackId: r.rackId, uPosition: Number(r.uPosition) } : {}),
            serialNumber: r.serialNumber.trim(),
            modelId: r.modelId || undefined,
            type: r.deviceType.trim() || undefined,
            categoryId: r.categoryId || undefined,
            customerId,
            roomId: room,
            locationId: r.locationId || undefined,
            description: r.note.trim() || undefined,
            source: op,
          });
          out.push({ name: label, ok: true });
          continue;
        }
        let instanceId = r.instanceId;
        if (!instanceId) {
          const exist = await apiList<any>("/inventory/instances", { customerId, inventoryItemId: r.productId || undefined, roomId: room, pageSize: 1 });
          if (exist.data && exist.data.length) instanceId = exist.data[0].id;
          else {
            const created: any = await apiPost("/inventory/instances", {
              name: r.productName, inventoryItemId: r.productId || undefined, customerId,
              quantity: 0, roomId: room, locationId: r.locationId || undefined,
            });
            instanceId = created.id;
          }
        }
        const serials = splitSerials(r.serialsText);
        await apiPost(`/inventory/instances/${instanceId}/stock-in`, {
          quantity: Number(r.quantity) || 1,
          operationType: op,
          reason: r.note.trim() || undefined,
          referenceNo: r.note.trim() || undefined,
          note: r.note.trim() || undefined,
          customerId,
          serials: serials.length ? serials : undefined,
        });
        out.push({ name: label, ok: true });
      } catch (e: any) { out.push({ name: label, ok: false, error: e?.message || "失败" }); }
    }
    setSubmitting(false);
    setResults(out); setShowResult(true);
  };

  const pickerOptions = (): { id: string; name: string }[] => {
    if (activePicker === "customer") return customers.map((c) => ({ id: c.id, name: c.name }));
    if (activePicker === "inbound") return INBOUND_TYPES.map((o) => ({ id: o.value, name: o.label }));
    if (activePicker === "location") return locations.map((l) => ({ id: l.id, name: l.label }));
    if (activePicker === "category") return devCats;
    if (activePicker === "rack") {
      const row = rows.find((r) => r.key === activeRowKey);
      return racksForCustomer(racks, customerId, custType).map((r) => ({ id: r.id, name: r.code || r.name || "" }));
    }
    return [];
  };
  const onPickerPick = (id: string) => {
    if (activePicker === "customer") onCustomerPick(id);
    else if (activePicker === "inbound") setInboundIdx(INBOUND_TYPES.findIndex((o) => o.value === id));
    else if (activePicker === "location") setRow(activeRowKey, { locationId: id });
    else if (activePicker === "category") setRow(activeRowKey, { categoryId: id });
    else if (activePicker === "rack") setRow(activeRowKey, { rackId: id, rackName: pickerOptions().find((o) => o.id === id)?.name || "" });
    setActivePicker(""); setActiveRowKey("");
  };

  if (!canInventory) {
    return <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: "center", justifyContent: "center" }}><EmptyState text="无库存写权限" /></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView style={{ flex: 1 }}>
        <View style={s.form}>
          <Field label="归属客户 *" value={customers.find((c) => c.id === customerId)?.name || "请选择"} onPress={() => setActivePicker("customer")} />
          <Field label="入库类型" value={INBOUND_TYPES[inboundIdx]?.label || "采购入库"} onPress={() => setActivePicker("inbound")} />

          <TouchableOpacity style={s.scanBtn} onPress={() => navigation.navigate("Scan", { mode: "pick", onPick: (code: string) => { onScanned(code); } })}>
            <Text style={s.scanTxt}>扫一扫（条码 / SN）加入入库单</Text>
          </TouchableOpacity>
          <View style={s.searchRow}>
            <Input value={keyword} onChangeText={(t) => { setKeyword(t); searchProducts(t); }} placeholder="搜索物品名称 / 型号" />
            <TouchableOpacity style={s.searchGo} onPress={() => { searchProducts(keyword); setShowProductSheet(true); }}><Text style={s.searchGoTxt}>选择</Text></TouchableOpacity>
          </View>
          <TouchableOpacity style={s.addDev} onPress={addDevice}><Text style={s.addDevTxt}>＋ 新建设备入库</Text></TouchableOpacity>

          <Text style={s.secTitle}>入库单（{rows.filter((r) => r.added).length}）</Text>
          {rows.length === 0 ? <EmptyState text="从上方搜索或新建设备加入入库单" /> : null}
          {rows.map((r) => (
            <View key={r.key} style={s.rowCard}>
              <View style={s.rowHead}>
                <Badge label={r.kind === "material" ? "物料" : "设备"} color={r.kind === "material" ? theme.purple : theme.accent} />
                <Text style={s.rowName} numberOfLines={1}>{r.productName}</Text>
                <TouchableOpacity onPress={() => removeRow(r.key)}><Text style={s.del}>✕</Text></TouchableOpacity>
              </View>
              {r.kind === "newDevice" ? (
                <View>
                  <Input placeholder="SN *" value={r.serialNumber} onChangeText={(t) => setRow(r.key, { serialNumber: t })} />
                  <Input placeholder="设备型号 *" value={r.deviceType} onChangeText={(t) => setRow(r.key, { deviceType: t })} />
                  <Field label="设备分类" value={devCats.find((c) => c.id === r.categoryId)?.name || "请选择"} onPress={() => { setActiveRowKey(r.key); setActivePicker("category"); }} />
                  <TouchableOpacity style={s.mountToggle} onPress={() => setRow(r.key, { mountNow: !r.mountNow })}>
                    <Text style={[s.mountToggleTxt, r.mountNow && s.mountOn]}>{r.mountNow ? "✓ 直接上架到机柜" : "直接上架到机柜"}</Text>
                  </TouchableOpacity>
                  {r.mountNow ? (
                    <View>
                      <Field label="目标机柜" value={r.rackName || "请选择"} onPress={() => { setActiveRowKey(r.key); setActivePicker("rack"); }} />
                      <Input placeholder="U 位（如 10）" value={r.uPosition} onChangeText={(t) => setRow(r.key, { uPosition: t })} />
                    </View>
                  ) : null}
                </View>
              ) : (
                <View>
                  <View style={s.qtyRow}>
                    <Text style={s.qtyLab}>数量</Text>
                    <TextInput style={s.qtyInput} value={r.quantity} onChangeText={(t) => setRow(r.key, { quantity: t })} keyboardType="number-pad" placeholderTextColor={theme.text3} />
                  </View>
                  <TextInput style={s.area} value={r.serialsText} onChangeText={(t) => {
                    const s = splitSerials(t).length;
                    setRow(r.key, { serialsText: t, quantity: s > 0 ? String(s) : r.quantity });
                  }} placeholder="SN 列表（逗号/换行分隔，有 SN 时数量自动同步）" multiline numberOfLines={2} placeholderTextColor={theme.text3} />
                </View>
              )}
              <Field label="入库库位" value={locations.find((l) => l.id === r.locationId)?.label || "请选择"} onPress={() => { setActiveRowKey(r.key); setActivePicker("location"); }} />
              <Input placeholder="备注（选填）" value={r.note} onChangeText={(t) => setRow(r.key, { note: t })} />
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={s.footer}>
        <Button label={submitting ? "提交中…" : "确认入库"} onPress={submit} loading={submitting} disabled={!canSubmit} />
      </View>

      {/* 物品选择弹层 */}
      <Sheet visible={showProductSheet} title="选择物品" onClose={() => setShowProductSheet(false)} scrollable>
        <View>
          <Input value={keyword} onChangeText={(t) => { setKeyword(t); searchProducts(t); }} placeholder="搜索物品名称 / 型号" />
          <FlatList data={products} keyExtractor={(p) => p.id || p.name} style={{ maxHeight: 360 }} renderItem={({ item }) => (
            <ListRow title={item.name} subtitle={item.model ? `型号 ${item.model}` : undefined} onPress={() => addMaterial(item)} />
          )} ListEmptyComponent={<EmptyState text={keyword ? `无匹配「${keyword}」的物品` : "无匹配物品"} />} />
        </View>
      </Sheet>

      {/* 通用选择弹层 */}
      <Sheet visible={!!activePicker} title={activePicker === "customer" ? "选择客户" : activePicker === "inbound" ? "入库类型" : activePicker === "location" ? "入库库位" : activePicker === "category" ? "设备分类" : "目标机柜"} onClose={() => { setActivePicker(""); setActiveRowKey(""); }} scrollable>
        <View>
          {pickerOptions().map((o) => (
            <ListRow key={o.id} title={o.name} onPress={() => onPickerPick(o.id)} />
          ))}
          {pickerOptions().length === 0 ? <EmptyState text="暂无选项" /> : null}
        </View>
      </Sheet>

      {/* 提交结果汇总 */}
      <Sheet visible={showResult} title={`入库结果 ${results.filter((r) => r.ok).length}/${results.length}`} onClose={() => setShowResult(false)} scrollable>
        <View>
          {results.map((r, i) => (
            <View key={i} style={s.resRow}>
              <Text style={s.resName} numberOfLines={1}>{r.name}</Text>
              <Text style={[s.resState, r.ok ? s.resOk : s.resFail]}>{r.ok ? "成功" : r.error || "失败"}</Text>
            </View>
          ))}
        </View>
      </Sheet>
    </View>
  );
}

function Field({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.field} onPress={onPress}>
      <Text style={s.fieldLab}>{label}</Text>
      <View style={s.fieldRight}><Text style={s.fieldVal} numberOfLines={1}>{value}</Text><Text style={s.caret}>›</Text></View>
    </TouchableOpacity>
  );
}

function alert(msg: string) { Alert.alert("提示", msg); }

const s = StyleSheet.create({
  form: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12 },
  scanBtn: { backgroundColor: theme.accentSoft, borderRadius: 12, paddingVertical: 12, alignItems: "center", marginBottom: 10 },
  scanTxt: { color: theme.accent, fontWeight: "700", fontSize: 14 },
  searchRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  searchGo: { backgroundColor: theme.accent, borderRadius: 12, paddingHorizontal: 16, justifyContent: "center" },
  searchGoTxt: { color: "#fff", fontWeight: "700", fontSize: 14 },
  addDev: { borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingVertical: 10, alignItems: "center", marginBottom: 8 },
  addDevTxt: { color: theme.text2, fontWeight: "600", fontSize: 13 },
  secTitle: { fontSize: 13, fontWeight: "700", color: theme.text1, marginTop: 8, marginBottom: 6 },
  rowCard: { backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, padding: 12, marginBottom: 10, gap: 8 },
  rowHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowName: { flex: 1, fontSize: 14, fontWeight: "700", color: theme.text1 },
  del: { color: theme.danger, fontSize: 15, padding: 4 },
  mountToggle: { borderWidth: 1, borderColor: theme.border, borderRadius: 10, paddingVertical: 9, alignItems: "center" },
  mountToggleTxt: { color: theme.text2, fontSize: 13, fontWeight: "600" },
  mountOn: { color: theme.accent, borderColor: theme.accent },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  qtyLab: { fontSize: 13, color: theme.text2 },
  qtyInput: { flex: 1, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: theme.text1, textAlign: "center" },
  area: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 10, fontSize: 13, color: theme.text1, minHeight: 64, textAlignVertical: "top" },
  field: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11 },
  fieldLab: { fontSize: 13, color: theme.text2 },
  fieldRight: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1, justifyContent: "flex-end" },
  fieldVal: { fontSize: 14, color: theme.text1 },
  caret: { color: theme.text3, fontSize: 16 },
  footer: { padding: 12, backgroundColor: theme.surface, borderTopWidth: 1, borderColor: theme.border },
  resRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderColor: theme.border },
  resName: { flex: 1, fontSize: 13, color: theme.text1 },
  resState: { fontSize: 12, fontWeight: "700" },
  resOk: { color: theme.ok },
  resFail: { color: theme.danger },
});
