import React, { useEffect, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { apiGet, apiPost } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { Device, Rack } from "../api/types";
import { Button, Card, EmptyState, Input, ListRow, Loading } from "../components/ui";
import { theme } from "../theme";

export function DeviceDetailScreen({ route }: any) {
  const { deviceId } = route.params;
  const { currentRoomId } = useAuth();
  const [device, setDevice] = useState<Device | null>(null);
  const [racks, setRacks] = useState<Rack[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [rackId, setRackId] = useState("");
  const [uPosition, setUPosition] = useState("");
  const [reason, setReason] = useState("");
  const [destination, setDestination] = useState<"inventory" | "shipped">("inventory");

  const load = async () => {
    try {
      const d = await apiGet<Device>(`/devices/${deviceId}`);
      setDevice(d);
      if (currentRoomId) {
        const res = await apiGet<{ data: Rack[] }>(`/racks?roomId=${currentRoomId}&pageSize=200`);
        setRacks(res.data || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  if (loading) return <Loading />;
  if (!device) return <EmptyState text="未找到设备" />;

  const mounted = device.placement === "mounted";

  const doMount = async () => {
    if (!rackId) {
      Alert.alert("请选择目标机柜");
      return;
    }
    const u = Number(uPosition);
    if (!Number.isInteger(u) || u < 1) {
      Alert.alert("请填写有效的 U 位（≥1 整数）");
      return;
    }
    setBusy(true);
    try {
      await apiPost(`/devices/${deviceId}/mount`, { rackId, uPosition: u });
      Alert.alert("已上架", `机柜 ${racks.find((r) => r.id === rackId)?.code || ""} · ${u}U`);
      load();
    } catch (e: any) {
      Alert.alert("上架失败", e?.message || "操作失败");
    } finally {
      setBusy(false);
    }
  };

  const doDismount = async () => {
    if (!reason.trim()) {
      Alert.alert("请填写下架原因");
      return;
    }
    setBusy(true);
    try {
      await apiPost(`/devices/${deviceId}/dismount`, { reason: reason.trim(), destination });
      Alert.alert("已下架", destination === "inventory" ? "已回库存" : "已迁出");
      load();
    } catch (e: any) {
      Alert.alert("下架失败", e?.message || "操作失败");
    } finally {
      setBusy(false);
    }
  };

  const rows: [string, string | undefined][] = [
    ["SN", device.sn],
    ["名称", device.name],
    ["品牌", device.brand],
    ["型号", device.model],
    ["类型", device.type],
    ["状态", device.status],
    ["上架位置", device.rackId ?? "未上架"],
    ["U 位", device.uPosition != null ? String(device.uPosition) : undefined],
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#f5f7fa" }}>
      <Card>
        {rows.map(([k, v]) => (
          <ListRow key={k} title={k} subtitle={v || "—"} onPress={undefined} />
        ))}
      </Card>

      {mounted ? (
        <Card>
          <ListRow title="下架设备" subtitle="移出机柜并记录去向" />
          <Input placeholder="下架原因 *" value={reason} onChangeText={setReason} />
          <ListRow
            title="去向"
            subtitle={destination === "inventory" ? "回库存" : "迁出"}
            onPress={() => setDestination(destination === "inventory" ? "shipped" : "inventory")}
          />
          <Button label="确认下架" onPress={doDismount} loading={busy} danger />
        </Card>
      ) : (
        <Card>
          <ListRow title="上架到机柜" subtitle={rackId ? racks.find((r) => r.id === rackId)?.code : "选择机柜"} />
          {racks.map((r) => (
            <ListRow
              key={r.id}
              title={r.code}
              subtitle={r.uHeight ? `${r.uHeight}U` : undefined}
              right={
                rackId === r.id ? (
                  <View style={{ backgroundColor: theme.accent, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>已选</Text>
                  </View>
                ) : undefined
              }
              onPress={() => setRackId(r.id)}
            />
          ))}
          <Input placeholder="U 位（自下而上，如 10）" value={uPosition} onChangeText={setUPosition} />
          <Button label="确认上架" onPress={doMount} loading={busy} />
        </Card>
      )}
    </ScrollView>
  );
}
