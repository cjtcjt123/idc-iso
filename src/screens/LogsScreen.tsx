import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { request } from "../api/client";
import type { OperationFeed, OperationFeedItem } from "../api/types";
import { ActivityRow, Card, Chip, EmptyState, Loading, SearchBar } from "../components/ui";
import { theme } from "../theme";

// kind 筛选 → 后端 kind 参数（逗号多值，不含 audit 即业务流水）
const KINDS: { key: string; label: string; param: string }[] = [
  { key: "all", label: "全部", param: "all" },
  { key: "mat", label: "物料", param: "mat" },
  { key: "dev", label: "设备", param: "dev-mount,dev-dismount,dev-in,dev-out" },
  { key: "audit", label: "审计", param: "audit" },
];

function describe(f: OperationFeedItem): { title: string; sub: string; meta: string } {
  const p = f.payload || {};
  const at = f.occurredAt ? new Date(f.occurredAt).toLocaleString() : "";
  const op = p.operator?.displayName || p.operator?.username || "";
  if (f.kind === "mat") {
    return {
      title: p.reason || p.itemInstance?.name || p.note || "物料流水",
      sub: [p.operationType, p.quantity != null ? `x${p.quantity}` : "", p.batchNo ? `批${p.batchNo}` : ""]
        .filter(Boolean)
        .join("  "),
      meta: [p.warehouse?.name, p.customer?.name, op, at].filter(Boolean).join("  "),
    };
  }
  if (f.kind === "audit") {
    return {
      title: p.resourceName || p.action || "审计",
      sub: p.action || "",
      meta: [op, at].filter(Boolean).join("  "),
    };
  }
  // dev-* 设备上下架 / 出入库
  return {
    title: p.deviceName || p.item?.name || p.sn || "设备操作",
    sub: [p.rackName ? `机柜 ${p.rackName}` : "", p.location, p.reason || p.remark].filter(Boolean).join("  "),
    meta: [p.customerName, p.modelName, op, at].filter(Boolean).join("  "),
  };
}

export function LogsScreen() {
  const [items, setItems] = useState<OperationFeedItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [kind, setKind] = useState("all");
  const [q, setQ] = useState("");

  const fetchPage = async (reset: boolean, kindParam: string, kw: string, cur: string | null) => {
    reset ? setLoading(true) : setLoadingMore(true);
    try {
      const r = await request<OperationFeed>("GET", "/inventory/operations", undefined, {
        limit: 30,
        kind: kindParam,
        q: kw || undefined,
        cursor: cur || undefined,
      });
      const list = r.data || [];
      setItems(reset ? list : (prev) => [...prev, ...list]);
      setCursor(r.nextCursor);
      setHasMore(!!r.hasMore);
    } catch (e: any) {
      if (reset) setItems([]);
    } finally {
      reset ? setLoading(false) : setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchPage(true, KINDS.find((k) => k.key === kind)!.param, q, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, q]);

  const onFilter = (k: string) => {
    if (k === kind) return;
    setKind(k);
  };

  return (
    <View style={styles.root}>
      <SearchBar value={q} onChangeText={setQ} placeholder="搜索操作记录" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters} contentContainerStyle={styles.filtersInner}>
        {KINDS.map((k) => (
          <Chip key={k.key} label={k.label} active={kind === k.key} onPress={() => onFilter(k.key)} />
        ))}
      </ScrollView>

      {loading ? (
        <Loading />
      ) : items.length === 0 ? (
        <EmptyState text="暂无操作记录" />
      ) : (
        <ScrollView style={styles.list}>
          <Card>
            {items.map((f) => {
              const d = describe(f);
              return <ActivityRow key={f.uid} kind={f.kind} desc={d.title} meta={[d.sub, d.meta].filter(Boolean).join("  ")} />;
            })}
          </Card>
          {hasMore ? (
            <TouchableOpacity style={styles.more} onPress={() => fetchPage(false, KINDS.find((k) => k.key === kind)!.param, q, cursor)} disabled={loadingMore}>
              {loadingMore ? <ActivityIndicator color={theme.accent} /> : <Text style={styles.moreText}>加载更多</Text>}
            </TouchableOpacity>
          ) : null}
          <View style={styles.foot} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  filters: { maxHeight: 44, paddingLeft: 10 },
  filtersInner: { paddingVertical: 6 },
  list: { flex: 1 },
  more: { alignItems: "center", paddingVertical: 16 },
  moreText: { color: theme.accent, fontSize: 14, fontWeight: "600" },
  foot: { height: 20 },
});
