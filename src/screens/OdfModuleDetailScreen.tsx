import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { apiCollect } from "../api/client";
import type { OdfPort } from "../api/types";
import { EmptyState, Loading } from "../components/ui";
import { theme } from "../theme";

const PORT_COLOR: Record<string, string> = {
  idle: "#cbd5e1",
  connected: "#22c55e",
  fault: "#ef4444",
  reserved: "#f59e0b",
};

function PortCell({ port }: { port: OdfPort }) {
  const color = PORT_COLOR[port.status || "idle"] || "#cbd5e1";
  const label = port.portNo != null ? String(port.portNo) : "?";
  return (
    <View style={[styles.cell, { backgroundColor: color + "33", borderColor: color }]}>
      <Text style={[styles.cellNo, { color }]}>{label}</Text>
      {(port.linkType || port.status) && (
        <Text style={styles.cellSub} numberOfLines={1}>
          {port.linkType || port.status}
        </Text>
      )}
    </View>
  );
}

export function OdfModuleDetailScreen({ route }: any) {
  const { moduleId } = route.params;
  const [ports, setPorts] = useState<OdfPort[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiCollect<OdfPort>(`/odf/modules/${moduleId}/ports`);
        setPorts(res);
      } finally {
        setLoading(false);
      }
    })();
  }, [moduleId]);

  if (loading) return <Loading />;
  if (ports.length === 0) return <EmptyState text="该模块无端口" />;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, flexDirection: "row", flexWrap: "wrap" }}>
      {ports.map((p) => (
        <PortCell key={p.id} port={p} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  cell: {
    width: 64,
    height: 64,
    margin: 6,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cellNo: { fontSize: 18, fontWeight: "700" },
  cellSub: { fontSize: 10, color: theme.text3, marginTop: 2 },
});
