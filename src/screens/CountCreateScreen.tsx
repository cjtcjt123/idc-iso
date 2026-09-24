import React, { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { apiCollect, apiList, apiPost, request } from "../api/client";
import type { CountTaskVM, Customer } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Button, Card, EmptyState, Input, Loading, Sheet } from "../components/ui";
import { theme } from "../theme";

const KINDS = [
  { v: "stock", label: "库存物品" },
  { v: "device", label: "架上设备" },
];
/**
 * 收窄范围：后端 collectRows 只认这几组组合（客户本身是必选项，不再单列 by_customer）
 *  - kind=device → by_rack（rackId）
 *  - kind=stock  → by_location（locationId）/ by_category（categoryId）
 */
const SCOPES_BY_KIND: Record<string, { v: string; label: string }[]> = {
  device: [
    { v: "all", label: "全部机柜" },
    { v: "by_rack", label: "按机柜" },
  ],
  stock: [
    { v: "all", label: "全部库位" },
    { v: "by_location", label: "按库位" },
    { v: "by_category", label: "按分类" },
  ],
};
function flattenCats(nodes: any[], out: { id: string; label: string }[] = []): { id: string; label: string }[] {
  for (const n of nodes || []) {
    if (n && n.id) out.push({ id: n.id, label: n.name || "" });
    if (n && n.children?.length) flattenCats(n.children, out);
  }
  return out;
}

export function CountCreateScreen({ navigation }: any) {
  const { currentRoomId } = useAuth();
  const [kind, setKind] = useState<"stock" | "device">("stock");
  const [scopeType, setScopeType] = useState("all");
  const [scopeId, setScopeId] = useState("");
  const [scopeLabel, setScopeLabel] = useState("全部库位");
  const [scopeOpts, setScopeOpts] = useState<{ id: string; label: string }[]>([]);
  const [scopeSheet, setScopeSheet] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cust, setCust] = useState<Customer | null>(null);
  const [remark, setRemark] = useState("");
  const [preview, setPreview] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [custSheet, setCustSheet] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setCustomers(await apiCollect<Customer>("/customers"));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const refreshPreview = async () => {
    if (!cust || !currentRoomId) {
      setPreview(null);
      return;
    }
    try {
      const r = await request<{ count: number }>("GET", "/inventory/counts/preview", undefined, {
        customerId: cust.id,
        kind,
        roomId: currentRoomId,
      });
      setPreview(r.count);
    } catch {
      setPreview(null);
    }
  };

  useEffect(() => {
    refreshPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cust, kind, currentRoomId]);

  /** 按范围类型加载可选项（此前只有 chip 没有 scopeId，选了「按机柜/按库位」等同「全部」） */
  const loadScope = async () => {
    if (scopeType === "all") { setScopeOpts([]); return; }
    try {
      if (scopeType === "by_rack") {
        const r = await apiList<any>("/racks", { roomId: currentRoomId || undefined, pageSize: 200 });
        setScopeOpts((r.data || []).map((x: any) => ({ id: x.id, label: x.code || x.name || "" })));
      } else if (scopeType === "by_location") {
        const l = await apiCollect<any>("/inventory/locations");
        setScopeOpts((l || []).map((x: any) => ({ id: x.id, label: x.code || x.name || "" })));
      } else if (scopeType === "by_category") {
        const c = await apiCollect<any>("/inventory/categories");
        setScopeOpts(flattenCats(c));
      } else {
        setScopeOpts([]);
      }
    } catch { setScopeOpts([]); }
  };

  useEffect(() => {
    setScopeId("");
    setScopeLabel(SCOPES_BY_KIND[kind]?.find((s) => s.v === scopeType)?.label || "全部");
    loadScope();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeType, kind, currentRoomId]);

  const onKindChange = (v: "stock" | "device") => {
    if (v === kind) return;
    setKind(v);
    setScopeType("all");
    setScopeId("");
  };

  const create = async () => {
    if (!cust) {
      Alert.alert("请选择客户");
      return;
    }
    if (!currentRoomId) {
      Alert.alert("请先切换机房");
      return;
    }
    if (scopeType !== "all" && !scopeId) {
      Alert.alert("请选择具体的盘点范围");
      return;
    }
    setBusy(true);
    try {
      const t = await apiPost<CountTaskVM>("/inventory/counts", {
        kind,
        customerId: cust.id,
        roomId: currentRoomId,
        scopeType,
        scopeId: scopeType === "all" ? undefined : scopeId,
        scopeLabel,
        remark: remark.trim() || undefined,
      });
      navigation.replace("CountRun", { id: t.id });
    } catch (e: any) {
      Alert.alert("创建失败", e?.message || "操作失败");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <ScrollView style={styles.root}>
      <Card>
        <Text style={styles.secTitle}>盘点类型</Text>
        <View style={styles.chipRow}>
          {KINDS.map((k) => (
            <TouchableOpacity key={k.v} style={[styles.chip, kind === k.v && styles.chipOn]} onPress={() => onKindChange(k.v as any)}>
              <Text style={[styles.chipText, kind === k.v && styles.chipTextOn]}>{k.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.secTitle}>客户（必选）</Text>
        <TouchableOpacity style={styles.picker} onPress={() => setCustSheet(true)}>
          <Text style={cust ? styles.pickVal : styles.pickPh}>{cust?.name || "选择客户"}</Text>
        </TouchableOpacity>

        <Text style={styles.secTitle}>范围</Text>
        <View style={styles.chipRow}>
          {(SCOPES_BY_KIND[kind] || []).map((s) => (
            <TouchableOpacity key={s.v} style={[styles.chip, scopeType === s.v && styles.chipOn]} onPress={() => setScopeType(s.v)}>
              <Text style={[styles.chipText, scopeType === s.v && styles.chipTextOn]}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {scopeType !== "all" ? (
          <TouchableOpacity style={styles.picker} onPress={() => setScopeSheet(true)}>
            <Text style={scopeId ? styles.pickVal : styles.pickPh}>
              {scopeId ? scopeLabel : `选择${scopeType === "by_rack" ? "机柜" : scopeType === "by_location" ? "库位" : "分类"}`}
            </Text>
          </TouchableOpacity>
        ) : null}

        <Text style={styles.secTitle}>备注</Text>
        <Input value={remark} onChangeText={setRemark} placeholder="可选" />
      </Card>

      <Card>
        <Text style={styles.secTitle}>预览</Text>
        {preview == null ? (
          <Text style={styles.muted}>选择客户后显示预计盘点条数</Text>
        ) : (
          <Text style={styles.preview}>预计盘点 <Text style={styles.previewNum}>{preview}</Text> 条</Text>
        )}
      </Card>

      <Button label="发起盘点" onPress={create} loading={busy} style={styles.createBtn} />
      {customers.length === 0 ? <EmptyState text="暂无客户可选" /> : null}

      <Sheet visible={scopeSheet} title="选择盘点范围" onClose={() => setScopeSheet(false)} scrollable>
        {scopeOpts.length === 0 ? <EmptyState text="暂无可选项" /> : null}
        {scopeOpts.map((o) => (
          <TouchableOpacity
            key={o.id}
            style={styles.pickItem}
            onPress={() => { setScopeId(o.id); setScopeLabel(o.label); setScopeSheet(false); }}
          >
            <Text style={styles.pickItemText}>{o.label}</Text>
          </TouchableOpacity>
        ))}
      </Sheet>

      <Sheet visible={custSheet} title="选择客户" onClose={() => setCustSheet(false)} scrollable>
        {customers.map((c) => (
          <TouchableOpacity
            key={c.id}
            style={styles.pickItem}
            onPress={() => { setCust(c); setCustSheet(false); }}
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
  secTitle: { fontSize: 14, fontWeight: "700", color: theme.text1, marginTop: 14, marginBottom: 8 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceAlt },
  chipOn: { backgroundColor: theme.accentSoft, borderColor: theme.accent },
  chipText: { fontSize: 13, color: theme.text2, fontWeight: "600" },
  chipTextOn: { color: theme.accent },
  picker: { backgroundColor: theme.surfaceAlt, borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  pickVal: { fontSize: 15, color: theme.text1 },
  pickPh: { fontSize: 15, color: theme.text3 },
  muted: { fontSize: 13, color: theme.text3 },
  preview: { fontSize: 15, color: theme.text1 },
  previewNum: { fontSize: 20, fontWeight: "800", color: theme.accent },
  createBtn: { marginHorizontal: 16, marginTop: 8 },
  pickItem: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.border },
  pickItemText: { fontSize: 15, color: theme.text1 },
});
