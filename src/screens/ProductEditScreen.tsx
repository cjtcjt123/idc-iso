import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { RouteProp, useRoute } from "@react-navigation/native";
import { apiCollect, apiGet, apiPatch, apiPost } from "../api/client";
import { useCan } from "../auth/permission";
import type { InventoryItem, ItemCategory } from "../api/types";
import { Button, Input, Sheet } from "../components/ui";
import { theme } from "../theme";

type Form = {
  name: string;
  categoryId: string;
  manufacturer: string;
  model: string;
  unit: string;
  spec: string;
  warningQuantity: string;
  description: string;
  snEnabled: boolean;
};

const EMPTY: Form = {
  name: "",
  categoryId: "",
  manufacturer: "",
  model: "",
  unit: "",
  spec: "",
  warningQuantity: "",
  description: "",
  snEnabled: false,
};

function flatCats(cats: ItemCategory[], parentId: string | null = null, depth = 0, acc: ItemCategory[] = []): ItemCategory[] {
  cats
    .filter((c) => (c.parentId ?? null) === parentId)
    .forEach((c) => {
      acc.push({ ...c, name: (depth > 0 ? "　".repeat(depth) + "└ " : "") + c.name });
      flatCats(cats, c.id, depth + 1, acc);
    });
  return acc;
}

export function ProductEditScreen({ navigation }: any) {
  const route = useRoute<RouteProp<Record<string, any>, string>>();
  const params = (route.params || {}) as { id?: string; categoryId?: string; categoryName?: string };
  const can = useCan();
  const isEdit = !!params.id;
  const canSave = isEdit ? can("inventory", "update") : can("inventory", "create");

  const [form, setForm] = useState<Form>({ ...EMPTY, categoryId: params.categoryId || "" });
  const [categoryName, setCategoryName] = useState(params.categoryId ? params.categoryName || "未分类" : "未分类");
  const [catOptions, setCatOptions] = useState<ItemCategory[]>([]);
  const [catPicker, setCatPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(!isEdit);

  function set<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function loadCategories() {
    try {
      const list = await apiCollect<ItemCategory>("/inventory/categories");
      setCatOptions(flatCats(list));
    } catch (e) {
      /* 全局处理 */
    }
  }

  async function loadDetail() {
    try {
      const p = await apiGet<InventoryItem>(`/inventory/items/${params.id}`);
      setForm({
        name: p.name || "",
        categoryId: p.categoryId || "",
        manufacturer: p.manufacturer || "",
        model: p.model || "",
        unit: p.unit || "",
        spec: p.spec ? JSON.stringify(p.spec) : "",
        warningQuantity: p.warningQuantity != null ? String(p.warningQuantity) : "",
        description: p.description || "",
        snEnabled: !!p.snEnabled,
      });
      const idx = catOptions.findIndex((c) => c.id === (p.categoryId || ""));
      setCategoryName(p.categoryId && idx >= 0 ? catOptions[idx].name : "未分类");
    } catch (e) {
      Alert.alert("加载失败");
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    loadCategories();
    if (isEdit) loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (!canSave) return;
    if (!form.name.trim()) {
      Alert.alert("请输入物料名称");
      return;
    }
    if (saving) return;
    setSaving(true);
    let spec: any = null;
    if (form.spec.trim()) {
      try {
        spec = JSON.parse(form.spec);
      } catch {
        spec = { note: form.spec };
      }
    }
    const payload: any = {
      name: form.name.trim(),
      categoryId: form.categoryId || undefined,
      manufacturer: form.manufacturer.trim() || undefined,
      model: form.model.trim() || undefined,
      unit: form.unit.trim() || undefined,
      spec,
      warningQuantity: form.warningQuantity ? Number(form.warningQuantity) : undefined,
      description: form.description.trim() || undefined,
      snEnabled: form.snEnabled,
    };
    try {
      if (isEdit) await apiPatch(`/inventory/items/${params.id}`, payload);
      else await apiPost("/inventory/items", payload);
      navigation.goBack();
    } catch (e) {
      /* 全局处理 */
    } finally {
      setSaving(false);
    }
  }

  function pickCategory(idx: number) {
    const c = catOptions[idx];
    setForm((f) => ({ ...f, categoryId: c.id }));
    setCategoryName(c.name);
    setCatPicker(false);
  }

  if (!loaded) {
    return (
      <View style={s.wrap}>
        <View style={s.bar}>
          <Text style={s.barTitle}>{isEdit ? "编辑物料" : "新增物料"}</Text>
        </View>
        <View style={s.center}><Text style={s.hint}>加载中…</Text></View>
      </View>
    );
  }

  return (
    <View style={s.wrap}>
      <View style={s.bar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>取消</Text>
        </TouchableOpacity>
        <Text style={s.barTitle}>{isEdit ? "编辑物料" : "新增物料"}</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        <Text style={s.label}>物料名称 *</Text>
        <Input value={form.name} onChangeText={(t) => set("name", t)} placeholder="如：DDR4 16G 内存条" />

        <Text style={s.label}>所属分类</Text>
        <TouchableOpacity style={s.pickRow} onPress={() => setCatPicker(true)}>
          <Text style={[s.pickText, categoryName === "未分类" && s.placeholder]}>{categoryName}</Text>
          <Text style={s.chev}>›</Text>
        </TouchableOpacity>

        <Text style={s.label}>厂商</Text>
        <Input value={form.manufacturer} onChangeText={(t) => set("manufacturer", t)} placeholder="如：三星" />
        <Text style={s.label}>型号</Text>
        <Input value={form.model} onChangeText={(t) => set("model", t)} placeholder="如：M393A2K40BB2" />
        <Text style={s.label}>单位</Text>
        <Input value={form.unit} onChangeText={(t) => set("unit", t)} placeholder="如：根 / 台" />
        <Text style={s.label}>低库存预警线</Text>
        <Input value={form.warningQuantity} onChangeText={(t) => set("warningQuantity", t)} placeholder="可选，如 5" />
        <Text style={s.label}>规格参数（JSON，可选）</Text>
        <Input value={form.spec} onChangeText={(t) => set("spec", t)} placeholder='{"capacity":"16G"}' />
        <Text style={s.label}>描述</Text>
        <Input value={form.description} onChangeText={(t) => set("description", t)} placeholder="可选备注" />

        <TouchableOpacity style={s.switchRow} onPress={() => set("snEnabled", !form.snEnabled)}>
          <Text style={s.switchLabel}>启用 SN 码管理（一物一码）</Text>
          <View style={[s.switch, form.snEnabled && s.switchOn]}>
            <View style={[s.knob, form.snEnabled && s.knobOn]} />
          </View>
        </TouchableOpacity>

        <Button label={saving ? "保存中…" : "保存"} loading={saving} disabled={!form.name.trim() || !canSave} onPress={save} />
      </ScrollView>

      <Sheet visible={catPicker} title="选择分类" onClose={() => setCatPicker(false)} scrollable>
        <TouchableOpacity style={s.catItem} onPress={() => { setForm((f) => ({ ...f, categoryId: "" })); setCategoryName("未分类"); setCatPicker(false); }}>
          <Text style={s.catItemText}>未分类</Text>
        </TouchableOpacity>
        {catOptions.map((c, i) => (
          <TouchableOpacity key={c.id} style={s.catItem} onPress={() => pickCategory(i)}>
            <Text style={[s.catItemText, c.id === form.categoryId && s.catItemOn]}>{c.name}</Text>
            {c.id === form.categoryId ? <Text style={s.check}>✓</Text> : null}
          </TouchableOpacity>
        ))}
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.bg },
  bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  barTitle: { fontSize: 18, fontWeight: "700", color: theme.text1 },
  backBtn: { width: 48 },
  backText: { color: theme.text2, fontSize: 15 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  hint: { color: theme.text3, fontSize: 14 },
  label: { fontSize: 13, color: theme.text2, marginTop: 14, marginBottom: 6 },
  pickRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  pickText: { fontSize: 15, color: theme.text1 },
  placeholder: { color: theme.text3 },
  chev: { fontSize: 18, color: theme.text3 },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18, marginBottom: 6 },
  switchLabel: { fontSize: 14, color: theme.text1, flex: 1 },
  switch: { width: 48, height: 28, borderRadius: 14, backgroundColor: theme.track, padding: 2, justifyContent: "center" },
  switchOn: { backgroundColor: theme.accent },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#fff" },
  knobOn: { alignSelf: "flex-end" },
  catItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 13, paddingHorizontal: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.border },
  catItemText: { fontSize: 15, color: theme.text1 },
  catItemOn: { color: theme.accent, fontWeight: "700" },
  check: { color: theme.accent, fontWeight: "700" },
});
