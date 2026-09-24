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

const ODF_COLOR = "#06b6d4";
const U_ROW_H = 26;

export function RackElevation({
  units,
  onUnitPress,
  onOdfPress,
}: {
  units: RackUnit[];
  onUnitPress?: (deviceId: string) => void;
  onOdfPress?: (odfId: string) => void;
}) {
  // units 已由后端按「顶(uHeight) → 底(1)」排序，直接渲染即可
  return (
    <View style={styles.frame}>
      <ScrollView>
        {units.map((u) => {
          const dev = u.device;
          const odf = u.odf;
          const color = odf && !dev ? ODF_COLOR : unitColor(dev?.status);
          // 机柜 U 位图按约定展示「型号 + SN」而不是内部编码 name
          const label = dev
            ? dev.modelName || dev.name || "设备"
            : odf
            ? `${odf.code || "ODF"}·${odf.end || "A"}端`
            : "";
          const tail = dev?.sn ? ` · ${dev.sn}` : "";
          const onPress = dev
            ? onUnitPress && (() => onUnitPress(dev.id))
            : odf
            ? onOdfPress && (() => onOdfPress(odf.id))
            : undefined;
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
                  {tail}
                </Text>
              ) : null}
            </View>
          );
          return (
            <View key={u.u} style={styles.row}>
              <Text style={styles.uLabel}>{u.u}U</Text>
              {onPress ? (
                <TouchableOpacity style={{ flex: 1 }} onPress={onPress}>
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
