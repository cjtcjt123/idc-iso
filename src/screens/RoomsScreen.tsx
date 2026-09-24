import React, { useEffect, useState } from "react";
import { Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { apiDelete, apiList, apiPost } from "../api/client";
import type { Room } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { useCan } from "../auth/permission";
import { toast } from "../components/toast";
import { Badge, Button, EmptyState, IconChip, Input, Loading, Sheet } from "../components/ui";
import { theme } from "../theme";

export function RoomsScreen({ navigation }: any) {
  const { currentRoomId, setRoom } = useAuth();
  const can = useCan();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [creating, setCreating] = useState(false);

  const canCreate = can("room", "create");
  const canUpdate = can("room", "update");
  const canDelete = can("room", "delete");

  const load = async () => {
    try {
      const res = await apiList<Room>("/rooms/mine", { pageSize: 100 });
      setRooms(res.data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onSwitch = async (id: string, roomName: string) => {
    try {
      await setRoom(id);
      toast("已切换机房", roomName);
      load();
    } catch (e: any) {
      toast("切换失败", e?.message || "请稍后重试");
    }
  };

  const onCreate = async () => {
    if (!name.trim()) return toast("请填写机房名称");
    setCreating(true);
    try {
      await apiPost<Room>("/rooms", { name: name.trim(), code: code.trim() || undefined });
      toast("机房已创建");
      setName("");
      setCode("");
      setShowCreate(false);
      load();
    } catch (e: any) {
      toast("创建失败", e?.message || "请检查权限或名称是否重复");
    } finally {
      setCreating(false);
    }
  };

  const onDelete = (room: Room) => {
    if (room.id === currentRoomId) return toast("无法删除当前机房", "请先切换到其他机房");
    Alert.alert("删除机房", `确定删除「${room.name}」？该操作不可恢复，且机房下不可有机柜。`, [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          try {
            await apiDelete(`/rooms/${room.id}`);
            toast("已删除", room.name);
            load();
          } catch (e: any) {
            toast("删除失败", e?.message || "请先移走机房内所有机柜");
          }
        },
      },
    ]);
  };

  if (loading) return <Loading />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={styles.head}>
        <Text style={styles.headTitle}>机房</Text>
        {canCreate ? (
          <TouchableOpacity activeOpacity={0.85} style={styles.addBtn} onPress={() => setShowCreate(true)}>
            <Text style={styles.addBtnText}>＋ 新建</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList
        data={rooms}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => {
          const isCurrent = item.id === currentRoomId;
          return (
            <View style={styles.card}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.main}
                onPress={() => navigation.navigate("RoomDetail", { roomId: item.id, roomName: item.name })}
              >
                <IconChip icon="🏢" colors={theme.grad.rack} size={38} radius={11} />
                <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {item.code ? `编码 ${item.code}` : "机房"}
                    {item.status ? ` · ${item.status}` : ""}
                  </Text>
                </View>
                {isCurrent ? <Badge label="当前" color={theme.ok} /> : null}
              </TouchableOpacity>
              <View style={styles.actions}>
                {!isCurrent && canUpdate ? (
                  <TouchableOpacity activeOpacity={0.8} style={styles.switchBtn} onPress={() => onSwitch(item.id, item.name)}>
                    <Text style={styles.switchBtnText}>设为当前</Text>
                  </TouchableOpacity>
                ) : null}
                {canDelete ? (
                  <TouchableOpacity activeOpacity={0.8} style={styles.delBtn} onPress={() => onDelete(item)}>
                    <Text style={styles.delBtnText}>删除</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          );
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListEmptyComponent={<EmptyState text="暂无机房" />}
        contentContainerStyle={{ paddingBottom: 24 }}
      />

      <Sheet visible={showCreate} title="新建机房" onClose={() => setShowCreate(false)} scrollable>
        <Text style={styles.lbl}>机房名称</Text>
        <Input value={name} onChangeText={setName} placeholder="如 M1机房" />
        <Text style={styles.lbl}>编码（可选）</Text>
        <Input value={code} onChangeText={setCode} placeholder="如 ROOM-M1" />
        <Button label={creating ? "提交中…" : "创建"} onPress={onCreate} loading={creating} />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headTitle: { fontSize: 22, fontWeight: "700", color: theme.text1 },
  addBtn: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 10, backgroundColor: theme.accent },
  addBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  card: {
    backgroundColor: theme.surface,
    borderRadius: theme.r,
    marginHorizontal: 16,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    shadowColor: "#101828",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  main: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  rowTitle: { fontSize: 15, color: theme.text1, fontWeight: "600" },
  rowSub: { fontSize: 12, color: theme.text3, marginTop: 2 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, borderTopWidth: 1, borderColor: theme.border, paddingTop: 8, marginTop: 2 },
  switchBtn: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 9, backgroundColor: theme.accentSoft },
  switchBtnText: { color: theme.accent, fontSize: 13, fontWeight: "700" },
  delBtn: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 9, backgroundColor: theme.dangerSoft },
  delBtnText: { color: theme.danger, fontSize: 13, fontWeight: "700" },
  lbl: { fontSize: 12, fontWeight: "700", color: theme.text2, marginTop: 8, marginBottom: 6 },
});
