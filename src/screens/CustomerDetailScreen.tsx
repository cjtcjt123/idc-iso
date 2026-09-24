import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { apiGet, apiList } from "../api/client";
import type { Customer, DashboardStats } from "../api/types";
import { Card, EmptyState, ListRow, Loading, StatCard } from "../components/ui";
import { useAuth } from "../auth/AuthContext";
import { theme } from "../theme";

export function CustomerDetailScreen({ route, navigation }: any) {
  const { customerId } = route.params;
  const { currentRoomId } = useAuth();
  const [c, setC] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ devices: 0, racks: 0, items: 0 });

  useEffect(() => {
    (async () => {
      try {
        const [d, stats] = await Promise.all([
          apiGet<Customer>(`/customers/${customerId}`),
          apiGet<DashboardStats>(`/stats/dashboard?roomId=${currentRoomId || ""}`).catch(() => null),
        ]);
        setC(d);
        // 三个计数都从 dashboard 的 byCustomer 取（按 customerId 匹配，缺失即 0）
        if (stats) {
          const dev = stats.devices.byCustomer.find((x) => x.customerId === customerId);
          const rack = stats.racks.byCustomer.find((x) => x.customerId === customerId);
          const inv = stats.inventory.byCustomer.find((x) => x.customerId === customerId);
          setCounts({
            devices: dev?.total ?? 0,
            racks: rack?.usedRacks ?? 0,
            items: inv?.quantity ?? 0,
          });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [customerId, currentRoomId]);

  if (loading) return <Loading />;
  if (!c) return <EmptyState text="未找到客户" />;

  const rows: [string, string | undefined][] = [
    ["名称", c.name],
    ["编码", c.code],
    ["类型", c.type],
    ["联系人", c.contact],
    ["电话", c.phone],
    ["邮箱", c.email],
    ["状态", c.status],
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
      <View style={styles.statRow}>
        <StatCard
          icon="▣"
          colors={theme.grad.inventory}
          label="设备"
          value={String(counts.devices)}
          onPress={() => navigation.navigate("Hardware", { segment: "devices" })}
        />
        <StatCard
          icon="▥"
          colors={theme.grad.odf}
          label="机柜"
          value={String(counts.racks)}
          onPress={() => navigation.navigate("Hardware", { segment: "racks" })}
        />
        <StatCard
          icon="📦"
          colors={theme.grad.customer}
          label="物料"
          value={String(counts.items)}
          onPress={() => navigation.navigate("Inventory")}
        />
      </View>

      <Card>
        {rows.map(([k, v]) => (
          <ListRow key={k} title={k} subtitle={v || "—"} />
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  statRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
});
