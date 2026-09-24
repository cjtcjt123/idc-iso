import React, { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { apiGet } from "../api/client";
import type { RackVisual, RackPdu } from "../api/types";
import { Badge, Card, EmptyState, ListRow, Loading } from "../components/ui";
import { RackElevation } from "../components/RackElevation";
import { theme } from "../theme";

export function RackDetailScreen({ route, navigation }: any) {
  const { rackId, rackCode } = route.params;
  const [visual, setVisual] = useState<RackVisual | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet<RackVisual>(`/racks/${rackId}/visual`);
        setVisual(data);
      } catch (e: any) {
        setError(e?.message || "加载失败");
      } finally {
        setLoading(false);
      }
    })();
  }, [rackId]);

  if (loading) return <Loading />;
  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <EmptyState text={error} />
      </View>
    );
  }
  if (!visual) return <EmptyState text="无数据" />;

  const { rack, units, pdus } = visual;
  const occupiedCount = units.filter((u) => u.occupied).length;
  const usedPct = rack.uHeight
    ? Math.round((occupiedCount / rack.uHeight) * 100)
    : 0;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }}>
      <Card>
        <ListRow title="机柜" subtitle={rackCode || rack.name} />
        <ListRow
          title="总 U 位"
          subtitle={`${rack.uHeight} U`}
          right={<Badge label={`已用 ${occupiedCount} · ${usedPct}%`} />}
        />
        {rack.customer ? (
          <ListRow title="归属客户" subtitle={rack.customer.name} />
        ) : null}
      </Card>

      {pdus && pdus.length > 0 ? (
        <Card>
          <ListRow title="供电回路" subtitle={`${pdus.length} 路 PDU`} />
          {pdus.map((p: RackPdu) => (
            <ListRow
              key={p.id}
              title={p.position || "PDU"}
              subtitle={
                (p.feeds && p.feeds.length ? p.feeds.join("/") : "—") +
                (p.startAmpere ? ` · ${p.startAmpere}A` : "")
              }
            />
          ))}
        </Card>
      ) : null}

      <Card>
        <ListRow title="U 位占用" subtitle="点占用格看设备" />
        <RackElevation
          units={units}
          onUnitPress={(deviceId) =>
            navigation.navigate("DeviceDetail", { deviceId })
          }
          onOdfPress={(odfId) =>
            navigation.navigate("OdfModuleDetail", { moduleId: odfId })
          }
        />
      </Card>
    </ScrollView>
  );
}
