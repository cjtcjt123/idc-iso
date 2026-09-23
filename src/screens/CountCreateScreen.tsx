import React, { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { apiCollect, apiPost, request } from "../api/client";
import type { CountTaskVM, Customer } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Button, Card, EmptyState, Input, Loading, Sheet } from "../components/ui";
import { theme } from "../theme";

const KINDS = [
  { v: "stock", label: "库存物品" },
  { v: "device", label: "架上设备" },
];
const SCOPES = [
  { v: "all", label: "全部" },
  { v: "by_customer", label: "按客户" },
  { v: "by_location", label: "按库位" },
  { v: "by_category", label: "按分类" },
  { v: "by_rack", label: "按机柜" },
];

export function CountCreateScreen({ navigation }: any) {
  const { currentRoomId } = useAuth();
  const [kind, setKind] = useState<"stock" | "device">("stock");
  const [scopeType, setScopeType] = useState("all");
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

  const create = async () => {
    if (!cust) {
      Alert.alert("请选择客户");
      return;
    }
    if (!currentRoomId) {
      Alert.alert("请先切换机房");
      return;
    }
    setBusy(true);
    try {
      const t = await apiPost<CountTaskVM>("/inventory/counts", {
        kind,
        customerId: cust.id,
        roomId: currentRoomId,
        scopeType,
        scopeLabel: SCOPES.find((s) => s.v === scopeType)?.label || "全部",
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
            <TouchableOpacity key={k.v} style={[styles.chip, kind === k.v && styles.chipOn]} onPress={() => setKind(k.v as any)}>
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
          {SCOPES.map((s) => (
            <TouchableOpacity key={s.v} style={[styles.chip, scopeType === s.v && styles.chipOn]} onPress={() => setScopeType(s.v)}>
              <Text style={[styles.chipText, scopeType === s.v && styles.chipTextOn]}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

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
