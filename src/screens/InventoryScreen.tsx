import React, { useEffect, useState } from "react";
import { FlatList, RefreshControl, Text, TouchableOpacity, View } from "react-native";
import { apiList } from "../api/client";
import type { InventoryInstance } from "../api/types";
import { Badge, CardRow, EmptyState, Loading } from "../components/ui";
import { theme } from "../theme";

const STATUS_LABEL: Record<string, string> = {
  in_stock: "在库",
  in_use: "使用中",
  in_repair: "维修",
  scrapped: "报废",
  reserved: "预留",
};

export function InventoryScreen({ navigation }: any) {
  const [items, setItems] = useState<InventoryInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => navigation.navigate("Scan")} style={{ marginRight: 16 }}>
          <Text style={{ color: theme.accent, fontWeight: "700", fontSize: 15 }}>扫码</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const load = async () => {
    try {
      const res = await apiList<InventoryInstance>("/inventory/instances", { pageSize: 100 });
      setItems(res.data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <Loading />;

  return (
    <View style={{ flex: 1, backgroundColor: "#f5f7fa" }}>
      <FlatList
        data={items}
        keyExtractor={(d) => d.id}
        renderItem={({ item }) => (
          <CardRow
            icon="📦"
            colors={theme.grad.inventory}
            title={item.name || item.sn || "未命名物料"}
            subtitle={[item.brand, item.model].filter(Boolean).join(" ") || item.categoryName}
            right={
              item.status ? (
                <Badge
                  label={STATUS_LABEL[item.status] || item.status}
                  color={item.status === "in_stock" ? "#22c55e" : "#94a3b8"}
                />
              ) : undefined
            }
            onPress={() => navigation.navigate("InstanceDetail", { instanceId: item.id })}
          />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListEmptyComponent={<EmptyState text="库存为空" />}
      />
    </View>
  );
}
