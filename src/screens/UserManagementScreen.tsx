import React, { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { apiCollect, apiDelete, apiPatch, apiPost } from "../api/client";
import type { AdminUser, Customer, RoleDef, Room } from "../api/types";
import { Chip, EmptyState, Input, Loading, Sheet } from "../components/ui";
import { theme } from "../theme";

// 后端实际生效的 RBAC 码（grep @RequirePermissions 所得）
const PERMISSION_MODULES: { key: string; label: string; actions: { key: string; label: string }[] }[] = [
  { key: "device", label: "设备", actions: [{ key: "create", label: "新增" }, { key: "update", label: "修改" }, { key: "delete", label: "删除" }] },
  { key: "rack", label: "机柜", actions: [{ key: "create", label: "新增" }, { key: "update", label: "修改" }, { key: "delete", label: "删除" }] },
  { key: "room", label: "机房", actions: [{ key: "create", label: "新增" }, { key: "update", label: "修改" }, { key: "delete", label: "删除" }] },
  { key: "customer", label: "客户", actions: [{ key: "create", label: "新增" }, { key: "update", label: "修改" }, { key: "delete", label: "删除" }] },
  { key: "inventory", label: "库存", actions: [{ key: "view", label: "查看" }, { key: "create", label: "新增" }, { key: "update", label: "修改" }, { key: "delete", label: "删除" }] },
  { key: "stocklog", label: "库存流水", actions: [{ key: "create", label: "新增" }, { key: "delete", label: "删除" }] },
  { key: "enum", label: "枚举", actions: [{ key: "create", label: "新增" }, { key: "update", label: "修改" }, { key: "delete", label: "删除" }] },
  { key: "odf", label: "ODF", actions: [{ key: "update", label: "修改" }] },
];
const code = (m: string, a: string) => `${m}:${a}`;

export function UserManagementScreen() {
  const [tab, setTab] = useState<"users" | "roles">("users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<RoleDef[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [u, r, c, rm] = await Promise.all([
        apiCollect<AdminUser>("/users"),
        apiCollect<RoleDef>("/roles"),
        apiCollect<Customer>("/customers", { pageSize: 200 }),
        apiCollect<Room>("/rooms", { pageSize: 200 }),
      ]);
      setUsers(u);
      setRoles(r);
      setCustomers(c);
      setRooms(rm);
    } catch (e: any) {
      Alert.alert("加载失败", e?.message || "操作失败");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <Loading />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={styles.seg}>
        <SegTab label="账号管理" active={tab === "users"} onPress={() => setTab("users")} />
        <SegTab label="角色权限" active={tab === "roles"} onPress={() => setTab("roles")} />
      </View>
      {tab === "users" ? (
        <UsersTab
          users={users}
          roles={roles}
          customers={customers}
          rooms={rooms}
          onChanged={loadAll}
        />
      ) : (
        <RolesTab roles={roles} onChanged={loadAll} />
      )}
    </View>
  );
}

function SegTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.7} style={[styles.segTab, active && styles.segTabActive]} onPress={onPress}>
      <Text style={[styles.segTabText, active && styles.segTabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ───────────────── 账号管理 ─────────────────
function UsersTab({
  users,
  roles,
  customers,
  rooms,
  onChanged,
}: {
  users: AdminUser[];
  roles: RoleDef[];
  customers: Customer[];
  rooms: Room[];
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const blank = () => ({
    id: "",
    username: "",
    displayName: "",
    password: "",
    userGroup: "ops" as "ops" | "customer",
    customerId: "",
    roleId: "",
    isActive: true,
    roomIds: [] as string[],
  });
  const [form, setForm] = useState(blank());

  const openCreate = () => {
    setEditing(null);
    setForm(blank());
    setShowForm(true);
  };
  const openEdit = (u: AdminUser) => {
    setEditing(u);
    setForm({
      id: u.id,
      username: u.username,
      displayName: u.displayName || "",
      password: "",
      userGroup: u.userGroup || "ops",
      customerId: u.customerId || "",
      roleId: u.roleId || "",
      isActive: u.isActive !== false,
      roomIds: u.roomIds || [],
    });
    setShowForm(true);
  };

  const toggleRoom = (id: string) => {
    setForm((f) => ({
      ...f,
      roomIds: f.roomIds.includes(id) ? f.roomIds.filter((r) => r !== id) : [...f.roomIds, id],
    }));
  };

  const submit = async () => {
    if (!form.username.trim()) {
      Alert.alert("请填写用户名");
      return;
    }
    if (!editing && !form.password.trim()) {
      Alert.alert("请填写密码");
      return;
    }
    if (form.userGroup === "customer" && !form.customerId) {
      Alert.alert("客户组必须选择客户");
      return;
    }
    const body: any = {
      username: form.username.trim(),
      displayName: form.displayName.trim() || undefined,
      userGroup: form.userGroup,
      roleId: form.roleId || undefined,
      customerId: form.userGroup === "customer" ? form.customerId : undefined,
      isActive: form.isActive,
      roomIds: form.roomIds,
    };
    if (form.password.trim()) body.password = form.password.trim();
    setSaving(true);
    try {
      if (editing) {
        await apiPatch(`/users/${editing.id}`, body);
      } else {
        await apiPost("/users", body);
      }
      Alert.alert(editing ? "已保存" : "已创建");
      setShowForm(false);
      onChanged();
    } catch (e: any) {
      Alert.alert("提交失败", e?.message || "操作失败");
    } finally {
      setSaving(false);
    }
  };

  const deactivate = (u: AdminUser) => {
    Alert.alert("停用账号", `确认停用「${u.username}」？`, [
      { text: "取消", style: "cancel" },
      {
        text: "停用",
        style: "destructive",
        onPress: async () => {
          try {
            await apiDelete(`/users/${u.id}`);
            Alert.alert("已停用");
            onChanged();
          } catch (e: any) {
            Alert.alert("操作失败", e?.message || "操作失败");
          }
        },
      },
    ]);
  };

  const roleName = (rid?: string | null) => roles.find((r) => r.id === rid)?.name || "—";

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={users}
        keyExtractor={(u) => u.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
        ListEmptyComponent={<EmptyState text="暂无账号" />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <TouchableOpacity activeOpacity={0.8} style={{ flex: 1, minWidth: 0 }} onPress={() => openEdit(item)}>
              <View style={styles.userHead}>
                <Text style={styles.userName}>{item.displayName || item.username}</Text>
                {item.isSuperuser ? <Text style={styles.tagSuper}>超管</Text> : null}
                {item.isActive === false ? <Text style={styles.tagOff}>已停用</Text> : null}
              </View>
              <Text style={styles.userSub}>@{item.username}{item.userGroup ? ` · ${item.userGroup === "customer" ? "客户组" : "运维组"}` : ""}</Text>
              <Text style={styles.userSub}>角色：{roleName(item.roleId)}{item.customerName ? ` · 客户：${item.customerName}` : ""}</Text>
              <Text style={styles.userSub}>可管机房：{item.roomIds?.length || 0} 个</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.7} onPress={() => deactivate(item)}>
              <Text style={[styles.cardActText, { color: theme.danger ?? "#ef4444" }]}>停用</Text>
            </TouchableOpacity>
          </View>
        )}
      />
      <TouchableOpacity activeOpacity={0.85} style={styles.fab} onPress={openCreate}>
        <Text style={styles.fabText}>＋ 新建账号</Text>
      </TouchableOpacity>

      <Sheet visible={showForm} title={editing ? "编辑账号" : "新建账号"} onClose={() => setShowForm(false)} scrollable>
        <View>
          <Field label="用户名 *" />
          <Input placeholder="登录用户名" value={form.username} onChangeText={(v) => setForm({ ...form, username: v })} />
          <Field label="显示名" />
          <Input placeholder="如 张伟" value={form.displayName} onChangeText={(v) => setForm({ ...form, displayName: v })} />
          <Field label={editing ? "密码（留空不修改）" : "密码 *（≥6 位）"} />
          <Input placeholder="登录密码" value={form.password} onChangeText={(v) => setForm({ ...form, password: v })} secure />

          <Field label="用户分组 *" />
          <View style={styles.chipRow}>
            <Chip label="运维组" active={form.userGroup === "ops"} onPress={() => setForm({ ...form, userGroup: "ops", customerId: "" })} />
            <Chip label="客户组" active={form.userGroup === "customer"} onPress={() => setForm({ ...form, userGroup: "customer" })} />
          </View>

          {form.userGroup === "customer" ? (
            <>
              <Field label="归属客户 *" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {customers.map((c) => (
                  <Chip key={c.id} label={c.name} active={form.customerId === c.id} onPress={() => setForm({ ...form, customerId: c.id })} />
                ))}
              </ScrollView>
            </>
          ) : null}

          <Field label="角色" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <Chip label="无" active={!form.roleId} onPress={() => setForm({ ...form, roleId: "" })} />
            {roles.map((r) => (
              <Chip key={r.id} label={r.name} active={form.roleId === r.id} onPress={() => setForm({ ...form, roleId: r.id })} />
            ))}
          </ScrollView>

          <Field label={`可管理机房（${form.roomIds.length}）`} />
          <View style={styles.roomWrap}>
            {rooms.map((r) => (
              <Chip key={r.id} label={r.name || r.code || r.id} active={form.roomIds.includes(r.id)} onPress={() => toggleRoom(r.id)} />
            ))}
          </View>

          <TouchableOpacity activeOpacity={0.7} style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={submit}>
            <Text style={styles.saveBtnText}>{saving ? "提交中…" : editing ? "保存" : "创建"}</Text>
          </TouchableOpacity>
        </View>
      </Sheet>
    </View>
  );
}

// ───────────────── 角色权限 ─────────────────
function RolesTab({ roles, onChanged }: { roles: RoleDef[]; onChanged: () => void }) {
  const [editing, setEditing] = useState<RoleDef | null>(null);
  const [perms, setPerms] = useState<string[]>([]);
  const [showMatrix, setShowMatrix] = useState(false);
  const [saving, setSaving] = useState(false);

  const openMatrix = (r: RoleDef) => {
    setEditing(r);
    setPerms([...r.permissions]);
    setShowMatrix(true);
  };
  const toggle = (c: string) =>
    setPerms((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  const allCodes = PERMISSION_MODULES.flatMap((m) => m.actions.map((a) => code(m.key, a.key)));

  const submit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await apiPatch(`/roles/${editing.id}`, { permissions: perms });
      Alert.alert("已保存权限");
      setShowMatrix(false);
      onChanged();
    } catch (e: any) {
      Alert.alert("保存失败", e?.message || "操作失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={roles}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        ListEmptyComponent={<EmptyState text="暂无角色" />}
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.8} style={styles.card} onPress={() => openMatrix(item)}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.userName}>{item.name}</Text>
              <Text style={styles.userSub}>{item.permissions.length} 项权限</Text>
              <View style={styles.permPreview}>
                {item.permissions.slice(0, 6).map((p) => (
                  <Text key={p} style={styles.permChip}>{p}</Text>
                ))}
                {item.permissions.length > 6 ? <Text style={styles.permChip}>…</Text> : null}
              </View>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        )}
      />

      <Sheet visible={showMatrix} title={editing ? `权限矩阵 · ${editing.name}` : "权限矩阵"} onClose={() => setShowMatrix(false)} scrollable>
        {editing ? (
          <View>
            <View style={styles.matrixTools}>
              <TouchableOpacity activeOpacity={0.7} style={styles.toolBtn} onPress={() => setPerms([...allCodes])}>
                <Text style={styles.toolBtnText}>全选</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.7} style={styles.toolBtn} onPress={() => setPerms([])}>
                <Text style={styles.toolBtnText}>清空</Text>
              </TouchableOpacity>
            </View>
            {PERMISSION_MODULES.map((m) => (
              <View key={m.key} style={styles.matrixMod}>
                <Text style={styles.matrixModTitle}>{m.label}</Text>
                <View style={styles.chipRow}>
                  {m.actions.map((a) => {
                    const c = code(m.key, a.key);
                    return <Chip key={c} label={a.label} active={perms.includes(c)} onPress={() => toggle(c)} />;
                  })}
                </View>
              </View>
            ))}
            <TouchableOpacity activeOpacity={0.7} style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={submit}>
              <Text style={styles.saveBtnText}>{saving ? "保存中…" : "保存权限"}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

function Field({ label }: { label: string }) {
  return <Text style={styles.fLabel}>{label}</Text>;
}

const styles = StyleSheet.create({
  seg: { flexDirection: "row", paddingHorizontal: 16, paddingBottom: 8 },
  segTab: { flex: 1, paddingVertical: 9, alignItems: "center", backgroundColor: theme.surface, borderBottomWidth: 2, borderColor: "transparent" },
  segTabActive: { borderColor: theme.accent },
  segTabText: { fontSize: 13, fontWeight: "600", color: theme.text3 },
  segTabTextActive: { color: theme.accent },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: theme.surface, borderRadius: 12, padding: 12, marginBottom: 8 },
  userHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  userName: { fontSize: 15, fontWeight: "700", color: theme.text1 },
  userSub: { fontSize: 12, color: theme.text3, marginTop: 2 },
  tagSuper: { fontSize: 10, fontWeight: "700", color: "#fff", backgroundColor: theme.accent, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  tagOff: { fontSize: 10, fontWeight: "700", color: theme.danger ?? "#ef4444", backgroundColor: (theme.danger ?? "#ef4444") + "22", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  cardActText: { fontSize: 12, fontWeight: "700", marginLeft: 10 },
  chevron: { fontSize: 18, color: theme.text3, marginLeft: 8 },
  permPreview: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 },
  permChip: { fontSize: 10, color: theme.text2, backgroundColor: theme.track, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  fab: { position: "absolute", right: 16, bottom: 20, backgroundColor: theme.accent, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 999, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  fabText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  fLabel: { fontSize: 13, fontWeight: "700", color: theme.text1, marginTop: 12, marginBottom: 6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  roomWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  saveBtn: { marginTop: 18, alignItems: "center", paddingVertical: 13, borderRadius: 12, backgroundColor: theme.accent },
  saveBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  matrixTools: { flexDirection: "row", gap: 10, marginBottom: 10 },
  toolBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: theme.track },
  toolBtnText: { fontSize: 13, fontWeight: "700", color: theme.accent },
  matrixMod: { marginBottom: 14 },
  matrixModTitle: { fontSize: 13, fontWeight: "700", color: theme.text1, marginBottom: 6 },
});
