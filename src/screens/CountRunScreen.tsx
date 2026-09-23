import React, { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { apiGet, apiPatch, apiPost } from "../api/client";
import type { CountItemVM, CountTaskVM } from "../api/types";
import { Button, Card, EmptyState, Input, Loading, Sheet } from "../components/ui";
import { theme } from "../theme";

const RESULT_LABEL: Record<string, string> = {
  pending: "待盘",
  found: "正常",
  missing: "缺失",
  misplaced: "移位",
  unexpected: "盘盈",
};
const resultTint = (r?: string): [string, string] => {
  switch (r) {
    case "found":
      return [theme.ok, theme.okSoft];
    case "missing":
      return [theme.danger2, theme.dangerSoft];
    case "misplaced":
      return [theme.warn, theme.warnSoft];
    case "unexpected":
      return [theme.purple, theme.purpleSoft];
    default:
      return [theme.text3, theme.surfaceAlt];
  }
};

export function CountRunScreen({ route, navigation }: any) {
  const { id } = route.params;
  const [task, setTask] = useState<CountTaskVM | null>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [unexpected, setUnexpected] = useState(false);
  const [unexpName, setUnexpName] = useState("");
  const [itemSheet, setItemSheet] = useState<CountItemVM | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const t = await apiGet<CountTaskVM>(`/inventory/counts/${id}`);
      setTask(t);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const scan = async () => {
    const c = code.trim();
    if (!c) {
      Alert.alert("请输入或扫描编码");
      return;
    }
    setBusy(true);
    try {
      const r = await apiPost<{ matched: boolean; item?: CountItemVM; task: CountTaskVM }>(
        `/inventory/counts/${id}/scan`,
        { code: c }
      );
      setTask(r.task);
      setCode("");
      if (!r.matched) {
        setUnexpected(true);
      } else {
        Alert.alert("已核对", r.item?.result === "misplaced" ? "机柜不一致 · 标记移位" : "正常");
      }
    } catch (e: any) {
      Alert.alert("核对失败", e?.message || "操作失败");
    } finally {
      setBusy(false);
    }
  };

  const addUnexpected = async () => {
    if (!code.trim()) {
      Alert.alert("请先填写盘盈编码");
      return;
    }
    setBusy(true);
    try {
      const t = await apiPost<CountTaskVM>(`/inventory/counts/${id}/unexpected`, {
        code: code.trim(),
        name: unexpName.trim() || undefined,
      });
      setTask(t);
      setUnexpected(false);
      setUnexpName("");
      setCode("");
    } catch (e: any) {
      Alert.alert("登记失败", e?.message || "操作失败");
    } finally {
      setBusy(false);
    }
  };

  const setResult = async (result: string) => {
    if (!itemSheet) return;
    setBusy(true);
    try {
      const t = await apiPatch<CountTaskVM>(`/inventory/counts/${id}/items/${itemSheet.id}`, {
        result,
        actualQty: task?.kind === "stock" ? itemSheet.bookQty ?? 0 : undefined,
      });
      setTask(t);
      setItemSheet(null);
    } catch (e: any) {
      Alert.alert("操作失败", e?.message || "操作失败");
    } finally {
      setBusy(false);
    }
  };

  const finish = () => {
    Alert.alert("结束盘点", "未盘项将标记缺失，库存盘点将按实盘调账。", [
      { text: "取消", style: "cancel" },
      {
        text: "结束",
        onPress: async () => {
          setBusy(true);
          try {
            await apiPost(`/inventory/counts/${id}/finish`);
            navigation.replace("CountReport", { id });
          } catch (e: any) {
            Alert.alert("结束失败", e?.message || "操作失败");
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  if (loading) return <Loading />;
  if (!task) return <EmptyState text="未找到盘点任务" />;

  const items = task.items || [];

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <View>
          <Text style={styles.headTitle}>{task.kind === "device" ? "设备盘点" : "库存盘点"} · {task.customerName}</Text>
          <Text style={styles.headSub}>
            已盘 {task.counted}/{task.total}
            {task.missing ? `  ·  缺失 ${task.missing}` : ""}
            {task.misplaced ? `  ·  移位 ${task.misplaced}` : ""}
            {task.unexpected ? `  ·  盘盈 ${task.unexpected}` : ""}
          </Text>
        </View>
        <Button label="结束" onPress={finish} loading={busy} style={styles.finishBtn} />
      </View>

      <View style={styles.scanBar}>
        <Input value={code} onChangeText={setCode} placeholder="扫描或输入 SN / 编码" style={styles.scanInput} />
        <Button label="核对" onPress={scan} loading={busy} style={styles.scanBtn} />
      </View>

      <ScrollView style={styles.list}>
        {items.length === 0 ? (
          <EmptyState text="暂无盘点项" />
        ) : (
          items.map((it) => {
            const [fg, bg] = resultTint(it.result);
            return (
              <TouchableOpacity key={it.id} activeOpacity={0.9} onPress={() => setItemSheet(it)}>
                <Card>
                  <View style={styles.itTop}>
                    <Text style={styles.itName} numberOfLines={1}>
                      {it.name}
                    </Text>
                    <View style={[styles.tag, { backgroundColor: bg }]}>
                      <Text style={[styles.tagText, { color: fg }]}>{RESULT_LABEL[it.result || "pending"]}</Text>
                    </View>
                  </View>
                  <Text style={styles.itSub}>
                    {it.sn ? `SN ${it.sn}  ` : ""}
                    {it.groupKey ? `分组 ${it.groupKey}` : ""}
                    {task.kind === "stock" ? `  ·  账面 ${it.bookQty ?? 0}` : ""}
                  </Text>
                </Card>
              </TouchableOpacity>
            );
          })
        )}
        <View style={styles.foot} />
      </ScrollView>

      {/* 盘盈登记 */}
      <Sheet visible={unexpected} title="盘盈登记" onClose={() => setUnexpected(false)} scrollable>
        <Text style={styles.fLabel}>编码</Text>
        <Input value={code} onChangeText={setCode} placeholder="清单外编码" />
        <Text style={styles.fLabel}>名称（可选）</Text>
        <Input value={unexpName} onChangeText={setUnexpName} placeholder="便于识别" />
        <Button label="登记盘盈" onPress={addUnexpected} loading={busy} />
      </Sheet>

      {/* 逐条核对 */}
      <Sheet visible={!!itemSheet} title="核对结果" onClose={() => setItemSheet(null)} scrollable>
        {itemSheet ? (
          <>
            <Text style={styles.itName}>{itemSheet.name}</Text>
            <Text style={styles.fLabel}>标记</Text>
            <View style={styles.chipRow}>
              {["found", "missing", "misplaced", "pending"].map((r) => (
                <TouchableOpacity key={r} style={[styles.chip, itemSheet.result === r && styles.chipOn]} onPress={() => setResult(r)}>
                  <Text style={[styles.chipText, itemSheet.result === r && styles.chipTextOn]}>{RESULT_LABEL[r]}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Button label="保存" onPress={() => setResult(itemSheet.result || "found")} loading={busy} />
          </>
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  headTitle: { fontSize: 17, fontWeight: "700", color: theme.text1 },
  headSub: { fontSize: 12, color: theme.text3, marginTop: 4 },
  finishBtn: { marginHorizontal: 0, marginTop: 0, paddingVertical: 8, paddingHorizontal: 18 },
  scanBar: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  scanInput: { flex: 1 },
  scanBtn: { marginHorizontal: 0, marginTop: 0, paddingHorizontal: 20, justifyContent: "center" },
  list: { flex: 1 },
  itTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  itName: { fontSize: 15, fontWeight: "600", color: theme.text1, flex: 1, marginRight: 8 },
  itSub: { fontSize: 12, color: theme.text3, marginTop: 6 },
  tag: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 7 },
  tagText: { fontSize: 11, fontWeight: "700" },
  fLabel: { fontSize: 13, color: theme.text2, marginTop: 12, marginBottom: 6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceAlt },
  chipOn: { backgroundColor: theme.accentSoft, borderColor: theme.accent },
  chipText: { fontSize: 13, color: theme.text2, fontWeight: "600" },
  chipTextOn: { color: theme.accent },
  foot: { height: 20 },
});
