import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { isAdmin } from "../auth/permission";
import { SectionCard } from "../components/ui";
import { theme } from "../theme";

interface AdminTile {
  title: string;
  sub: string;
  icon: string;
  colors: readonly [string, string];
  route?: string;
  params?: Record<string, unknown>;
}

// 仅保留后端已落地、且 ProfileStack 内已注册路由的目标；无 route 的死块一律删除
const COMMON: AdminTile[] = [
  { title: "客户管理", sub: "客户档案与归属", icon: "👥", colors: theme.grad.customer, route: "Customers" },
  { title: "审计日志", sub: "全量操作审计", icon: "📜", colors: ["#aeb6c6", "#475467"], route: "Audit" },
  { title: "导入导出", sub: "批量 xlsx", icon: "⬆️", colors: ["#b6a4fb", "#7c3aed"], route: "ImportExport" },
  { title: "用户与权限", sub: "账号 / 角色矩阵", icon: "🛡️", colors: ["#aeb6c6", "#475467"], route: "UserManagement" },
  { title: "数据备份", sub: "备份 / 恢复 / 下载", icon: "💾", colors: ["#5ce0a8", "#12b76a"], route: "Backup" },
];

const CONFIGS: AdminTile[] = [
  { title: "网络管理", sub: "子网与 IP", icon: "🔗", colors: theme.grad.odf, route: "Network" },
  { title: "统计报表", sub: "设备/机柜/库存", icon: "📊", colors: ["#5ce0a8", "#12b76a"], route: "Stats" },
  { title: "物品与分类", sub: "物料字典", icon: "📦", colors: theme.grad.inventory, route: "Categories" },
  { title: "库位管理", sub: "仓库位", icon: "📍", colors: ["#22d3ee", "#0d9488"], route: "Locations" },
];

export function AdminConsoleScreen({ navigation }: any) {
  const { user } = useAuth();
  const isSuper = isAdmin(user);

  if (!isSuper) {
    return (
      <View style={styles.noAccess}>
        <Text style={styles.noAccessTxt}>仅管理员可访问</Text>
      </View>
    );
  }

  const renderTile = (it: AdminTile, i: number) => {
    const inner = (
      <View style={styles.tile}>
        <View style={[styles.tileIcon, { backgroundColor: it.colors[1] + "22" }]}>
          <Text style={{ fontSize: 24 }}>{it.icon}</Text>
        </View>
        <Text style={styles.tileTitle}>{it.title}</Text>
        <Text style={styles.tileSub} numberOfLines={1}>{it.sub}</Text>
        {!it.route ? <Text style={styles.soon}>待接入</Text> : null}
      </View>
    );
    return it.route ? (
      <TouchableOpacity key={i} style={[styles.tileWrap, { backgroundColor: it.colors[1] + "10" }]} activeOpacity={0.85} onPress={() => navigation.navigate(it.route!, it.params)}>
        {inner}
      </TouchableOpacity>
    ) : (
      <View key={i} style={[styles.tileWrap, styles.disabled, { backgroundColor: theme.track }]}>{inner}</View>
    );
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={{ paddingHorizontal: 16 }}>
        <SectionCard title="常用">
          <View style={styles.grid}>{COMMON.map(renderTile)}</View>
        </SectionCard>

        <SectionCard title="配置">
          <View style={styles.grid}>{CONFIGS.map(renderTile)}</View>
        </SectionCard>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  tileWrap: {
    width: "31%",
    aspectRatio: 1,
    borderRadius: 14,
    padding: 10,
    marginBottom: 10,
    alignItems: "flex-start",
    justifyContent: "flex-start",
  },
  tile: { width: "100%", alignItems: "flex-start" },
  tileIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  tileTitle: { fontSize: 13, fontWeight: "700", color: theme.text1, marginTop: 8 },
  tileSub: { fontSize: 10.5, color: theme.text3, marginTop: 2 },
  soon: { fontSize: 10, color: theme.text3, marginTop: 6, fontWeight: "700" },
  disabled: { opacity: 0.62 },
  noAccess: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  noAccessTxt: { fontSize: 14, color: theme.text2 },
});