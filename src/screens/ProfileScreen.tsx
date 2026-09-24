import React, { useEffect, useState } from "react";
import { Clipboard, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { isAdmin } from "../auth/permission";
import { toast } from "../components/toast";
import { apiCollect } from "../api/client";
import { Badge, Button, Card, IconChip } from "../components/ui";
import { ServerAddressEditor } from "../components/ServerAddressEditor";
import { theme } from "../theme";

type RoomWithCount = { id: string; name?: string; _count?: { racks?: number } };

const APP_VERSION = "1.0.0";

const ROLE_LABELS: Record<string, string> = {
  owner: "所有者",
  admin: "管理员",
  operator: "运维",
  member: "成员",
  viewer: "只读",
};

interface MenuItem {
  title: string;
  sub?: string;
  icon: string;
  colors: readonly [string, string];
  /** 已接入的跳转目标；无则渲染为「待接入」灰行，杜绝死入口 */
  route?: string;
  params?: Record<string, unknown>;
  right?: React.ReactNode;
}

/** 对齐小程序 profile.ts 的 menuGroups：机房 / 运维工具 / 系统 / 管理 */
function roleTextOf(u: { isSuperuser?: boolean; role?: string } | null): string {
  if (!u) return "普通用户";
  if (u.isSuperuser) return "超级管理员";
  return ROLE_LABELS[u.role || ""] || u.role || "普通用户";
}

export function ProfileScreen({ navigation }: any) {
  const { user, logout, currentRoomId, refreshUser } = useAuth();
  const [roomName, setRoomName] = useState("未选择机房");
  const [roomCount, setRoomCount] = useState(0);
  const [showAbout, setShowAbout] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  // 当前机房名 + 可访问机房数（对齐小程序 getMyRooms / getCurrentRoomName）
  useEffect(() => {
    (async () => {
      try {
        const rooms = await apiCollect<RoomWithCount>("/rooms/mine");
        setRoomCount(rooms.length);
        const cur = rooms.find((r) => r.id === currentRoomId);
        setRoomName(cur?.name || (rooms.length ? "未选择机房" : "无可用机房"));
      } catch {
        /* 401 已由 client 处理 */
      }
    })();
  }, [currentRoomId]);

  // 每次进入「我的」刷新账号信息（对齐小程序 profile onShow 调 /auth/me）
  useEffect(() => {
    const unsub = navigation.addListener("focus", () => {
      void refreshUser();
    });
    return unsub;
  }, [navigation, refreshUser]);

  const initial = (user?.username || "U").charAt(0).toUpperCase();
  const roleText = roleTextOf(user);
  const isSuper = isAdmin(user);

  const groups: { title: string; items: MenuItem[] }[] = [
    {
      title: "机房",
      items: [
        {
          title: "当前机房",
          sub: roomName,
          icon: "🏢",
          colors: theme.grad.hero,
          route: "Rooms",
          right: <Text style={styles.switchTag}>切换</Text>,
        },
        { title: "机房设施", sub: "新建机房 / 楼层 / 区域", icon: "🏗️", colors: ["#b6a4fb", "#7c3aed"], route: "Facilities" },
      ],
    },
    {
      title: "运维工具",
      items: [
        { title: "客户管理", sub: "客户档案与归属", icon: "👥", colors: theme.grad.customer, route: "Customers" },
        { title: "客户授权", sub: "9 类授权单登记", icon: "📝", colors: ["#fbc17d", "#f79009"], route: "CustomerAuthorization" },
        { title: "统计报表", sub: "设备 / 机柜 / 库存 分布", icon: "📊", colors: ["#5ce0a8", "#12b76a"], route: "Stats" },
        { title: "网络管理", sub: "子网与 IP 地址", icon: "🔗", colors: ["#22d3ee", "#0d9488"], route: "Network" },
        { title: "导入导出", sub: "批量 xlsx", icon: "⬆️", colors: ["#b6a4fb", "#7c3aed"], route: "ImportExport" },
        { title: "操作记录", sub: "全量流水与审计", icon: "📋", colors: ["#fbc17d", "#f79009"], route: "库存Tab", params: { screen: "Logs" } },
        { title: "枚举中心", sub: "选项字典管理", icon: "🗂️", colors: ["#aeb6c6", "#475467"], route: "EnumCenter" },
      ],
    },
    {
      title: "系统",
      items: [{ title: "设置", sub: "服务器 · 主题 · 演示模式", icon: "⚙️", colors: ["#aeb6c6", "#475467"], route: "Settings" }],
    },
  ];

  // 管理（受 isSuperuser 门禁，对齐小程序 manageGroups）
  if (isSuper) {
    groups.push({
      title: "管理",
      items: [{ title: "管理台", sub: "用户 / 权限 / 备份", icon: "🛡️", colors: ["#aeb6c6", "#475467"], route: "AdminConsole" }],
    });
  }

  const go = (item: MenuItem) => {
    if (!item.route) return;
    navigation.navigate(item.route, item.params);
  };

  const renderRow = (item: MenuItem) => {
    const body = (
      <View style={styles.cardRow}>
        <IconChip icon={item.icon} colors={item.colors} size={38} radius={11} />
        <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
          <Text style={styles.rowTitle}>{item.title}</Text>
          {item.sub ? <Text style={styles.rowSub}>{item.sub}</Text> : null}
        </View>
        {item.right}
        {item.route ? (
          <Text style={styles.chevron}>›</Text>
        ) : (
          <Text style={styles.soon}>待接入</Text>
        )}
      </View>
    );
    return item.route ? (
      <TouchableOpacity activeOpacity={0.85} onPress={() => go(item)}>
        <Card>{body}</Card>
      </TouchableOpacity>
    ) : (
      <Card style={styles.disabled}>{body}</Card>
    );
  };

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ paddingBottom: 24 }}>
      {/* 账号 hero 卡（长按图标 5 次解锁服务器地址配置） */}
      <ServerAddressEditor
        trigger={
          <View style={styles.hero}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.heroName}>@{user?.username || "未登录"}</Text>
              <View style={styles.badges}>
                <Badge label={roleText} color={theme.accent} />
                <Badge label={`${roomCount} 机房`} color={theme.ok} />
                {user?.isStaff ? <Badge label="员工" color={theme.purple} /> : null}
              </View>
            </View>
          </View>
        }
      />

      {groups.map((g) => (
        <View key={g.title} style={styles.group}>
          <Text style={styles.groupTitle}>{g.title}</Text>
          {g.items.map((it) => (
            <View key={it.title} style={styles.rowGap}>
              {renderRow(it)}
            </View>
          ))}
        </View>
      ))}

      {/* 关于（账号信息下沉，对齐小程序「关于」展开） */}
      <View style={styles.group}>
        <TouchableOpacity activeOpacity={0.85} onPress={() => setShowAbout((v) => !v)}>
          <Card>
            <View style={styles.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>关于</Text>
                <Text style={styles.rowSub}>账号与版本信息</Text>
              </View>
              <Text style={styles.chevron}>{showAbout ? "▾" : "›"}</Text>
            </View>
          </Card>
        </TouchableOpacity>
        {showAbout ? (
          <Card style={styles.aboutCard}>
            <AboutRow label="用户名" value={user?.username || "-"} />
            <AboutRow label="邮箱" value={user?.email || "-"} />
            <AboutRow label="角色" value={roleText} />
            <AboutRow label="员工账号" value={user?.username || "-"} />
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                if (user?.tenantId) {
                  Clipboard.setString(user.tenantId);
                  toast("已复制", "租户 ID 已复制到剪贴板");
                }
              }}
            >
              <AboutRow label="租户 ID" value={user?.tenantId || "-"} copyable />
            </TouchableOpacity>
            <AboutRow label="应用" value="IDC管理工具" />
            <AboutRow label="版本" value={APP_VERSION} />
          </Card>
        ) : null}
      </View>

      {/* 退出登录（两次点击确认，绕开 RN Web 不渲染 Alert 的限制） */}
      <View style={{ marginTop: 8 }}>
        <Button
          label={confirmLogout ? "再次点击确认退出" : "退出登录"}
          danger
          onPress={() => {
            if (!confirmLogout) {
              setConfirmLogout(true);
              setTimeout(() => setConfirmLogout(false), 3000);
              return;
            }
            setConfirmLogout(false);
            logout();
          }}
        />
      </View>
    </ScrollView>
  );
}

function AboutRow({ label, value, copyable }: { label: string; value: string; copyable?: boolean }) {
  return (
    <View style={styles.aboutRow}>
      <Text style={styles.aboutLabel}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", flexShrink: 1 }}>
        <Text style={styles.aboutValue} numberOfLines={1}>
          {value}
        </Text>
        {copyable ? <Text style={styles.copyTag}>复制</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.bg },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.accent,
    margin: 16,
    marginTop: 20,
    borderRadius: theme.r,
    padding: 18,
    shadowColor: theme.accent,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  avatarText: { fontSize: 24, fontWeight: "800", color: "#fff" },
  heroName: { fontSize: 18, fontWeight: "800", color: "#fff" },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  group: { marginTop: 6, paddingHorizontal: 16 },
  groupTitle: { fontSize: 13, fontWeight: "700", color: theme.text3, marginLeft: 4, marginBottom: 4, marginTop: 10 },
  rowGap: { marginBottom: 8 },
  cardRow: { flexDirection: "row", alignItems: "center" },
  rowTitle: { fontSize: 15, color: theme.text1, fontWeight: "600" },
  rowSub: { fontSize: 12, color: theme.text3, marginTop: 2 },
  chevron: { fontSize: 20, color: theme.text3, marginLeft: 8 },
  switchTag: { fontSize: 12, fontWeight: "600", color: theme.accent, marginLeft: 8 },
  soon: { fontSize: 11, fontWeight: "600", color: theme.text3, marginLeft: 8 },
  disabled: { opacity: 0.62 },
  aboutCard: { marginTop: -2, paddingTop: 4 },
  aboutRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: theme.border,
  },
  aboutLabel: { fontSize: 13, color: theme.text2 },
  aboutValue: { fontSize: 13, color: theme.text1, fontWeight: "600", flexShrink: 1, marginLeft: 12, textAlign: "right" },
  copyTag: { fontSize: 11, fontWeight: "700", color: theme.accent, marginLeft: 8 },
});
