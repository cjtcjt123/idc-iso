import React, { useEffect, useState } from "react";
import { FlatList, RefreshControl, Text, TouchableOpacity, View } from "react-native";
import { apiList } from "../api/client";
import type { Customer } from "../api/types";
import { CardRow, EmptyState, Loading } from "../components/ui";
import { theme } from "../theme";

export function CustomersScreen({ navigation }: any) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => navigation.navigate("CustomerCreate")} style={{ marginRight: 16 }}>
          <Text style={{ color: theme.accent, fontWeight: "700", fontSize: 15 }}>+ 新建</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const load = async () => {
    try {
      const res = await apiList<Customer>("/customers", { pageSize: 100 });
      setCustomers(res.data);
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
        data={customers}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => (
          <CardRow
            icon="👥"
            colors={theme.grad.customer}
            title={item.name}
            subtitle={[item.type, item.contact].filter(Boolean).join(" · ")}
            onPress={() => navigation.navigate("CustomerDetail", { customerId: item.id })}
          />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListEmptyComponent={<EmptyState text="暂无客户" />}
      />
    </View>
  );
}
