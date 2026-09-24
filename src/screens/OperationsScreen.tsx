import React, { useEffect, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { apiCollect } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { OperationRecord } from "../api/types";
import { Badge, EmptyState, ListRow, Loading } from "../components/ui";

const KIND_LABEL: Record<string, string> = {
  mat: "物料",
  "dev-in": "设备入库",
  "dev-out": "设备出库",
  "dev-mount": "设备上架",
  "dev-dismount": "设备下架",
  audit: "审计",
};

export function OperationsScreen({ navigation }: any) {
  const { currentRoomId } = useAuth();
  const [ops, setOps] = useState<OperationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await apiCollect<OperationRecord>("/inventory/operations", { roomId: currentRoomId || undefined });
      setOps(res);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, [currentRoomId]);

  if (loading) return <Loading />;

  return (
    <View style={{ flex: 1, backgroundColor: "#f5f7fa" }}>
      <FlatList
        data={ops}
        keyExtractor={(o) => o.id}
        renderItem={({ item }) => (
          <ListRow
            title={item.summary || item.kind || "操作记录"}
            subtitle={[item.operator, item.createdAt].filter(Boolean).join(" · ")}
            right={
              item.kind ? <Badge label={KIND_LABEL[item.kind] || item.kind} /> : undefined
            }
            onPress={undefined}
          />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListEmptyComponent={<EmptyState text="暂无操作流水" />}
      />
    </View>
  );
}
