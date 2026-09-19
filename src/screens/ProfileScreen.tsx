import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { Button, Card, ListRow } from "../components/ui";
import { ServerAddressEditor } from "../components/ServerAddressEditor";

export function ProfileScreen({ navigation }: any) {
  const { user, logout, currentRoomId } = useAuth();

  return (
    <View style={styles.wrap}>
      {/* 顶部应用标识：连点图标 5 次 → 输入口令 → 解锁服务器地址配置 */}
      <ServerAddressEditor
        trigger={
          <View style={styles.brand}>
            <Image
              source={require("../../assets/icon.png")}
              style={styles.icon}
            />
            <View>
              <Text style={styles.appName}>IDC管理工具</Text>
              <Text style={styles.tip}>连点图标 5 次可配置服务器</Text>
            </View>
          </View>
        }
      />

      <Card>
        <ListRow title="账号" subtitle={user?.username} />
        <ListRow title="角色" subtitle={user?.roleName || user?.role || "—"} />
        <ListRow
          title="分组"
          subtitle={user?.userGroup === "customer" ? "客户组" : "运维组"}
        />
        <ListRow title="当前机房" subtitle={currentRoomId || "未选择"} />
        <ListRow
          title="客户管理"
          subtitle="往来客户"
          onPress={() => navigation.navigate("Customers")}
        />
        <ListRow
          title="配件管理"
          subtitle="电源/光模块/线缆"
          onPress={() => navigation.navigate("Accessories")}
        />
        <ListRow
          title="出入库流水"
          subtitle="近期操作记录"
          onPress={() => navigation.navigate("Operations")}
        />
        <ListRow
          title="审计日志"
          subtitle="操作审计"
          onPress={() => navigation.navigate("Audit")}
        />
      </Card>

      <Button label="退出登录" onPress={logout} danger />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#f5f7fa" },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    paddingTop: 28,
  },
  icon: { width: 56, height: 56, borderRadius: 14, marginRight: 14 },
  appName: { fontSize: 20, fontWeight: "800", color: "#101828" },
  tip: { fontSize: 12, color: "#94a3b8", marginTop: 4 },
});
