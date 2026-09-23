import React, { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { apiCollect, apiDelete, apiPatch, apiPost } from "../api/client";
import { useCan } from "../auth/permission";
import type { Location, Warehouse } from "../api/types";
import { Button, EmptyState, Input, Loading, Sheet } from "../components/ui";
import { theme } from "../theme";

type Editor = {
  warehouseId: string;
  zone: string;
  rack: string;
  uPosition: string;
  bin: string;
  code: string;
};

const EMPTY: Editor = { warehouseId: "", zone: "", rack: "", uPosition: "", bin: "", code: "" };

function pathOf(l: Location): string {
  const parts = [l.zone, l.rack, l.uPosition, l.bin].filter(Boolean);
  return parts.join(" > ") || l.code;
}

export function LocationsScreen({ navigation }: any) {
  const can = useCan();
  const canCreate = can("inventory", "create");
  const canUpdate = can("inventory", "update");
  const canDelete = can("inventory", "delete");

  const [locations, setLocations] = useState<Location[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [editingId, setEditingId] = useState("");
  const [warehouseIdx, setWarehouseIdx] = useState(0);
  const [whPicker, setWhPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const [loc, wh] = await Promise.all([
        apiCollect<Location>("/inventory/locations"),
        apiCollect<Warehouse>("/inventory/warehouses"),
      ]);
      setLocations(loc);
      setWarehouses(wh);
    } catch (e) {
      // 网络错误已由全局处理
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openAdd() {
    if (!canCreate) return;
    setEditingId("");
    setWarehouseIdx(warehouses.length ? 0 : -1);
    setEditor({ ...EMPTY, warehouseId: warehouses[0]?.id || "" });
  }
  function openEdit(l: Location) {
    if (!canUpdate) return;
    const idx = warehouses.findIndex((w) => w.id === l.warehouseId);
    setEditingId(l.id);
    setWarehouseIdx(Math.max(0, idx));
    setEditor({
      warehouseId: l.warehouseId || "",
      zone: l.zone || "",
      rack: l.rack || "",
      uPosition: l.uPosition || "",
      bin: l.bin || "",
      code: l.code || "",
    });
  }
  async function remove(l: Location) {
    if (!canDelete) return;
    Alert.alert("确认删除", `将删除库位「${pathOf(l)}」，不可恢复。`, [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          try {
            await apiDelete(`/inventory/locations/${l.id}`);
            load();
          } catch (e) {
            /* 全局处理 */
          }
        },
      },
    ]);
  }

  async function save() {
    if (!editor) return;
    if (!editor.warehouseId) {
      Alert.alert("请选择所属仓库");
      return;
    }
    if (saving) return;
    setSaving(true);
    const body = { ...editor };
    try {
      if (editingId) await apiPatch(`/inventory/locations/${editingId}`, body);
      else await apiPost("/inventory/locations", body);
      setEditor(null);
      load();
    } catch (e) {
      /* 全局处理 */
    } finally {
      setSaving(false);
    }
  }

  const whName = warehouses[warehouseIdx]?.name || "请选择仓库";

  return (
    <View style={s.wrap}>
      <View style={s.bar}>
        <Text style={s.barTitle}>库位</Text>
        {canCreate ? (
          <TouchableOpacity style={s.addBtn} onPress={openAdd}>
            <Text style={s.addBtnText}>＋ 新建</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <Loading />
      ) : locations.length === 0 ? (
        <EmptyState text="暂无库位" />
      ) : (
        <FlatList
          data={locations}
          keyExtractor={(l) => l.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          contentContainerStyle={{ paddingVertical: 8 }}
          renderItem={({ item: l }) => {
            const canAct = canUpdate || canDelete;
            return (
              <View style={s.card}>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => openEdit(l)} disabled={!canUpdate}>
                  <Text style={s.code}>{l.code}</Text>
                  <Text style={s.path}>{pathOf(l)}</Text>
                  <Text style={s.wh}>{l.warehouseName || warehouses.find((w) => w.id === l.warehouseId)?.name || "未分配仓库"}</Text>
                </TouchableOpacity>
                {canAct ? (
                  <View style={s.actions}>
                    {canUpdate ? (
                      <TouchableOpacity onPress={() => openEdit(l)} style={s.actBtn}>
                        <Text style={s.actText}>编辑</Text>
                      </TouchableOpacity>
                    ) : null}
                    {canDelete ? (
                      <TouchableOpacity onPress={() => remove(l)} style={s.actBtn}>
                        <Text style={[s.actText, s.actDanger]}>删除</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      )}

      <Sheet visible={!!editor} title={editingId ? "编辑库位" : "新建库位"} onClose={() => setEditor(null)} scrollable>
        {editor ? (
          <View>
            <Text style={s.label}>所属仓库</Text>
            <TouchableOpacity style={s.pickRow} onPress={() => setWhPicker(true)}>
              <Text style={[s.pickText, !editor.warehouseId && s.placeholder]}>{whName}</Text>
              <Text style={s.chev}>›</Text>
            </TouchableOpacity>

            <Text style={s.label}>区域 / 货架</Text>
            <Input value={editor.zone} onChangeText={(t) => setEditor({ ...editor, zone: t })} placeholder="如 A 区" />
            <Text style={s.label}>机柜</Text>
            <Input value={editor.rack} onChangeText={(t) => setEditor({ ...editor, rack: t })} placeholder="如 R01" />
            <Text style={s.label}>U 位</Text>
            <Input value={editor.uPosition} onChangeText={(t) => setEditor({ ...editor, uPosition: t })} placeholder="如 12U" />
            <Text style={s.label}>收纳盒</Text>
            <Input value={editor.bin} onChangeText={(t) => setEditor({ ...editor, bin: t })} placeholder="如 B-02" />
            <Text style={s.label}>库位码（可不填，自动拼接）</Text>
            <Input value={editor.code} onChangeText={(t) => setEditor({ ...editor, code: t })} placeholder="区域-机柜-U位-盒" />

            <Button label={saving ? "保存中…" : "保存"} loading={saving} onPress={save} />
          </View>
        ) : null}
      </Sheet>

      <Sheet visible={whPicker} title="选择仓库" onClose={() => setWhPicker(false)} scrollable>
        {warehouses.length === 0 ? (
          <EmptyState text="暂无仓库" />
        ) : (
          warehouses.map((w, i) => (
            <TouchableOpacity
              key={w.id}
              style={s.whItem}
              onPress={() => {
                setWarehouseIdx(i);
                setEditor((e) => (e ? { ...e, warehouseId: w.id } : e));
                setWhPicker(false);
              }}
            >
              <Text style={[s.whItemText, i === warehouseIdx && s.whItemOn]}>{w.name}</Text>
              {i === warehouseIdx ? <Text style={s.whItemCheck}>✓</Text> : null}
            </TouchableOpacity>
          ))
        )}
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.bg },
  bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  barTitle: { fontSize: 22, fontWeight: "700", color: theme.text1 },
  addBtn: { backgroundColor: theme.accentSoft, paddingHorizontal: 14, paddingVertical: 7, borderRadius: theme.rPill },
  addBtnText: { color: theme.accent, fontWeight: "700", fontSize: 14 },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: theme.surface, marginHorizontal: 16, marginVertical: 6, borderRadius: 14, padding: 14 },
  code: { fontSize: 15, fontWeight: "700", color: theme.text1 },
  path: { fontSize: 13, color: theme.text2, marginTop: 3 },
  wh: { fontSize: 12, color: theme.text3, marginTop: 4 },
  actions: { flexDirection: "row", alignItems: "center" },
  actBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  actText: { color: theme.accent, fontWeight: "600", fontSize: 14 },
  actDanger: { color: theme.danger },
  label: { fontSize: 13, color: theme.text2, marginTop: 14, marginBottom: 6 },
  pickRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  pickText: { fontSize: 15, color: theme.text1 },
  placeholder: { color: theme.text3 },
  chev: { fontSize: 18, color: theme.text3 },
  whItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, paddingHorizontal: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.border },
  whItemText: { fontSize: 15, color: theme.text1 },
  whItemOn: { color: theme.accent, fontWeight: "700" },
  whItemCheck: { color: theme.accent, fontWeight: "700" },
});
