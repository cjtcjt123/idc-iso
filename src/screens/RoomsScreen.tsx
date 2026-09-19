import React, { useEffect, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { apiList } from "../api/client";
import type { Room } from "../api/types";
import { Badge, Card, EmptyState, ListRow, Loading } from "../components/ui";

export function RoomsScreen({ navigation }: any) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await apiList<Room>("/rooms", { pageSize: 100 });
      setRooms(res.data);
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
        data={rooms}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => (
          <ListRow
            title={item.name}
            subtitle={item.code ? `编码 ${item.code}` : undefined}
            right={item.status ? <Badge label={item.status} /> : undefined}
            onPress={() =>
              navigation.navigate("RoomDetail", { roomId: item.id, roomName: item.name })
            }
          />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListEmptyComponent={<EmptyState text="暂无机房" />}
        ItemSeparatorComponent={() => <View style={{ height: 0 }} />}
      />
    </View>
  );
}
