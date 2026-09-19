import React, { useEffect, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { apiList } from "../api/client";
import type { AuditLog } from "../api/types";
import { EmptyState, ListRow, Loading } from "../components/ui";

export function AuditScreen({ navigation }: any) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await apiList<AuditLog>("/audit/logs", { pageSize: 100 });
      setLogs(res.data);
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
        data={logs}
        keyExtractor={(l) => l.id}
        renderItem={({ item }) => (
          <ListRow
            title={item.action || item.resourceName || "审计"}
            subtitle={[item.resourceName, item.operator, item.createdAt]
              .filter(Boolean)
              .join(" · ")}
            onPress={undefined}
          />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListEmptyComponent={<EmptyState text="暂无审计日志" />}
      />
    </View>
  );
}
