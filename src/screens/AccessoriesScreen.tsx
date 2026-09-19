import React, { useEffect, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { apiList } from "../api/client";
import type { Accessory } from "../api/types";
import { Badge, EmptyState, ListRow, Loading } from "../components/ui";

const STATUS_LABEL: Record<string, string> = {
  in_stock: "在库",
  in_use: "使用中",
  scrapped: "报废",
};

export function AccessoriesScreen({ navigation }: any) {
  const [items, setItems] = useState<Accessory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await apiList<Accessory>("/accessories", { pageSize: 100 });
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
        keyExtractor={(a) => a.id}
        renderItem={({ item }) => (
          <ListRow
            title={item.name}
            subtitle={[item.category, item.model].filter(Boolean).join(" ") || item.serialNumber}
            right={
              item.status ? (
                <Badge
                  label={STATUS_LABEL[item.status] || item.status}
                  color={item.status === "in_stock" ? "#22c55e" : "#94a3b8"}
                />
              ) : undefined
            }
            onPress={() => navigation.navigate("AccessoryDetail", { accessoryId: item.id })}
          />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListEmptyComponent={<EmptyState text="暂无配件" />}
      />
    </View>
  );
}
