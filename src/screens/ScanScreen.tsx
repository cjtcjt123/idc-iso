import React, { useState } from "react";
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { apiGet } from "../api/client";
import type { InventoryInstance } from "../api/types";
import { EmptyState, ListRow, Loading } from "../components/ui";
import { theme } from "../theme";

export function ScanScreen({ navigation }: any) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [matches, setMatches] = useState<InventoryInstance[]>([]);

  if (!permission) return <Loading />;
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <EmptyState text="需要相机权限才能扫码" />
        <TouchableOpacity style={styles.grant} onPress={requestPermission}>
          <Text style={styles.grantText}>授予权限</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const onScan = async (data: string) => {
    if (scanned) return;
    setScanned(true);
    try {
      const res: any = await apiGet(`/inventory/search?q=${encodeURIComponent(data)}`);
      const list: any[] = res?.instances || (Array.isArray(res) ? res : []);
      if (list.length === 0) {
        Alert.alert("未找到", `没有匹配「${data}」的物料`);
        return;
      }
      if (list.length === 1) {
        navigation.navigate("InstanceDetail", { instanceId: list[0].id });
        return;
      }
      setMatches(list as InventoryInstance[]);
    } catch (e: any) {
      Alert.alert("查询失败", e?.message || "扫码查询失败");
      setScanned(false);
    }
  };

  if (matches.length > 0) {
    return (
      <View style={{ flex: 1, backgroundColor: "#f5f7fa" }}>
        <FlatList
          data={matches}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => (
            <ListRow
              title={item.name || item.sn || "未命名物料"}
              subtitle={[item.brand, item.model].filter(Boolean).join(" ")}
              onPress={() => navigation.navigate("InstanceDetail", { instanceId: item.id })}
            />
          )}
          ListEmptyComponent={<EmptyState text="未找到物料" />}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <CameraView
        style={{ flex: 1 }}
        barcodeScannerSettings={{ barcodeTypes: ["qr", "code128", "code39", "ean13", "ean8", "upc_a", "upc_e", "datamatrix", "pdf417"] }}
        onBarcodeScanned={({ data }) => onScan(data)}
      />
      {scanned ? (
        <TouchableOpacity style={styles.rescan} onPress={() => setScanned(false)}>
          <Text style={styles.rescanText}>再次扫描</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.bg },
  grant: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: theme.accent, borderRadius: 12 },
  grantText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  rescan: { position: "absolute", bottom: 40, alignSelf: "center", paddingHorizontal: 24, paddingVertical: 12, backgroundColor: "rgba(0,0,0,0.7)", borderRadius: 24 },
  rescanText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
