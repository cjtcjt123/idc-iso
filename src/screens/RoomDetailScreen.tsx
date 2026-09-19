import React, { useEffect, useState } from "react";
import { Alert, FlatList, View } from "react-native";
import { apiList } from "../api/client";
import type { Rack } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Badge, Button, Card, EmptyState, ListRow, Loading } from "../components/ui";

export function RoomDetailScreen({ route, navigation }: any) {
  const { roomId, roomName } = route.params;
  const { currentRoomId, setRoom } = useAuth();
  const [racks, setRacks] = useState<Rack[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiList<Rack>("/racks", { roomId, pageSize: 200 });
        setRacks(res.data);
      } finally {
        setLoading(false);
      }
    })();
  }, [roomId]);

  if (loading) return <Loading />;

  const isCurrent = currentRoomId === roomId;

  return (
    <View style={{ flex: 1, backgroundColor: "#f5f7fa" }}>
      <Card>
        <ListRow
          title="机房"
          subtitle={roomName}
          right={isCurrent ? <Badge label="当前" color="#22c55e" /> : undefined}
        />
        <ListRow title="机柜数量" subtitle={`${racks.length} 个`} />
      </Card>
      {!isCurrent && (
        <Button
          label="设为当前机房"
          onPress={async () => {
            await setRoom(roomId);
            Alert.alert("已切换", `${roomName} 设为当前机房`);
          }}
        />
      )}
      <FlatList
        data={racks}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => (
          <ListRow
            title={item.code}
            subtitle={
              item.uHeight ? `U 位 ${item.uHeight}` : undefined
            }
            right={
              item.utilization != null ? (
                <Badge label={`${Math.round(item.utilization * 100)}%`} />
              ) : undefined
            }
            onPress={() =>
              navigation.navigate("RackDetail", {
                rackId: item.id,
                rackCode: item.code,
              })
            }
          />
        )}
        ListEmptyComponent={<EmptyState text="该机房暂无机柜" />}
      />
    </View>
  );
}
