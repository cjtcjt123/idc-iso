import React, { useEffect, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { apiList } from "../api/client";
import type { Device } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Badge, Card, CardRow, EmptyState, ListRow, Loading } from "../components/ui";
import { theme } from "../theme";

const PLACEMENT_LABEL: Record<string, string> = {
  mounted: "已上架",
  inventory: "库存",
  shipped: "已迁出",
};

export function DevicesScreen({ navigation }: any) {
  const { currentRoomId } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    if (!currentRoomId) {
      setLoading(false);
      return;
    }
    try {
      const res = await apiList<Device>("/devices", { roomId: currentRoomId, pageSize: 100 });
      setDevices(res.data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRoomId]);

  if (loading) return <Loading />;

  if (!currentRoomId) {
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <EmptyState text="请先在机房页选择「当前机房」" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#f5f7fa" }}>
      <Card>
        <ListRow title="当前机房" subtitle="设备列表按当前机房过滤" />
      </Card>
      <FlatList
        data={devices}
        keyExtractor={(d) => d.id}
        renderItem={({ item }) => (
          <CardRow
            icon="🖥️"
            colors={theme.grad.device}
            title={item.name || item.sn || "未命名设备"}
            subtitle={[item.brand, item.model].filter(Boolean).join(" ") || item.type}
            right={
              item.placement ? (
                <Badge
                  label={PLACEMENT_LABEL[item.placement] || item.placement}
                  color={item.placement === "mounted" ? "#22c55e" : "#94a3b8"}
                />
              ) : undefined
            }
            onPress={() => navigation.navigate("DeviceDetail", { deviceId: item.id })}
          />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListEmptyComponent={<EmptyState text="该机房暂无设备" />}
      />
    </View>
  );
}
