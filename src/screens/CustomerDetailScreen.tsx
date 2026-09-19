import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { apiGet } from "../api/client";
import type { Customer } from "../api/types";
import { Card, EmptyState, ListRow, Loading } from "../components/ui";

export function CustomerDetailScreen({ route }: any) {
  const { customerId } = route.params;
  const [c, setC] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const d = await apiGet<Customer>(`/customers/${customerId}`);
        setC(d);
      } finally {
        setLoading(false);
      }
    })();
  }, [customerId]);

  if (loading) return <Loading />;
  if (!c) return <EmptyState text="未找到客户" />;

  const rows: [string, string | undefined][] = [
    ["名称", c.name],
    ["编码", c.code],
    ["类型", c.type],
    ["联系人", c.contact],
    ["电话", c.phone],
    ["邮箱", c.email],
    ["状态", c.status],
  ];

  return (
    <View style={{ flex: 1, backgroundColor: "#f5f7fa" }}>
      <Card>
        {rows.map(([k, v]) => (
          <ListRow key={k} title={k} subtitle={v || "—"} onPress={undefined} />
        ))}
      </Card>
    </View>
  );
}
