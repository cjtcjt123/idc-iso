import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { apiGet } from "../api/client";
import type { CountReportVM, CountItemVM } from "../api/types";
import { Card, EmptyState, Loading } from "../components/ui";
import { theme } from "../theme";

const RESULT_LABEL: Record<string, string> = {
  missing: "缺失",
  misplaced: "移位",
  unexpected: "盘盈",
};

export function CountReportScreen({ route }: any) {
  const { id } = route.params;
  const [rep, setRep] = useState<CountReportVM | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await apiGet<CountReportVM>(`/inventory/counts/${id}/report`);
        setRep(r);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <Loading />;
  if (!rep) return <EmptyState text="未找到盘点报告" />;

  const s = rep.summary || {};
  const stats: { label: string; val: number; color: string }[] = [
    { label: "总计", val: s.total ?? 0, color: theme.text1 },
    { label: "已盘", val: s.counted ?? 0, color: theme.accent },
    { label: "正常", val: s.found ?? 0, color: theme.ok },
    { label: "缺失", val: s.missing ?? 0, color: theme.danger2 },
    { label: "移位", val: s.misplaced ?? 0, color: theme.warn },
    { label: "盘盈", val: s.unexpected ?? 0, color: theme.purple },
  ];
  const todo = rep.todo || [];

  return (
    <ScrollView style={styles.root}>
      <Card>
        <Text style={styles.title}>
          {rep.task.kind === "device" ? "设备盘点" : "库存盘点"} · {rep.task.customerName}
        </Text>
        <Text style={styles.sub}>{rep.task.scopeLabel || "全部"}</Text>
        <View style={styles.statGrid}>
          {stats.map((st) => (
            <View key={st.label} style={styles.statCell}>
              <Text style={[styles.statVal, { color: st.color }]}>{st.val}</Text>
              <Text style={styles.statLabel}>{st.label}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <Text style={styles.secTitle}>待整改清单（{todo.length}）</Text>
        {todo.length === 0 ? (
          <Text style={styles.muted}>无差异，盘点一致 ✅</Text>
        ) : (
          todo.map((it: CountItemVM) => (
            <View key={it.id} style={styles.todoRow}>
              <View style={[styles.todoTag, { backgroundColor: tagBg(it.result) }]}>
                <Text style={[styles.todoTagText, { color: tagFg(it.result) }]}>{RESULT_LABEL[it.result || "missing"]}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.todoName} numberOfLines={1}>
                  {it.name}
                </Text>
                <Text style={styles.todoSub}>
                  {it.sn ? `SN ${it.sn}  ` : ""}
                  {it.groupKey ? `分组 ${it.groupKey}` : ""}
                </Text>
              </View>
            </View>
          ))
        )}
      </Card>
      <View style={styles.foot} />
    </ScrollView>
  );
}

const tagFg = (r?: string) => (r === "misplaced" ? theme.warn : r === "unexpected" ? theme.purple : theme.danger2);
const tagBg = (r?: string) => (r === "misplaced" ? theme.warnSoft : r === "unexpected" ? theme.purpleSoft : theme.dangerSoft);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  title: { fontSize: 17, fontWeight: "700", color: theme.text1 },
  sub: { fontSize: 12, color: theme.text3, marginTop: 4 },
  statGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 14, gap: 8 },
  statCell: { width: "30%", backgroundColor: theme.surfaceAlt, borderRadius: 12, padding: 12, alignItems: "center" },
  statVal: { fontSize: 22, fontWeight: "800" },
  statLabel: { fontSize: 12, color: theme.text2, marginTop: 4 },
  secTitle: { fontSize: 15, fontWeight: "700", color: theme.text1, marginBottom: 8 },
  muted: { fontSize: 14, color: theme.ok, paddingVertical: 8 },
  todoRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.border },
  todoTag: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 7 },
  todoTagText: { fontSize: 11, fontWeight: "700" },
  todoName: { fontSize: 14, fontWeight: "600", color: theme.text1 },
  todoSub: { fontSize: 11.5, color: theme.text3, marginTop: 3 },
  foot: { height: 20 },
});
