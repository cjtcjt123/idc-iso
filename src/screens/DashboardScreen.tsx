import React, { useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { apiCollect, apiGet, apiList } from "../api/client";
import type { DashboardStats, OperationRecord, Room } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import {
  ActivityRow,
  ACTIVITY_LABEL,
  HeroCard,
  IconChip,
  MiniBarChart,
  ProgressBar,
  RoomPill,
  SectionCard,
  StatCard,
} from "../components/ui";
import { theme } from "../theme";

// 与小程序首页一致：四类合一 feed（含 audit），取最近 8 条
const HOME_LOG_KINDS = "mat,dev-mount,dev-dismount,dev-in,dev-out,audit";

function buildGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "夜深了";
  if (h < 12) return "早上好";
  if (h < 14) return "中午好";
  if (h < 18) return "下午好";
  return "晚上好";
}

function fmt(n: number): string {
  return (n ?? 0).toLocaleString("zh-CN");
}

export function DashboardScreen({ navigation }: any) {
  const { user, currentRoomId } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [roomName, setRoomName] = useState<string>("未选择机房");
  const [ops, setOps] = useState<OperationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    const roomId = currentRoomId || undefined;
    const [s, rooms, feed] = await Promise.allSettled([
      apiGet<DashboardStats>("/stats/dashboard" + (roomId ? `?roomId=${roomId}` : "")),
      apiList<Room>("/rooms", { pageSize: 100 }),
      apiCollect<OperationRecord>("/inventory/operations", {
        limit: 8,
        kind: HOME_LOG_KINDS,
        roomId,
      }),
    ]);

    if (s.status === "fulfilled") setStats(s.value);
    if (rooms.status === "fulfilled") {
      const list = rooms.value.data;
      const cur = list.find((r) => r.id === currentRoomId);
      // 只显示「真正选中」的机房；未选中时如实显示未选择，避免误导
      setRoomName(cur?.name || "未选择机房");
    }
    if (feed.status === "fulfilled") setOps(feed.value.slice(0, 8));
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    load();
  }, [currentRoomId]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: theme.text3 }}>加载中…</Text>
      </View>
    );
  }

  const d = stats?.devices;
  const r = stats?.racks;
  const c = stats?.customers;
  const inv = stats?.inventory;
  const lifecycle = stats?.lifecycle || [];

  // 客户维度明细：设备为主表，合并机柜/库存数量
  const custRows = (() => {
    if (!stats) return [];
    const rackMap = new Map<string, number>();
    (r?.byCustomer || []).forEach((x) => rackMap.set(x.customerId, x.usedRacks));
    const invMap = new Map<string, number>();
    (inv?.byCustomer || []).forEach((x) => invMap.set(x.customerId, x.quantity));
    const ids = new Set<string>();
    (d?.byCustomer || []).forEach((x) => ids.add(x.customerId));
    (inv?.byCustomer || []).forEach((x) => ids.add(x.customerId));
    const rows = Array.from(ids).map((id) => {
      const dv = (d?.byCustomer || []).find((x) => x.customerId === id);
      const name = dv?.name || (inv?.byCustomer || []).find((x) => x.customerId === id)?.name || "未分配";
      return {
        customerId: id,
        name,
        devices: dv?.total || 0,
        racks: rackMap.get(id) || 0,
        inventory: invMap.get(id) || 0,
      };
    });
    return rows.sort((a, b) => b.devices - a.devices).slice(0, 5);
  })();

  const lifecycleMount = lifecycle.reduce((s, m) => s + m.mount, 0);
  const lifecycleDismount = lifecycle.reduce((s, m) => s + m.dismount, 0);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 28 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={theme.accent} />}
      >
        {/* 顶栏 */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10 }}>
          <RoomPill name={roomName} />
          <Text style={{ fontSize: 13, color: theme.text2 }}>
            {buildGreeting()}，{user?.username || ""}
          </Text>
        </View>

        {/* 扫描 hero */}
        <View style={{ paddingHorizontal: 16 }}>
          <HeroCard
            icon="📷"
            title="扫一扫"
            subtitle="入库 / 出库 / 查询设备"
            onPress={() => navigation.navigate("库存Tab", { screen: "Scan" })}
          />
        </View>

        {/* 统计网格 2 列 */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8, paddingHorizontal: 10 }}>
          <StatCard
            icon="🖥️"
            colors={theme.grad.device}
            label="设备总数"
            value={fmt(d?.total || 0)}
            sub={`服务器 ${fmt(d?.server || 0)} · 网络 ${fmt(d?.network || 0)}`}
            onPress={() => navigation.navigate("机柜设备Tab", { segment: "devices" })}
          />
          <StatCard
            icon="🗄️"
            colors={theme.grad.rack}
            label="机柜总数"
            value={fmt(r?.total || 0)}
            sub={`已用 ${fmt(r?.used || 0)} · 空闲 ${fmt(r?.unused || 0)}`}
            bar={r?.utilization || 0}
            onPress={() => navigation.navigate("机柜设备Tab", { segment: "racks" })}
          />
          <StatCard
            icon="👥"
            colors={theme.grad.customer}
            label="客户数量"
            value={fmt(c?.total || 0)}
            sub={`独立 ${fmt(c?.individual || 0)} · 散户 ${fmt(c?.retail || 0)}`}
            onPress={() => navigation.navigate("我的Tab", { screen: "Customers" })}
          />
          <StatCard
            icon="📦"
            colors={theme.grad.inventory}
            label="库存数量"
            value={fmt(inv?.total || 0)}
            sub="件在库物品"
            onPress={() => navigation.navigate("库存Tab")}
          />
        </View>

        {/* 授权工单入口 */}
        <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => navigation.navigate("我的Tab", { screen: "Customers" })}
            style={styles.entry}
          >
            <IconChip icon="📝" colors={theme.grad.hero} size={42} radius={12} />
            <View style={{ flex: 1, marginLeft: 13 }}>
              <Text style={styles.entryTitle}>授权工单</Text>
              <Text style={styles.entrySub}>客户授权我们对设备的操作留痕</Text>
            </View>
            <Text style={styles.entryArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* 客户维度明细 */}
        <View style={{ paddingHorizontal: 16 }}>
          <SectionCard title="客户维度明细">
            <View style={styles.chips}>
              <Text style={[styles.chip, styles.chipB]}>{fmt((d?.byCustomer || []).length)} 客户设备</Text>
              <Text style={[styles.chip, styles.chipP]}>{fmt((r?.byCustomer || []).length)} 客户机柜</Text>
              <Text style={[styles.chip, styles.chipG]}>{fmt((inv?.byCustomer || []).length)} 客户库存</Text>
            </View>
            {custRows.map((row) => (
              <TouchableOpacity
                key={row.customerId}
                activeOpacity={0.8}
                onPress={() =>
                  navigation.navigate("我的Tab", {
                    screen: "CustomerDetail",
                    params: { customerId: row.customerId, name: row.name },
                  })
                }
                style={styles.cRow}
              >
                <Text style={styles.cName}>{row.name}</Text>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <Text style={styles.cNum}>设备 <Text style={styles.cNumB}>{fmt(row.devices)}</Text></Text>
                  <Text style={styles.cNum}>机柜 <Text style={styles.cNumB}>{fmt(row.racks)}</Text></Text>
                  <Text style={styles.cNum}>库存 <Text style={styles.cNumB}>{fmt(row.inventory)}</Text></Text>
                </View>
              </TouchableOpacity>
            ))}
          </SectionCard>
        </View>

        {/* 近 12 月上下架 */}
        {lifecycle.length > 0 ? (
          <View style={{ paddingHorizontal: 16 }}>
            <SectionCard title="客户上下架（近 12 月）">
              <MiniBarChart data={lifecycle.map((m) => ({ label: m.label, mount: m.mount, dismount: m.dismount }))} />
              <View style={styles.legend}>
                <Text style={styles.lgUp}>■ 上架 {fmt(lifecycleMount)}</Text>
                <Text style={styles.lgDown}>■ 下架 {fmt(lifecycleDismount)}</Text>
              </View>
            </SectionCard>
          </View>
        ) : null}

        {/* 操作记录 */}
        <View style={{ paddingHorizontal: 16 }}>
          <SectionCard
            title="操作记录"
            right={
              <TouchableOpacity onPress={() => navigation.navigate("我的Tab", { screen: "Operations" })}>
                <Text style={{ color: theme.accent, fontSize: 13, fontWeight: "600" }}>查看全部 ›</Text>
              </TouchableOpacity>
            }
          >
            {ops.length === 0 ? (
              <Text style={{ color: theme.text3, fontSize: 13, paddingVertical: 8 }}>暂无操作记录</Text>
            ) : (
              ops.map((o, i) => (
                <ActivityRow
                  key={o.id || i}
                  kind={o.kind}
                  desc={o.summary || ACTIVITY_LABEL[o.kind || ""] || o.kind || "操作记录"}
                  meta={[o.operator, o.createdAt].filter(Boolean).join(" · ")}
                />
              ))
            )}
          </SectionCard>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  entry: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.surface,
    borderRadius: theme.r,
    padding: 14,
    shadowColor: "#101828",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  entryTitle: { fontSize: 15, fontWeight: "700", color: theme.text1 },
  entrySub: { fontSize: 11.5, color: theme.text3, marginTop: 2 },
  entryArrow: { fontSize: 20, color: theme.text3, marginLeft: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 8 },
  chip: { fontSize: 11, fontWeight: "600", paddingVertical: 4, paddingHorizontal: 9, borderRadius: 999 },
  chipB: { backgroundColor: "rgba(29,107,255,0.12)", color: theme.accent },
  chipP: { backgroundColor: "rgba(124,58,237,0.12)", color: theme.purple },
  chipG: { backgroundColor: "rgba(18,183,106,0.12)", color: theme.ok },
  cRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderTopWidth: 1, borderColor: "#f1f3f7" },
  cName: { fontSize: 14, fontWeight: "600", color: theme.text1, flex: 1 },
  cNum: { fontSize: 11.5, color: theme.text3 },
  cNumB: { color: theme.text1, fontWeight: "700" },
  legend: { flexDirection: "row", gap: 16, marginTop: 6 },
  lgUp: { fontSize: 11, color: theme.accent },
  lgDown: { fontSize: 11, color: "#9aa6bd" },
});
