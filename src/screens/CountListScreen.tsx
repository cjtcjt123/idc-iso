import React, { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { apiDelete, apiGet } from "../api/client";
import type { CountTaskVM } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Button, Card, EmptyState, Loading, ProgressBar } from "../components/ui";
import { theme } from "../theme";

const kindLabel = (k?: string) => (k === "device" ? "设备盘点" : "库存盘点");
const statusLabel = (s?: string) => (s === "done" ? "已结束" : s === "counting" ? "盘点中" : "草稿");
const statusTint = (s?: string): [string, string] =>
  s === "done" ? [theme.text2, theme.border] : [theme.accent, theme.accentSoft];

export function CountListScreen({ navigation }: any) {
  const { currentRoomId } = useAuth();
  const [tasks, setTasks] = useState<CountTaskVM[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await apiGet<CountTaskVM[]>("/inventory/counts");
      setTasks(r || []);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remove = (t: CountTaskVM) => {
    Alert.alert("删除盘点任务", `${kindLabel(t.kind)} · ${t.customerName || ""}`, [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          try {
            await apiDelete(`/inventory/counts/${t.id}`);
            load();
          } catch (e: any) {
            Alert.alert("删除失败", e?.message || "操作失败");
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <Text style={styles.headTitle}>盘点任务</Text>
        <Button label="新建" onPress={() => navigation.navigate("CountCreate")} style={styles.newBtn} />
      </View>
      {loading ? (
        <Loading />
      ) : tasks.length === 0 ? (
        <EmptyState text="暂无盘点任务" />
      ) : (
        <ScrollView style={styles.list}>
          {tasks.map((t) => {
            const [fg, bg] = statusTint(t.status);
            const total = t.total || 0;
            const counted = t.counted || 0;
            const pct = total ? Math.round((counted / total) * 100) : 0;
            return (
              <Card>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() =>
                    navigation.navigate(t.status === "done" ? "CountReport" : "CountRun", { id: t.id })
                  }
                >
                  <View style={styles.rowTop}>
                    <Text style={styles.title}>
                      {kindLabel(t.kind)} · {t.customerName || "—"}
                    </Text>
                    <View style={[styles.tag, { backgroundColor: bg }]}>
                      <Text style={[styles.tagText, { color: fg }]}>{statusLabel(t.status)}</Text>
                    </View>
                  </View>
                  <Text style={styles.sub}>
                    {t.scopeLabel || "全部"}
                    {t.operatorName ? `  ·  盘点人 ${t.operatorName}` : ""}
                  </Text>
                  <View style={styles.barRow}>
                    <ProgressBar percent={pct} />
                    <Text style={styles.barNum}>
                      {counted}/{total}
                    </Text>
                  </View>
                  {(t.missing || t.misplaced || t.unexpected) ? (
                    <Text style={styles.diff}>
                      差异：缺失 {t.missing || 0} · 移位 {t.misplaced || 0} · 盘盈 {t.unexpected || 0}
                    </Text>
                  ) : null}
                </TouchableOpacity>
                {t.status !== "done" ? (
                  <TouchableOpacity activeOpacity={0.8} style={styles.delRow} onPress={() => remove(t)}>
                    <Text style={styles.delText}>删除此任务</Text>
                  </TouchableOpacity>
                ) : null}
              </Card>
            );
          })}
          <View style={styles.foot} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  headTitle: { fontSize: 22, fontWeight: "700", color: theme.text1 },
  newBtn: { marginHorizontal: 0, marginTop: 0, paddingVertical: 8, paddingHorizontal: 18, alignSelf: "flex-end" },
  list: { flex: 1 },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 15, fontWeight: "700", color: theme.text1, flex: 1 },
  tag: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 7 },
  tagText: { fontSize: 11, fontWeight: "700" },
  sub: { fontSize: 12, color: theme.text3, marginTop: 6 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  barNum: { fontSize: 12, color: theme.text2, fontWeight: "600" },
  diff: { fontSize: 12, color: theme.warn, marginTop: 8 },
  foot: { height: 20 },
  delRow: { borderTopWidth: 1, borderColor: theme.border, marginTop: 10, paddingTop: 10, alignItems: "center" },
  delText: { color: theme.danger, fontSize: 14, fontWeight: "700" },
});
