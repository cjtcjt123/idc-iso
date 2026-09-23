import React, { useEffect, useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { apiPost, request } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { baseUrlStorage, roomStorage, tokenStorage } from "../storage";
import { Button, Card, CardRow, Input, SectionCard } from "../components/ui";
import { theme } from "../theme";

const APP_VERSION = "1.0.0";

export function SettingsScreen() {
  const { user, logout } = useAuth();
  const [server, setServer] = useState("");
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [busy, setBusy] = useState(false);
  const [themeMode, setThemeMode] = useState<"light" | "dark" | "auto">("light");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    baseUrlStorage.get().then(setServer);
    if (Platform.OS === "web") {
      const saved = (window as any).localStorage?.getItem("idcops_theme");
      if (saved === "dark" || saved === "light" || saved === "auto") setThemeMode(saved);
    }
  }, []);

  const setTheme = (m: "light" | "dark" | "auto") => {
    setThemeMode(m);
    if (Platform.OS === "web") {
      try { (window as any).localStorage?.setItem("idcops_theme", m); } catch { /* localStorage disabled */ }
    }
    document.documentElement.dataset.theme = m === "auto" ? "" : m;
    setMsg(`主题已切换：${m === "light" ? "浅色" : m === "dark" ? "深色" : "跟随系统"}`);
  };

  const onChangePwd = async () => {
    if (!oldPwd || !newPwd) return setMsg("请输入旧密码与新密码");
    if (newPwd.length < 6) return setMsg("新密码至少 6 位");
    setBusy(true);
    try {
      await apiPost("/auth/change-password", { oldPassword: oldPwd, newPassword: newPwd });
      setMsg("密码已更新");
      setOldPwd("");
      setNewPwd("");
    } catch (e: any) {
      setMsg(`修改失败：${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  const onClearCache = async () => {
    if (Platform.OS !== "web") return setMsg("原生环境暂不支持");
    try {
      const ls = (window as any).localStorage;
      if (ls) {
        for (const k of Object.keys(ls)) {
          if (k.startsWith("idcops_") && k !== "idcops_base_url") ls.removeItem(k);
        }
      }
      if ((window as any).caches) {
        const names = await (window as any).caches.keys();
        await Promise.all(names.map((n: string) => (window as any).caches.delete(n)));
      }
      setMsg("缓存已清理（保留登录态与服务器地址）");
    } catch (e: any) {
      setMsg(`清理失败：${e?.message || e}`);
    }
  };

  const onLogout = async () => {
    await logout();
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={{ paddingHorizontal: 16 }}>
        <SectionCard title="账号">
          <CardRow icon="👤" colors={theme.grad.customer} title={user?.username || "未登录"} subtitle={user?.email || ""} right={user?.isSuperuser ? <Text style={styles.tag}>超管</Text> : undefined} />
        </SectionCard>

        <SectionCard title="修改密码">
          <View style={{ paddingHorizontal: 4 }}>
            <Text style={styles.lbl}>旧密码</Text>
            <Input value={oldPwd} onChangeText={setOldPwd} placeholder="当前密码" secure />
            <Text style={styles.lbl}>新密码</Text>
            <Input value={newPwd} onChangeText={setNewPwd} placeholder="至少 6 位" secure />
            <Button label={busy ? "提交中…" : "更新密码"} onPress={onChangePwd} loading={busy} />
          </View>
        </SectionCard>

        <SectionCard title="外观">
          <View style={styles.themeRow}>
            {(["light", "dark", "auto"] as const).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.themeChip, themeMode === m && styles.themeChipOn]}
                onPress={() => setTheme(m)}
                activeOpacity={0.85}
              >
                <Text style={[styles.themeChipText, themeMode === m && styles.themeChipTextOn]}>
                  {m === "light" ? "浅色" : m === "dark" ? "深色" : "跟随系统"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </SectionCard>

        <SectionCard title="服务器">
          <Card>
            <Text style={styles.serverTxt} selectable>{server || "未配置"}</Text>
            <Text style={styles.serverHint}>修改服务器地址：长按「我的」页面右上角头像 5 次解锁。</Text>
          </Card>
        </SectionCard>

        <SectionCard title="维护">
          <CardRow icon="🧹" colors={theme.grad.odf} title="清理缓存" subtitle="清 localStorage 与浏览器缓存" onPress={onClearCache} />
        </SectionCard>

        <SectionCard title="关于">
          <Card>
            <InfoRow label="应用" value="IDC 管理工具" />
            <InfoRow label="版本" value={APP_VERSION} />
            <InfoRow label="环境" value={Platform.OS} />
          </Card>
        </SectionCard>

        {msg ? <Text style={styles.msg}>{msg}</Text> : null}

        <Button label="退出登录" danger onPress={onLogout} />
      </View>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  lbl: { fontSize: 12, fontWeight: "700", color: theme.text2, marginTop: 8, marginBottom: 6 },
  tag: { fontSize: 11, color: theme.purple, fontWeight: "700" },
  themeRow: { flexDirection: "row", gap: 8 },
  themeChip: { flex: 1, paddingVertical: 11, alignItems: "center", borderRadius: 11, backgroundColor: theme.track },
  themeChipOn: { backgroundColor: theme.accent },
  themeChipText: { fontSize: 13, color: theme.text2, fontWeight: "600" },
  themeChipTextOn: { color: "#fff" },
  serverTxt: { fontSize: 12, color: theme.text1, fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }) },
  serverHint: { fontSize: 11, color: theme.text3, marginTop: 6 },
  msg: { fontSize: 12, color: theme.info, textAlign: "center", marginVertical: 8 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderTopWidth: 1, borderColor: theme.border },
  infoLabel: { fontSize: 13, color: theme.text2 },
  infoValue: { fontSize: 13, color: theme.text1, fontWeight: "600" },
});