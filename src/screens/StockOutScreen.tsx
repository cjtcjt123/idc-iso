import React, { useEffect, useState } from "react";
import { Alert, FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { apiList, apiPost } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useCan } from "../auth/permission";
import { Badge, Button, EmptyState, Input, ListRow, Loading, Sheet } from "../components/ui";
import { theme } from "../theme";

const OUTBOUND_TYPES = [
  { value: "ISSUE", label: "领用出库" },
  { value: "BORROW_OUT", label: "借用出库" },
  { value: "PICKUP", label: "客户提货" },
];

type Cart = {
  id: string;
  kind: "material" | "device";
  name: string;
  unit: string;
  quantity: number;
  hasSN: boolean;
  serials: string[];
  pickedSNs: string[];
  serialPicked: boolean[];
  outQty: string;
  recipient: string;
  reason: string;
  note: string;
  submitState: "idle" | "success" | "failed";
  submitError: string;
};

export function StockOutScreen({ navigation }: any) {
  const { currentRoomId, user } = useAuth();
  const can = useCan();
  const canInventory = can("inventory", "update");

  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [activePicker, setActivePicker] = useState<"" | "customer" | "outbound">("");
  const [outboundIdx, setOutboundIdx] = useState(0);

  const [keyword, setKeyword] = useState("");
  const [searchResults, setSearchResults] = useState<Cart[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [items, setItems] = useState<Cart[]>([]);

  const [docRecipient, setDocRecipient] = useState("");
  const [docReason, setDocReason] = useState("");
  const [docNote, setDocNote] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<{ name: string; ok: boolean; error?: string }[]>([]);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    apiList<any>("/customers", { pageSize: 100, roomId: currentRoomId || undefined }).then((r) => setCustomers(r.data || [])).catch(() => setCustomers([]));
    if (user) setDocRecipient((user as any).displayName || (user as any).username || "");
  }, []);

  /** 只负责查，返回卡片列表（供手动搜索与扫码共用） */
  const runSearch = async (q: string): Promise<Cart[]> => {
    if (!customerId) { alert("请先选择客户"); return []; }
    const room = currentRoomId || undefined;
    const [inst, dev] = await Promise.all([
      apiList<any>("/inventory/instances", { page: 1, pageSize: 50, search: q || undefined, roomId: room, customerId }),
      apiList<any>("/devices", { page: 1, pageSize: 50, placement: "inventory", search: q || undefined, roomId: room, customerId }),
    ]);
    const me = docRecipient || (user as any)?.displayName || "";
    const cards: Cart[] = (inst.data || []).map((it: any) => buildCard(it, "material", me))
      .concat((dev.data || []).map((d: any) => buildCard(d, "device", me)));
    const inCart = new Set(items.map((i) => i.id));
    setSearchResults(cards.map((c) => ({ ...c, submitState: inCart.has(c.id) ? "success" : "idle" })));
    return cards;
  };

  const search = async (q: string) => {
    try {
      await runSearch(q);
      setShowSearch(true);
    } catch (e: any) { alert(e?.message || "搜索失败"); }
  };

  /** 扫码回来：把命中的物品直接加入出库单（唯一命中直接加，否则让用户挑） */
  const onScanned = async (code: string) => {
    setKeyword(code);
    try {
      const cards = await runSearch(code);
      if (cards.length === 1) addCard(cards[0]);
      else setShowSearch(true);
    } catch (e: any) { alert(e?.message || "搜索失败"); }
  };

  const addCard = (p: Cart) => {
    if (!p) return;
    if (items.some((i) => i.id === p.id)) { alert("已在出库单中"); setShowSearch(false); return; }
    const card: Cart = {
      ...p, submitState: "idle", submitError: "",
      outQty: p.kind === "device" ? "1" : (p.hasSN ? "0" : "1"),
      serialPicked: p.serials.map(() => false), pickedSNs: [],
    };
    setItems((arr) => [...arr, card]);
    setShowSearch(false);
  };

  const pickFromSearch = (idx: number) => addCard(searchResults[idx]);

  const setItem = (id: string, patch: Partial<Cart>) => setItems((arr) => arr.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const removeItem = (id: string) => setItems((arr) => arr.filter((i) => i.id !== id));

  const toggleSN = (id: string, sn: string) => {
    const it = items.find((i) => i.id === id);
    if (!it) return;
    const picked = it.pickedSNs.includes(sn) ? it.pickedSNs.filter((s) => s !== sn) : [...it.pickedSNs, sn];
    const serialPicked = it.serials.map((s) => picked.includes(s));
    setItem(id, { pickedSNs: picked, serialPicked, outQty: String(picked.length) });
  };

  const canSubmit = items.length > 0 && !!customerId && !!docRecipient.trim() && canInventory;

  const submit = async () => {
    if (!customerId) { alert("请先选择客户"); return; }
    if (items.length === 0) { alert("请先选择出库物品"); return; }
    if (!docRecipient.trim()) { alert("请填写领用人"); return; }
    const snMissing = items.filter((i) => i.kind === "material" && i.hasSN && i.pickedSNs.length === 0);
    if (snMissing.length) { alert(`请选择「${snMissing[0].name}」的出库 SN`); return; }
    const qtyBad = items.find((i) => i.kind === "material" && !i.hasSN && (!(Number(i.outQty) >= 1) || Number(i.outQty) > i.quantity));
    if (qtyBad) { alert(`「${qtyBad.name}」数量需为 1 ~ ${qtyBad.quantity}`); return; }
    const confirmed = await new Promise<boolean>((res) => Alert.alert("确认出库", `将对 ${items.length} 种物品执行出库`, [{ text: "取消", onPress: () => res(false) }, { text: "确认", onPress: () => res(true) }]));
    if (!confirmed) return;
    setSubmitting(true);
    const op = OUTBOUND_TYPES[outboundIdx]?.value || "ISSUE";
    const map: Record<string, { state: "success" | "failed"; error?: string }> = {};
    for (const it of items) {
      try {
        if (it.kind === "device") {
          await apiPost(`/devices/${it.id}/dismount`, { reason: docReason || "迁出出库", destination: "shipped" });
        } else {
          await apiPost(`/inventory/instances/${it.id}/stock-out`, {
            quantity: Number(it.outQty) || 1,
            operationType: op,
            reason: docReason || undefined,
            destination: docRecipient || undefined,
            note: docNote.trim() || undefined,
            customerId,
            serials: it.pickedSNs.length ? it.pickedSNs : undefined,
          });
        }
        map[it.id] = { state: "success" };
      } catch (e: any) { map[it.id] = { state: "failed", error: e?.message || "失败" }; }
    }
    const out = items.map((it) => {
      const r = map[it.id];
      return { name: it.name, ok: r?.state === "success", error: r?.error };
    });
    const remaining: Cart[] = [];
    for (const it of items) {
      const r = map[it.id];
      if (r && r.state === "failed") remaining.push({ ...it, submitState: "failed", submitError: r.error || "失败" });
    }
    setItems(remaining);
    setSubmitting(false);
    setResults(out); setShowResult(true);
  };

  const pickerOptions = (): { id: string; name: string }[] => {
    if (activePicker === "customer") return customers;
    if (activePicker === "outbound") return OUTBOUND_TYPES.map((o) => ({ id: o.value, name: o.label }));
    return [];
  };
  const onPickerPick = (id: string) => {
    if (activePicker === "customer") {
      setCustomerId(id);
      setItems([]);
    } else if (activePicker === "outbound") setOutboundIdx(OUTBOUND_TYPES.findIndex((o) => o.value === id));
    setActivePicker("");
  };

  if (!canInventory) {
    return <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: "center", justifyContent: "center" }}><EmptyState text="无库存写权限" /></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView style={{ flex: 1 }}>
        <View style={s.form}>
          <Field label="往来客户 *" value={customers.find((c) => c.id === customerId)?.name || "请选择"} onPress={() => setActivePicker("customer")} />
          <Field label="出库类型" value={OUTBOUND_TYPES[outboundIdx]?.label || "领用出库"} onPress={() => setActivePicker("outbound")} />
          <TouchableOpacity style={s.scanBtn} onPress={() => navigation.navigate("Scan", { mode: "pick", onPick: (code: string) => { onScanned(code); } })}>
            <Text style={s.scanTxt}>扫一扫（条码 / SN）加入出库单</Text>
          </TouchableOpacity>
          <View style={s.searchRow}>
            <Input value={keyword} onChangeText={setKeyword} placeholder="搜索物品名称 / 型号 / SN" />
            <TouchableOpacity style={s.searchGo} onPress={() => search(keyword)}><Text style={s.searchGoTxt}>搜索</Text></TouchableOpacity>
          </View>
          <Input placeholder="领用人 *" value={docRecipient} onChangeText={setDocRecipient} />
          <Input placeholder="原因（选填）" value={docReason} onChangeText={setDocReason} />
          <Input placeholder="备注（选填）" value={docNote} onChangeText={setDocNote} />

          <Text style={s.secTitle}>出库单（{items.length}）</Text>
          {items.length === 0 ? <EmptyState text="搜索或扫码加入出库单" /> : null}
          {items.map((it) => (
            <View key={it.id} style={[s.rowCard, it.submitState === "failed" && s.rowFail]}>
              <View style={s.rowHead}>
                <Badge label={it.kind === "material" ? "物料" : "设备"} color={it.kind === "material" ? theme.purple : theme.accent} />
                <Text style={s.rowName} numberOfLines={1}>{it.name}</Text>
                <TouchableOpacity onPress={() => removeItem(it.id)}><Text style={s.del}>✕</Text></TouchableOpacity>
              </View>
              {it.kind === "material" && it.hasSN ? (
                <View style={s.snWrap}>
                  {it.serials.map((sn, i) => (
                    <TouchableOpacity key={sn} style={[s.snChip, it.serialPicked[i] && s.snOn]} onPress={() => toggleSN(it.id, sn)}>
                      <Text style={[s.snTxt, it.serialPicked[i] && s.snTxtOn]} numberOfLines={1}>{sn}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : it.kind === "material" ? (
                <View style={s.qtyRow}>
                  <Text style={s.qtyLab}>数量（库存 {it.quantity}）</Text>
                  <TextInput style={s.qtyInput} value={it.outQty} onChangeText={(t) => setItem(it.id, { outQty: t })} keyboardType="number-pad" placeholderTextColor={theme.text3} />
                </View>
              ) : (
                <Text style={s.devHint}>设备出库：按整机下架</Text>
              )}
              {it.submitState === "failed" ? <Text style={s.failMsg}>{it.submitError}</Text> : null}
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={s.footer}>
        <Button label={submitting ? "提交中…" : "确认出库"} onPress={submit} loading={submitting} disabled={!canSubmit} />
      </View>

      <Sheet visible={showSearch} title="选择物品" onClose={() => setShowSearch(false)} scrollable>
        <View>
          <Input value={keyword} onChangeText={(t) => { setKeyword(t); search(t); }} placeholder="搜索物品名称 / 型号 / SN" />
          <FlatList data={searchResults} keyExtractor={(c) => c.id} style={{ maxHeight: 380 }} renderItem={({ item }) => (
            <ListRow title={item.name} subtitle={item.kind === "device" ? "库存待用设备" : `库存 ${item.quantity}${item.unit || ""}`} onPress={() => addCard(item)} />
          )} ListEmptyComponent={<EmptyState text="无匹配物品" />} />
        </View>
      </Sheet>

      <Sheet visible={!!activePicker} title={activePicker === "customer" ? "选择客户" : "出库类型"} onClose={() => setActivePicker("")} scrollable>
        <View>
          {pickerOptions().map((o) => <ListRow key={o.id} title={o.name} onPress={() => onPickerPick(o.id)} />)}
          {pickerOptions().length === 0 ? <EmptyState text="暂无选项" /> : null}
        </View>
      </Sheet>

      <Sheet visible={showResult} title={`出库结果 ${results.filter((r) => r.ok).length}/${results.length}`} onClose={() => setShowResult(false)} scrollable>
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

function buildCard(it: any, kind: "material" | "device", me: string): Cart {
  const serials: string[] = kind === "material" ? (it.serials || []) : (it.serialNumber ? [it.serialNumber] : []);
  return {
    id: it.id,
    kind,
    name: kind === "material" ? (it.name || "未命名物料") : (it.model?.name || it.type || it.name || "未指定型号"),
    unit: it.unit || "",
    quantity: kind === "material" ? (it.quantity || 0) : 1,
    hasSN: serials.length > 0,
    serials,
    pickedSNs: [],
    serialPicked: serials.map(() => false),
    outQty: "1",
    recipient: me,
    reason: "",
    note: "",
    submitState: "idle",
    submitError: "",
  };
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
  secTitle: { fontSize: 13, fontWeight: "700", color: theme.text1, marginTop: 8, marginBottom: 6 },
  rowCard: { backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, padding: 12, marginBottom: 10, gap: 8 },
  rowFail: { borderColor: theme.danger },
  rowHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowName: { flex: 1, fontSize: 14, fontWeight: "700", color: theme.text1 },
  del: { color: theme.danger, fontSize: 15, padding: 4 },
  snWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  snChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceAlt, maxWidth: 140 },
  snOn: { backgroundColor: theme.accent, borderColor: theme.accent },
  snTxt: { fontSize: 12, color: theme.text2 },
  snTxtOn: { color: "#fff", fontWeight: "700" },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  qtyLab: { fontSize: 13, color: theme.text2, flex: 1 },
  qtyInput: { width: 80, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: theme.text1, textAlign: "center" },
  devHint: { fontSize: 12, color: theme.text3 },
  failMsg: { fontSize: 12, color: theme.danger },
  field: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 8 },
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
