import React, { useRef, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { baseUrlStorage } from "../storage";
import { CONFIG_PASSKEY, DEFAULT_BASE_URL, isAllowedBaseUrl } from "../config";
import { Button, Card, Input } from "./ui";

/** 连点解锁所需的点击次数与有效时间窗（与小程序一致） */
const TAP_COUNT = 5;
const TAP_WINDOW = 2000;

/**
 * 服务器地址「应急入口」启动器。
 * 用法：把可点击的图标/Logo 作为 trigger 传入；连点 5 次 → 输入配置口令 → 解锁后出现地址编辑框。
 * 与小程序「连点 logo + 口令」行为一致；登录页与我的页都放一份，避免连不上后端时进不了设置页。
 */
export function ServerAddressEditor({ trigger }: { trigger: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const taps = useRef({ count: 0, at: 0 });

  const loadCurrent = async () => {
    const cur = await baseUrlStorage.get();
    setValue(cur);
  };

  const onIconTap = () => {
    const now = Date.now();
    if (now - taps.current.at > TAP_WINDOW) taps.current.count = 0;
    taps.current.at = now;
    taps.current.count += 1;
    if (taps.current.count < TAP_COUNT) return;
    taps.current.count = 0;

    // 已解锁：再连点 5 次直接打开编辑框
    if (unlocked) {
      loadCurrent().then(() => setEditing(true));
      return;
    }
    Alert.prompt(
      "配置口令",
      "请输入配置口令以修改服务器地址",
      [
        { text: "取消", style: "cancel" },
        {
          text: "确定",
          onPress: (text) => {
            if ((text || "").trim() !== CONFIG_PASSKEY) {
              Alert.alert("口令错误");
              return;
            }
            setUnlocked(true);
            loadCurrent().then(() => setEditing(true));
            Alert.alert("已解锁", "可修改服务器地址");
          },
        },
      ],
      "plain-text"
    );
  };

  const save = async () => {
    const url = value.trim();
    if (!url) {
      Alert.alert("地址不能为空");
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      Alert.alert("格式错误", "需以 http:// 或 https:// 开头");
      return;
    }
    if (!isAllowedBaseUrl(url)) {
      Alert.alert(
        "地址不被允许",
        "仅允许内网地址（10/192.168/172.16~31/100.64 段）或 https 公网域名"
      );
      return;
    }
    await baseUrlStorage.save(url.replace(/\/+$/, ""));
    setEditing(false);
    Alert.alert("已保存", `后端地址：${url}`);
  };

  const reset = async () => {
    await baseUrlStorage.save(DEFAULT_BASE_URL);
    setEditing(false);
    Alert.alert("已恢复默认", DEFAULT_BASE_URL);
  };

  return (
    <View>
      <TouchableOpacity onPress={onIconTap} activeOpacity={0.7}>
        {trigger}
      </TouchableOpacity>
      {unlocked && editing ? (
        <Card>
          <Input
            placeholder="http://IP:3000"
            value={value}
            onChangeText={setValue}
          />
          <Text style={styles.hint}>默认地址：{DEFAULT_BASE_URL}</Text>
          <Button label="保存地址" onPress={save} />
          <View style={{ height: 10 }} />
          <Button label="恢复默认地址" onPress={reset} />
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 12, color: "#94a3b8", marginTop: 8, marginBottom: 2 },
});
