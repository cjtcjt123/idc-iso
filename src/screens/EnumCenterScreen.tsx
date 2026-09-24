import React, { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { apiCollect, apiDelete, apiPatch, apiPost } from "../api/client";
import type { EnumDef, EnumOption } from "../api/types";
import { useCan } from "../auth/permission";
import { Chip, EmptyState, Input, Loading, Sheet } from "../components/ui";
import { theme } from "../theme";

type Filter = "all" | "system" | "custom";

export function EnumCenterScreen() {
  const can = useCan();
  const [items, setItems] = useState<EnumDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // 新建选项组
  const [showEnumForm, setShowEnumForm] = useState(false);
  const [enumName, setEnumName] = useState("");

  // 新增 / 编辑选项
  const [showOptForm, setShowOptForm] = useState(false);
  const [optMode, setOptMode] = useState<"add" | "edit">("add");
  const [optEnumId, setOptEnumId] = useState("");
  const [optEditValue, setOptEditValue] = useState("");
  const [optLabel, setOptLabel] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const list = await apiCollect<EnumDef>("/enums");
      setItems(list);
    } catch {
      /* 静默 */
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = items.filter((it) =>
    filter === "all" ? true : filter === "system" ? it.isSystem : !it.isSystem
  );
  const counts = {
    all: items.length,
    system: items.filter((i) => i.isSystem).length,
    custom: items.filter((i) => !i.isSystem).length,
  };

  const toggle = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  // ── 新建选项组 ──
  const openEnumForm = () => {
    if (!can("enum", "create")) {
      Alert.alert("无权限", "当前账号无新增选项组权限");
      return;
    }
    setEnumName("");
    setShowEnumForm(true);
  };
  const submitEnum = async () => {
    const name = enumName.trim();
    if (!name) {
      Alert.alert("请填写名称");
      return;
    }
    const code = `custom_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
    try {
      await apiPost("/enums", { code, name });
      Alert.alert("已新增");
      setShowEnumForm(false);
      load();
    } catch (e: any) {
      Alert.alert("创建失败", e?.message || "操作失败");
    }
  };

  // ── 新增选项 ──
  const openAddOpt = (def: EnumDef) => {
    if (!can("enum", "update")) {
      Alert.alert("无权限", "当前账号无修改选项权限");
      return;
    }
    if (def.isSystem) {
      Alert.alert("系统选项只读", "系统枚举不可修改");
      return;
    }
    setOptMode("add");
    setOptEnumId(def.id);
    setOptEditValue("");
    setOptLabel("");
    setShowOptForm(true);
  };

  // ── 编辑选项 ──
  const openEditOpt = (def: EnumDef, opt: EnumOption) => {
    if (!can("enum", "update")) {
      Alert.alert("无权限", "当前账号无修改选项权限");
      return;
    }
    if (def.isSystem) {
      Alert.alert("系统选项只读", "系统枚举不可修改");
      return;
    }
    setOptMode("edit");
    setOptEnumId(def.id);
    setOptEditValue(opt.value);
    setOptLabel(opt.label);
    setShowOptForm(true);
  };

  const submitOpt = async () => {
    const label = optLabel.trim();
    if (!label) {
      Alert.alert("请填写名称");
      return;
    }
    const def = items.find((i) => i.id === optEnumId);
    if (!def) return;
    const value =
      optMode === "edit"
        ? optEditValue
        : label.replace(/\s+/g, "_").toLowerCase() || `opt_${Date.now().toString(36)}`;
    const options: EnumOption[] =
      optMode === "edit"
        ? def.options.map((o) => (o.value === optEditValue ? { ...o, label } : o))
        : def.options.concat([{ value, label, color: null }]);
    try {
      await apiPatch(`/enums/${def.id}`, { options });
      Alert.alert(optMode === "edit" ? "已更新" : "已添加");
      setShowOptForm(false);
      load();
    } catch (e: any) {
      Alert.alert("提交失败", e?.message || "操作失败");
    }
  };

  const deleteOpt = (def: EnumDef, opt: EnumOption) => {
    if (!can("enum", "delete")) {
      Alert.alert("无权限", "当前账号无删除选项权限");
      return;
    }
    Alert.alert("删除选项", `确认删除「${opt.label}」？已使用该选项的数据将显示为空。`, [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          try {
            await apiPatch(`/enums/${def.id}`, {
              options: def.options.filter((o) => o.value !== opt.value),
            });
            Alert.alert("已删除");
            load();
          } catch (e: any) {
            Alert.alert("删除失败", e?.message || "操作失败");
          }
        },
      },
    ]);
  };

  const deleteEnum = (def: EnumDef) => {
    if (!can("enum", "delete")) {
      Alert.alert("无权限", "当前账号无删除选项组权限");
      return;
    }
    if (def.isSystem) {
      Alert.alert("系统选项组不可删除");
      return;
    }
    Alert.alert("删除选项组", `确认删除「${def.name}」？其下选项将一并删除。`, [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          try {
            await apiDelete(`/enums/${def.id}`);
            Alert.alert("已删除");
            load();
          } catch (e: any) {
            Alert.alert("删除失败", e?.message || "操作失败");
          }
        },
      },
    ]);
  };

  if (loading) return <Loading />;

  const renderEnum = ({ item }: { item: EnumDef }) => (
    <EnumCard
      def={item}
      open={!!expanded[item.id]}
      onToggle={() => toggle(item.id)}
      canUpdate={can("enum", "update")}
      canDelete={can("enum", "delete")}
      onAddOpt={() => openAddOpt(item)}
      onEditOpt={(o) => openEditOpt(item, o)}
      onDeleteOpt={(o) => deleteOpt(item, o)}
      onDelete={() => deleteEnum(item)}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Chip label={`全部 ${counts.all}`} active={filter === "all"} onPress={() => setFilter("all")} />
          <Chip label={`系统 ${counts.system}`} active={filter === "system"} onPress={() => setFilter("system")} />
          <Chip label={`自定义 ${counts.custom}`} active={filter === "custom"} onPress={() => setFilter("custom")} />
        </ScrollView>
      </View>

      {visible.length === 0 ? (
        <EmptyState text="暂无枚举" />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          renderItem={renderEnum}
        />
      )}

      {can("enum", "create") ? (
        <TouchableOpacity activeOpacity={0.85} style={styles.fab} onPress={openEnumForm}>
          <Text style={styles.fabText}>＋ 新建选项组</Text>
        </TouchableOpacity>
      ) : null}

      {/* 新建选项组 */}
      <Sheet visible={showEnumForm} title="新建选项组" onClose={() => setShowEnumForm(false)} scrollable>
        <View>
          <Text style={styles.fLabel}>名称 *</Text>
          <Input placeholder="如：合同类型" value={enumName} onChangeText={setEnumName} />
          <Text style={styles.hint}>机器代码自动生成，无需填写。</Text>
          <TouchableOpacity activeOpacity={0.7} style={styles.saveBtn} onPress={submitEnum}>
            <Text style={styles.saveBtnText}>创建</Text>
          </TouchableOpacity>
        </View>
      </Sheet>

      {/* 新增 / 编辑选项 */}
      <Sheet visible={showOptForm} title={optMode === "edit" ? "修改选项名称" : "添加选项"} onClose={() => setShowOptForm(false)} scrollable>
        <View>
          <Text style={styles.fLabel}>显示名 *</Text>
          <Input placeholder="如：重要客户" value={optLabel} onChangeText={setOptLabel} />
          {optMode === "add" ? <Text style={styles.hint}>机器值由名称自动生成，已存数据不会失联。</Text> : null}
          <TouchableOpacity activeOpacity={0.7} style={styles.saveBtn} onPress={submitOpt}>
            <Text style={styles.saveBtnText}>{optMode === "edit" ? "保存" : "添加"}</Text>
          </TouchableOpacity>
        </View>
      </Sheet>
    </View>
  );
}

function EnumCard({
  def,
  open,
  onToggle,
  canUpdate,
  canDelete,
  onAddOpt,
  onEditOpt,
  onDeleteOpt,
  onDelete,
}: {
  def: EnumDef;
  open: boolean;
  onToggle: () => void;
  canUpdate: boolean;
  canDelete: boolean;
  onAddOpt: () => void;
  onEditOpt: (o: EnumOption) => void;
  onDeleteOpt: (o: EnumOption) => void;
  onDelete: () => void;
}) {
  return (
    <View style={styles.card}>
      <TouchableOpacity activeOpacity={0.8} onPress={onToggle} style={styles.cardHead}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardName} numberOfLines={1}>{def.name}</Text>
            {def.isSystem ? <Text style={styles.sysTag}>系统</Text> : null}
          </View>
          <Text style={styles.cardCode}>{def.code}{def.description ? ` · ${def.description}` : ""}</Text>
          <Text style={styles.cardCount}>{def.options.length} 个选项</Text>
        </View>
        <Text style={styles.chevron}>{open ? "▾" : "›"}</Text>
      </TouchableOpacity>

      {open ? (
        <View style={styles.optWrap}>
          {def.options.length === 0 ? (
            <Text style={styles.optEmpty}>暂无选项</Text>
          ) : (
            def.options.map((o) => (
              <TouchableOpacity
                key={o.value}
                activeOpacity={0.7}
                style={styles.optRow}
                onLongPress={() => canUpdate && !def.isSystem && onEditOpt(o)}
                disabled={!canUpdate}
              >
                <View style={[styles.colorDot, { backgroundColor: o.color || "#94a3b8" }]} />
                <Text style={styles.optLabel}>{o.label}</Text>
                <Text style={styles.optValue}>{o.value}</Text>
                {canUpdate && !def.isSystem ? (
                  <View style={styles.optActions}>
                    <TouchableOpacity activeOpacity={0.7} onPress={() => onEditOpt(o)}>
                      <Text style={styles.optActText}>改</Text>
                    </TouchableOpacity>
                    {canDelete ? (
                      <TouchableOpacity activeOpacity={0.7} onPress={() => onDeleteOpt(o)}>
                        <Text style={[styles.optActText, { color: theme.danger ?? "#ef4444" }]}>删</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}
              </TouchableOpacity>
            ))
          )}
          <View style={styles.cardFoot}>
            {canUpdate && !def.isSystem ? (
              <TouchableOpacity activeOpacity={0.7} style={styles.addOptBtn} onPress={onAddOpt}>
                <Text style={styles.addOptText}>＋ 添加选项</Text>
              </TouchableOpacity>
            ) : null}
            {canDelete && !def.isSystem ? (
              <TouchableOpacity activeOpacity={0.7} onPress={onDelete}>
                <Text style={[styles.delGroupText, { color: theme.danger ?? "#ef4444" }]}>删除选项组</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  filterBar: { padding: 16, paddingBottom: 4 },
  chipRow: { gap: 6 },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  cardHead: { flexDirection: "row", alignItems: "center" },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardName: { fontSize: 15, fontWeight: "700", color: theme.text1 },
  sysTag: { fontSize: 10, fontWeight: "700", color: theme.accent, backgroundColor: theme.accent + "22", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  cardCode: { fontSize: 11, color: theme.text3, marginTop: 2 },
  cardCount: { fontSize: 11, color: theme.text3, marginTop: 2 },
  chevron: { fontSize: 18, color: theme.text3, marginLeft: 8 },
  optWrap: { marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.border, paddingTop: 8 },
  optEmpty: { fontSize: 12, color: theme.text3, paddingVertical: 6 },
  optRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.border },
  colorDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  optLabel: { flex: 1, fontSize: 13, color: theme.text1 },
  optValue: { fontSize: 11, color: theme.text3, marginRight: 8 },
  optActions: { flexDirection: "row", gap: 12 },
  optActText: { fontSize: 12, color: theme.accent, fontWeight: "700" },
  cardFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  addOptBtn: { paddingVertical: 6 },
  addOptText: { fontSize: 12, color: theme.accent, fontWeight: "700" },
  delGroupText: { fontSize: 12, fontWeight: "700" },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 20,
    backgroundColor: theme.accent,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  fabText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  fLabel: { fontSize: 13, fontWeight: "700", color: theme.text1, marginBottom: 6 },
  hint: { fontSize: 11, color: theme.text3, marginTop: 8, lineHeight: 16 },
  saveBtn: { marginTop: 16, alignItems: "center", paddingVertical: 13, borderRadius: 12, backgroundColor: theme.accent },
  saveBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
});
