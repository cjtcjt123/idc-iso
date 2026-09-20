import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { Button, Input } from "../components/ui";
import { ServerAddressEditor } from "../components/ServerAddressEditor";
import { theme } from "../theme";

export function LoginScreen() {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!identifier || !password) {
      Alert.alert("请填写账号和密码");
      return;
    }
    setLoading(true);
    try {
      await login(identifier, password);
    } catch (e: any) {
      Alert.alert("登录失败", e?.message || "未知错误");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.wrap}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.inner}>
        {/* 未登录也能改地址：连点标题 5 次 → 输口令 → 解锁编辑（避免连不上后端时进不了设置页） */}
        <ServerAddressEditor
          trigger={
            <View>
              <Text style={styles.logo}>IDC 运维</Text>
              <Text style={styles.sub}>数据中心资产管理</Text>
            </View>
          }
        />
        <View style={styles.form}>
          <Input
            placeholder="账号 / 邮箱"
            value={identifier}
            onChangeText={setIdentifier}
          />
          <View style={{ height: 10 }} />
          <Input
            placeholder="密码"
            value={password}
            onChangeText={setPassword}
            secure
          />
          <Button label="登录" onPress={submit} loading={loading} />
        </View>
        <Text style={styles.hint}>连点上方标题 5 次可配置服务器地址</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.bg },
  inner: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  logo: { fontSize: 30, fontWeight: "800", color: theme.text1, textAlign: "center" },
  sub: { fontSize: 14, color: theme.text3, textAlign: "center", marginTop: 6, marginBottom: 28 },
  form: { backgroundColor: theme.surface, borderRadius: 16, padding: 16 },
  hint: { textAlign: "center", color: theme.text3, fontSize: 12, marginTop: 18 },
});
