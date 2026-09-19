import React, { useEffect, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { apiGet, apiPost } from "../api/client";
import type { InventoryInstance } from "../api/types";
import { Button, Card, EmptyState, Input, ListRow, Loading } from "../components/ui";

export function InstanceDetailScreen({ route }: any) {
  const { instanceId } = route.params;
  const [item, setItem] = useState<InventoryInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const d = await apiGet<InventoryInstance>(`/inventory/instances/${instanceId}`);
        setItem(d);
      } finally {
        setLoading(false);
      }
    })();
  }, [instanceId]);

  if (loading) return <Loading />;
  if (!item) return <EmptyState text="未找到物料" />;

  const move = async (kind: "stock-in" | "stock-out") => {
    const quantity = Number(qty);
    if (!Number.isInteger(quantity) || quantity < 1) {
      Alert.alert("请填写有效的数量（≥1 整数）");
      return;
    }
    setBusy(true);
    try {
      await apiPost(`/inventory/instances/${instanceId}/${kind}`, {
        quantity,
        reason: reason.trim() || undefined,
      });
      Alert.alert(kind === "stock-in" ? "已入库" : "已出库", `数量 ${quantity}`);
      reason && setReason("");
    } catch (e: any) {
      Alert.alert("操作失败", e?.message || "操作失败");
    } finally {
      setBusy(false);
    }
  };

  const rows: [string, string | undefined][] = [
    ["名称", item.name],
    ["SN", item.sn],
    ["品牌", item.brand],
    ["型号", item.model],
    ["分类", item.categoryName],
    ["状态", item.status],
    ["数量", item.quantity != null ? String(item.quantity) : undefined],
    ["所在仓库", item.warehouseName],
    ["归属客户", item.customerName],
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#f5f7fa" }}>
      <Card>
        {rows.map(([k, v]) => (
          <ListRow key={k} title={k} subtitle={v || "—"} onPress={undefined} />
        ))}
      </Card>

      <Card>
        <ListRow title="出入库" subtitle="填写数量与原因后操作" />
        <Input placeholder="数量（默认 1）" value={qty} onChangeText={setQty} />
        <Input placeholder="原因（可选）" value={reason} onChangeText={setReason} />
        <Button label="入库 +" onPress={() => move("stock-in")} loading={busy} />
        <Button label="出库 -" onPress={() => move("stock-out")} loading={busy} danger />
      </Card>
    </ScrollView>
  );
}
