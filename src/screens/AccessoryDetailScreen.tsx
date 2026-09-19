import React, { useEffect, useState } from "react";
import { Alert, View } from "react-native";
import { apiGet, apiPost } from "../api/client";
import type { Accessory } from "../api/types";
import { Button, Card, EmptyState, Input, ListRow, Loading } from "../components/ui";

const STATUS_LABEL: Record<string, string> = {
  in_stock: "在库",
  in_use: "使用中",
  scrapped: "报废",
};

export function AccessoryDetailScreen({ route }: any) {
  const { accessoryId } = route.params;
  const [a, setA] = useState<Accessory | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [deviceId, setDeviceId] = useState("");

  const load = async () => {
    try {
      const d = await apiGet<Accessory>(`/accessories/${accessoryId}`);
      setA(d);
      if (d.deviceId) setDeviceId(d.deviceId);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [accessoryId]);

  if (loading) return <Loading />;
  if (!a) return <EmptyState text="未找到配件" />;

  const apply = async () => {
    if (!deviceId.trim()) {
      Alert.alert("请填写设备 ID");
      return;
    }
    setBusy(true);
    try {
      await apiPost(`/accessories/${accessoryId}/apply`, { deviceId: deviceId.trim() });
      Alert.alert("已应用", "配件已装到该设备");
      load();
    } catch (e: any) {
      Alert.alert("失败", e?.message || "操作失败");
    } finally {
      setBusy(false);
    }
  };

  const unapply = async () => {
    setBusy(true);
    try {
      await apiPost(`/accessories/${accessoryId}/unapply`);
      Alert.alert("已卸下", "配件已从设备移除");
      load();
    } catch (e: any) {
      Alert.alert("失败", e?.message || "操作失败");
    } finally {
      setBusy(false);
    }
  };

  const rows: [string, string | undefined][] = [
    ["名称", a.name],
    ["类别", a.category],
    ["型号", a.model],
    ["SN", a.serialNumber],
    ["状态", a.status ? STATUS_LABEL[a.status] || a.status : undefined],
    ["数量", a.quantity != null ? String(a.quantity) : undefined],
    ["单位", a.unit],
    ["槽位", a.slot],
    ["备注", a.note],
    ["已装设备", a.deviceId || "未安装"],
  ];

  return (
    <View style={{ flex: 1, backgroundColor: "#f5f7fa" }}>
      <Card>
        {rows.map(([k, v]) => (
          <ListRow key={k} title={k} subtitle={v || "—"} onPress={undefined} />
        ))}
      </Card>

      {a.deviceId ? (
        <Button label="从设备卸下" onPress={unapply} loading={busy} />
      ) : (
        <Card>
          <ListRow title="安装到设备" subtitle="填写设备 ID 后应用" />
          <Input placeholder="设备 ID（UUID）" value={deviceId} onChangeText={setDeviceId} />
          <Button label="应用配件" onPress={apply} loading={busy} />
        </Card>
      )}
    </View>
  );
}
