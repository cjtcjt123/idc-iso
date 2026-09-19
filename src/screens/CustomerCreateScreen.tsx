import React, { useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { apiPost } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { CreateCustomerInput } from "../api/types";
import { Button, Card, Input, ListRow } from "../components/ui";

export function CustomerCreateScreen({ navigation }: any) {
  const { currentRoomId } = useAuth();
  const [form, setForm] = useState<CreateCustomerInput>({ name: "" });
  const [busy, setBusy] = useState(false);

  const set = (k: keyof CreateCustomerInput, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim()) {
      Alert.alert("请填写客户名称");
      return;
    }
    setBusy(true);
    try {
      const body = { ...form, name: form.name.trim(), roomId: currentRoomId || undefined };
      await apiPost("/customers", body);
      Alert.alert("已创建", "客户创建成功");
      navigation.goBack();
    } catch (e: any) {
      Alert.alert("失败", e?.message || "创建失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#f5f7fa" }}>
      <Card>
        <ListRow title="归属机房" subtitle={currentRoomId || "未选择（将不绑定机房）"} onPress={undefined} />
        <Input placeholder="客户名称 *" value={form.name} onChangeText={(t) => set("name", t)} />
        <Input placeholder="客户编号" value={form.code ?? ""} onChangeText={(t) => set("code", t)} />
        <Input placeholder="联系人" value={form.contactName ?? ""} onChangeText={(t) => set("contactName", t)} />
        <Input placeholder="联系电话" value={form.contactPhone ?? ""} onChangeText={(t) => set("contactPhone", t)} />
        <Input placeholder="联系邮箱" value={form.contactEmail ?? ""} onChangeText={(t) => set("contactEmail", t)} />
        <Input placeholder="地址" value={form.address ?? ""} onChangeText={(t) => set("address", t)} />
        <Input placeholder="备注" value={form.remark ?? ""} onChangeText={(t) => set("remark", t)} />
      </Card>
      <Button label="创建客户" onPress={submit} loading={busy} />
    </ScrollView>
  );
}
