import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { theme } from "../theme";
import type { RackUnit } from "../api/types";

// 设备状态 → 机柜立面着色（与小程序 2D 平面约定一致）
function unitColor(status?: string): string {
  switch (status) {
    case "active":
      return "#3b82f6";
    case "maintenance":
      return "#f97316";
    case "offline":
      return "#94a3b8";
    case "reserved":
      return "#a855f7";
    case "inactive":
      return "#cbd5e1";
    default:
      return "#3b82f6";
  }
}

const U_ROW_H = 26;

export function RackElevation({
  units,
  onUnitPress,
}: {
  units: RackUnit[];
  onUnitPress?: (deviceId: string) => void;
}) {
  // units 已由后端按「顶(uHeight) → 底(1)」排序，直接渲染即可
  return (
    <View style={styles.frame}>
      <ScrollView>
        {units.map((u) => {
          const color = unitColor(u.status);
          const label = u.modelName || u.name || "设备";
          const canPress = u.occupied && !!u.id && !!onUnitPress;
          const slot = (
            <View
              style={[
                styles.slot,
                u.occupied ? { backgroundColor: color } : styles.slotFree,
              ]}
            >
              {u.occupied ? (
                <Text style={styles.slotText} numberOfLines={1}>
                  {label}
                  {u.serialNumber ? ` · ${u.serialNumber}` : ""}
                </Text>
              ) : null}
            </View>
          );
          return (
            <View key={u.u} style={styles.row}>
              <Text style={styles.uLabel}>{u.u}U</Text>
              {canPress ? (
                <TouchableOpacity style={{ flex: 1 }} onPress={() => onUnitPress!(u.id!)}>
                  {slot}
                </TouchableOpacity>
              ) : (
                slot
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderWidth: 2,
    borderColor: "#334155",
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    overflow: "hidden",
    marginVertical: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    height: U_ROW_H,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#e2e8f0",
  },
  uLabel: {
    width: 34,
    textAlign: "right",
    textAlignVertical: "center",
    paddingRight: 6,
    fontSize: 10,
    color: theme.text3,
  },
  slot: {
    flex: 1,
    marginVertical: 2,
    marginRight: 6,
    borderRadius: 4,
    justifyContent: "center",
    paddingLeft: 8,
  },
  slotFree: {
    backgroundColor: "transparent",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e2e8f0",
    borderStyle: "dashed",
  },
  slotText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
});
