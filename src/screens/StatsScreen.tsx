import React, { useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { apiGet } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { DashboardStats } from "../api/types";
import { Card, EmptyState, Loading, ProgressBar, SectionCard, StatCard } from "../components/ui";
import { theme } from "../theme";

type Tab = "device" | "rack" | "inv";

const TAB_LABEL: Record<Tab, string> = {
  device: "按设备",
  rack: "按机柜",
  inv: "按库存",
};

interface BarRow {
  customerId: string;
  label: string;
  value: number;
}

/** 简易水平条形图：调用处将 (name, value) 投影成 BarRow 数组，避免泛型回调签名塌缩 */
function HBar({ rows, max }: { rows: BarRow[]; max: number }) {
  return (
    <View>
      {rows.map((r) => {
        const pct = max > 0 ? Math.max(2, (r.value / max) * 100) : 0;
        return (
          <View key={r.customerId} style={styles.barRow}>
            <Text style={styles.barLabel} numberOfLines={1}>
              {r.label}
            </Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${pct}%` }]} />
            </View>
            <Text style={styles.barVal}>{r.value}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function StatsScreen() {
  const { currentRoomId } = useAuth();
  const [tab, setTab] = useState<Tab>("device");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await apiGet<DashboardStats>(`/stats/dashboard?roomId=${currentRoomId || ""}`);
      setStats(res);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, [currentRoomId]);

  const totals = useMemo(() => {
    if (!stats) return null;
    return {
      devices: stats.devices.total,
      racks: stats.racks.total,
      rackUtil: stats.racks.utilization,
      invQty: stats.inventory.total,
      customers: stats.customers.total,
    };
  }, [stats]);

  if (loading) return <Loading />;
  if (!stats || !totals) return <EmptyState text="暂无统计数据" />;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <View style={styles.totals}>
        <StatCard icon="📦" colors={theme.grad.device} label="设备总数" value={String(totals.devices)} sub={`${stats.devices.server} 服务器`} />
        <StatCard icon="▦" colors={theme.grad.rack} label="机柜总数" value={String(totals.racks)} sub={`利用率 ${totals.rackUtil}%`} bar={totals.rackUtil} />
      </View>
      <View style={styles.totals}>
        <StatCard icon="▤" colors={theme.grad.inventory} label="库存数量" value={String(totals.invQty)} sub={`${totals.customers} 客户`} />
        <StatCard icon="👥" colors={theme.grad.customer} label="客户" value={String(totals.customers)} sub="活跃" />
      </View>

      {/* 分段 */}
      <View style={styles.tabs}>
        {(Object.keys(TAB_LABEL) as Tab[]).map((k) => (
          <TouchableOpacity
            key={k}
            style={[styles.tab, tab === k && styles.tabOn]}
            onPress={() => setTab(k)}
            activeOpacity={0.85}
          >
            <Text style={[styles.tabText, tab === k && styles.tabTextOn]}>{TAB_LABEL[k]}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.wrap}>
        {tab === "device" && (
          <SectionCard title="设备分布（按客户）">
            <HBar
              rows={stats.devices.byCustomer.map((c) => ({ customerId: c.customerId, label: c.name, value: c.total }))}
              max={Math.max(1, ...stats.devices.byCustomer.map((c) => c.total))}
            />
            {stats.devices.byCustomer.length === 0 ? <EmptyState text="暂无数据" /> : null}
          </SectionCard>
        )}
        {tab === "rack" && (
          <SectionCard title="机柜占用（按客户）">
            <HBar
              rows={stats.racks.byCustomer.map((c) => ({ customerId: c.customerId, label: c.name, value: c.usedRacks }))}
              max={Math.max(1, ...stats.racks.byCustomer.map((c) => c.usedRacks))}
            />
            {stats.racks.byCustomer.length === 0 ? <EmptyState text="暂无数据" /> : null}
            <View style={{ marginTop: 10 }}>
              <ProgressBar percent={totals.rackUtil} />
              <Text style={styles.barFooter}>U 位利用率 {stats.racks.uUsed} / {stats.racks.uTotal}</Text>
            </View>
          </SectionCard>
        )}
        {tab === "inv" && (
          <SectionCard title="库存数量（按客户）">
            <HBar
              rows={stats.inventory.byCustomer.map((c) => ({ customerId: c.customerId, label: c.name, value: c.quantity }))}
              max={Math.max(1, ...stats.inventory.byCustomer.map((c) => c.quantity))}
            />
            {stats.inventory.byCustomer.length === 0 ? <EmptyState text="暂无数据" /> : null}
          </SectionCard>
        )}

        {/* 生命周期近 12 月沿用 DashboardScreen 的 MiniBarChart */}
        {stats.lifecycle && stats.lifecycle.length > 0 ? (
          <SectionCard title="近 12 月上下架">
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, height: 80 }}>
              {(() => {
                const max = Math.max(1, ...stats.lifecycle.map((m) => Math.max(m.mount, m.dismount)));
                return stats.lifecycle.map((m, i) => (
                  <View key={i} style={{ flex: 1, alignItems: "center" }}>
                    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 3, height: 58 }}>
                      <View style={[styles.barUp, { height: (m.mount / max) * 56 }]} />
                      <View style={[styles.barDown, { height: (m.dismount / max) * 56 }]} />
                    </View>
                    <Text style={styles.tickLabel}>{m.label}</Text>
                  </View>
                ));
              })()}
            </View>
            <View style={styles.legend}>
              <View style={[styles.legDot, { backgroundColor: theme.accent }]} />
              <Text style={styles.legTxt}>上架</Text>
              <View style={[styles.legDot, { backgroundColor: "#cdd6e6", marginLeft: 12 }]} />
              <Text style={styles.legTxt}>下架</Text>
            </View>
          </SectionCard>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  totals: { flexDirection: "row", paddingHorizontal: 10, marginTop: 10 },
  tabs: {
    flexDirection: "row",
    backgroundColor: theme.surface,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 4,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 9 },
  tabOn: { backgroundColor: theme.accent },
  tabText: { fontSize: 13, fontWeight: "600", color: theme.text2 },
  tabTextOn: { color: "#fff" },
  wrap: { paddingHorizontal: 16, paddingBottom: 24 },
  barRow: { flexDirection: "row", alignItems: "center", marginVertical: 6 },
  barLabel: { width: 72, fontSize: 12, color: theme.text2 },
  barTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: theme.track, marginHorizontal: 8, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 4, backgroundColor: theme.accent },
  barVal: { width: 36, textAlign: "right", fontSize: 12, color: theme.text1, fontWeight: "600" },
  barUp: { width: 6, borderRadius: 3, backgroundColor: theme.accent },
  barDown: { width: 6, borderRadius: 3, backgroundColor: "#cdd6e6" },
  tickLabel: { fontSize: 9, color: theme.text3, marginTop: 3 },
  legend: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  legDot: { width: 8, height: 8, borderRadius: 4 },
  legTxt: { fontSize: 11, color: theme.text3, marginLeft: 4 },
  barFooter: { fontSize: 11, color: theme.text3, marginTop: 4 },
});