import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { EmptyState } from "../components/ui";
import { theme } from "../theme";
import { DevicesScreen } from "./DevicesScreen";
import { RacksScreen } from "./RacksScreen";
import { OdfScreen } from "./OdfScreen";

type Seg = "devices" | "racks" | "odf";
const SEGS: { key: Seg; label: string }[] = [
  { key: "devices", label: "设备" },
  { key: "racks", label: "机柜" },
  { key: "odf", label: "ODF" },
];

export function HardwareScreen({ route, navigation }: any) {
  const { currentRoomId } = useAuth();
  const [seg, setSeg] = useState<Seg>(route.params?.segment || "devices");

  useEffect(() => {
    if (route.params?.segment) setSeg(route.params.segment);
  }, [route.params?.segment]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* 三段切换：对齐小程序 机柜设备 页 设备/机柜/ODF */}
      <View style={styles.segWrap}>
        <View style={styles.seg}>
          {SEGS.map((s) => {
            const active = seg === s.key;
            return (
              <TouchableOpacity
                key={s.key}
                activeOpacity={0.85}
                onPress={() => setSeg(s.key)}
                style={[styles.segBtn, active && styles.segBtnOn]}
              >
                <Text style={[styles.segText, active && styles.segTextOn]}>{s.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={{ flex: 1 }}>
        {!currentRoomId && seg !== "odf" ? (
          <View style={{ flex: 1, justifyContent: "center" }}>
            <EmptyState text="请先在「我的」页选择当前机房" />
          </View>
        ) : seg === "devices" ? (
          <DevicesScreen navigation={navigation} />
        ) : seg === "racks" ? (
          <RacksScreen navigation={navigation} />
        ) : (
          <OdfScreen navigation={navigation} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  segWrap: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4, backgroundColor: theme.bg },
  seg: {
    flexDirection: "row",
    backgroundColor: theme.surface,
    borderRadius: theme.rPill,
    padding: 4,
    borderWidth: 1,
    borderColor: theme.border,
  },
  segBtn: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: theme.rPill },
  segBtnOn: { backgroundColor: theme.accent },
  segText: { fontSize: 14, fontWeight: "600", color: theme.text2 },
  segTextOn: { color: "#fff" },
});
