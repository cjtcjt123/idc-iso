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
import { useAuth } from "../auth/AuthContext";
import {
  apiCollect,
  apiDelete,
  apiGet,
  apiList,
  apiPatch,
  apiPost,
} from "../api/client";
import type {
  CreateCustomerAuthorizationPayload,
  Customer,
  CustomerAuthorization,
} from "../api/types";
import {
  AUTH_SOURCE_LABELS,
  AUTH_SOURCE_OPTIONS,
  AUTH_TYPES,
} from "../api/types";
import { Chip, EmptyState, Input, Loading, Sheet } from "../components/ui";
import { theme } from "../theme";

const PAGE_SIZE = 20;

const sourceLabel = (s?: string) => AUTH_SOURCE_LABELS[s || ""] || s || "其他";
const truncate = (s: string, n = 42) => (s.length > n ? s.slice(0, n) + "…" : s);

export function CustomerAuthorizationScreen() {
  const { currentRoomId } = useAuth();

  const [items, setItems] = useState<CustomerAuthorization[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // 筛选
  const [filterCustomerId, setFilterCustomerId] = useState("");
  const [filterType, setFilterType] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [keyword, setKeyword] = useState("");

  // 客户下拉（筛选 + 表单共用）
  const [customers, setCustomers] = useState<Customer[]>([]);

  // 详情 / 表单 / 客户选择器
  const [detail, setDetail] = useState<CustomerAuthorization | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customerId: "",
    authDate: "",
    authType: AUTH_TYPES[0],
    source: "email",
    operator: "",
    content: "",
    remark: "",
  });
  const [formCustomerName, setFormCustomerName] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [pickerKeyword, setPickerKeyword] = useState("");

  const loadCustomers = async () => {
    try {
      const list = await apiCollect<Customer>("/customers", {
        pageSize: 200,
        roomId: currentRoomId || undefined,
      });
      setCustomers(list);
    } catch {
      /* 静默 */
    }
  };

  const fetchPage = async (p: number) => {
    if (loadingMore) return;
    if (p > 1) setLoadingMore(true);
    try {
      const res = await apiList<CustomerAuthorization>("/customer-authorizations", {
        page: p,
        pageSize: PAGE_SIZE,
        roomId: currentRoomId || undefined,
        customerId: filterCustomerId || undefined,
        authType: filterType || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        keyword: keyword.trim() || undefined,
      });
      const data = res.data || [];
      setItems(p === 1 ? data : (prev) => prev.concat(data));
      setPage(res.page || p);
      setTotalPages(res.totalPages || 1);
      setLoaded(true);
    } catch {
      setLoaded(true);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const reload = () => {
    setLoading(true);
    fetchPage(1);
  };

  const loadMore = () => {
    if (loadingMore || page >= totalPages) return;
    fetchPage(page + 1);
  };

  useEffect(() => {
    loadCustomers();
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRoomId]);

  const openCreate = () => {
    setEditId("");
    setForm({
      customerId: "",
      authDate: "",
      authType: AUTH_TYPES[0],
      source: "email",
      operator: "",
      content: "",
      remark: "",
    });
    setFormCustomerName("");
    setShowForm(true);
  };

  const openEdit = async (rec: CustomerAuthorization) => {
    try {
      const r = await apiGet<CustomerAuthorization>(`/customer-authorizations/${rec.id}`);
      if (!customers.length) await loadCustomers();
      const picked = customers.find((c) => c.id === r.customerId);
      setEditId(r.id);
      setForm({
        customerId: r.customerId || "",
        authDate: (r.authDate || "").slice(0, 10),
        authType: r.authType || AUTH_TYPES[0],
        source: r.source || "email",
        operator: r.operator || "",
        content: r.content || "",
        remark: r.remark || "",
      });
      setFormCustomerName((r.customer && r.customer.name) || (picked ? picked.name : ""));
      setShowForm(true);
    } catch (e: any) {
      Alert.alert("加载失败", e?.message || "操作失败");
    }
  };

  const onSubmitForm = async () => {
    if (!form.customerId) {
      Alert.alert("请选择客户");
      return;
    }
    if (!form.authDate.trim()) {
      Alert.alert("请填写授权日期");
      return;
    }
    if (!form.content.trim()) {
      Alert.alert("请填写授权内容");
      return;
    }
    const payload: CreateCustomerAuthorizationPayload = {
      customerId: form.customerId,
      authDate: form.authDate.trim(),
      authType: form.authType,
      content: form.content.trim(),
      source: form.source || "email",
      operator: form.operator.trim() || undefined,
      remark: form.remark.trim() || undefined,
    };
    setSaving(true);
    try {
      if (editId) await apiPatch(`/customer-authorizations/${editId}`, payload);
      else await apiPost("/customer-authorizations", payload);
      Alert.alert(editId ? "已保存" : "已创建");
      setShowForm(false);
      reload();
    } catch (e: any) {
      Alert.alert("提交失败", e?.message || "操作失败");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = (rec: CustomerAuthorization) => {
    Alert.alert("删除授权单", "确认删除？删除仅留痕隐藏，不物理销毁。", [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          try {
            await apiDelete(`/customer-authorizations/${rec.id}`);
            Alert.alert("已删除");
            setDetail(null);
            reload();
          } catch (e: any) {
            Alert.alert("删除失败", e?.message || "操作失败");
          }
        },
      },
    ]);
  };

  const pickerList = pickerKeyword.trim()
    ? customers.filter((c) => c.name.toLowerCase().includes(pickerKeyword.trim().toLowerCase()))
    : customers;

  if (loading) return <Loading />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* 筛选条 */}
      <View style={styles.filterBar}>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.search}
            placeholder="搜索授权内容 / 操作人"
            placeholderTextColor={theme.text3}
            value={keyword}
            onChangeText={setKeyword}
            onSubmitEditing={reload}
            returnKeyType="search"
          />
          <TouchableOpacity activeOpacity={0.7} style={styles.searchBtn} onPress={reload}>
            <Text style={styles.searchBtnText}>搜索</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Chip
            label="全部类型"
            active={filterType === ""}
            onPress={() => {
              setFilterType("");
              reload();
            }}
          />
          {AUTH_TYPES.map((t) => (
            <Chip
              key={t}
              label={t}
              active={filterType === t}
              onPress={() => setFilterType(filterType === t ? "" : t)}
            />
          ))}
        </ScrollView>
        <View style={styles.dateRow}>
          <TextInput
            style={styles.dateInput}
            placeholder="起始日 YYYY-MM-DD"
            placeholderTextColor={theme.text3}
            value={fromDate}
            onChangeText={setFromDate}
          />
          <Text style={styles.dateSep}>~</Text>
          <TextInput
            style={styles.dateInput}
            placeholder="截止日 YYYY-MM-DD"
            placeholderTextColor={theme.text3}
            value={toDate}
            onChangeText={setToDate}
          />
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.resetBtn}
            onPress={() => {
              setFromDate("");
              setToDate("");
              setFilterCustomerId("");
              setFilterType("");
              setKeyword("");
              reload();
            }}
          >
            <Text style={styles.resetBtnText}>重置</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 列表 */}
      {!loaded ? null : items.length === 0 ? (
        <EmptyState text="暂无授权单" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.2}
          renderItem={({ item }) => (
            <AuthCard
              item={item}
              onPress={() => setDetail(item)}
              onEdit={() => openEdit(item)}
              onDelete={() => onDelete(item)}
            />
          )}
          ListFooterComponent={
            loadingMore ? <Text style={styles.foot}>加载中…</Text> : page < totalPages ? <Text style={styles.foot}>上拉加载更多</Text> : null
          }
        />
      )}

      {/* 新建按钮 */}
      <TouchableOpacity activeOpacity={0.85} style={styles.fab} onPress={openCreate}>
        <Text style={styles.fabText}>＋ 新建授权单</Text>
      </TouchableOpacity>

      {/* 详情 */}
      <Sheet visible={!!detail} title="授权单详情" onClose={() => setDetail(null)} scrollable>
        {detail ? (
          <View>
            <Row label="客户" value={detail.customer?.name || "—"} />
            <Row label="授权日期" value={detail.authDate ? detail.authDate.slice(0, 10) : "—"} />
            <Row label="操作类型" value={detail.authType} />
            <Row label="来源" value={sourceLabel(detail.source)} />
            <Row label="操作人" value={detail.operator} />
            <View style={styles.blockLabel}>
              <Text style={styles.blockLabelText}>授权内容</Text>
            </View>
            <Text style={styles.blockText}>{detail.content || "—"}</Text>
            {detail.remark ? (
              <>
                <View style={styles.blockLabel}>
                  <Text style={styles.blockLabelText}>备注</Text>
                </View>
                <Text style={styles.blockText}>{detail.remark}</Text>
              </>
            ) : null}
            <View style={styles.detailActions}>
              <TouchableOpacity activeOpacity={0.7} style={styles.editBtn} onPress={() => openEdit(detail)}>
                <Text style={styles.editBtnText}>编辑</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.7} style={styles.delBtn} onPress={() => onDelete(detail)}>
                <Text style={styles.delBtnText}>删除</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </Sheet>

      {/* 新建 / 编辑 */}
      <Sheet visible={showForm} title={editId ? "编辑授权单" : "新建授权单"} onClose={() => setShowForm(false)} scrollable>
        <View>
          <Field label="客户 *" />
          <TouchableOpacity activeOpacity={0.7} style={styles.pickerRow} onPress={() => { setPickerKeyword(""); setShowPicker(true); }}>
            <Text style={[styles.pickerRowText, !formCustomerName && { color: theme.text3 }]}>
              {formCustomerName || "请选择客户"}
            </Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <Field label="授权日期 (YYYY-MM-DD) *" />
          <Input placeholder="如 2026-09-19" value={form.authDate} onChangeText={(v) => setForm({ ...form, authDate: v })} />

          <Field label="操作类型 *" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {AUTH_TYPES.map((t) => (
              <Chip key={t} label={t} active={form.authType === t} onPress={() => setForm({ ...form, authType: t })} />
            ))}
          </ScrollView>

          <Field label="来源" />
          <View style={styles.sourceRow}>
            {AUTH_SOURCE_OPTIONS.map((o) => (
              <Chip key={o.value} label={o.label} active={form.source === o.value} onPress={() => setForm({ ...form, source: o.value })} />
            ))}
          </View>

          <Field label="操作人" />
          <Input placeholder="默认当前账号，可追加" value={form.operator} onChangeText={(v) => setForm({ ...form, operator: v })} />

          <Field label="授权内容 *" />
          <TextInput
            style={styles.textArea}
            placeholder="客户邮件中授权的具体事项"
            placeholderTextColor={theme.text3}
            value={form.content}
            onChangeText={(v) => setForm({ ...form, content: v })}
            multiline
            textAlignVertical="top"
          />

          <Field label="备注" />
          <Input placeholder="邮件编号等留存线索" value={form.remark} onChangeText={(v) => setForm({ ...form, remark: v })} />

          <TouchableOpacity activeOpacity={0.7} style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={onSubmitForm}>
            <Text style={styles.saveBtnText}>{saving ? "提交中…" : editId ? "保存" : "创建"}</Text>
          </TouchableOpacity>
        </View>
      </Sheet>

      {/* 客户选择器 */}
      <Sheet visible={showPicker} title="选择客户" onClose={() => setShowPicker(false)} scrollable>
        <View>
          <Input placeholder="搜索客户名" value={pickerKeyword} onChangeText={setPickerKeyword} />
          <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ paddingTop: 8 }}>
            {pickerList.length === 0 ? (
              <EmptyState text="无匹配客户" />
            ) : (
              pickerList.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  activeOpacity={0.7}
                  style={[styles.pickItem, c.id === form.customerId && styles.pickItemActive]}
                  onPress={() => {
                    setForm({ ...form, customerId: c.id });
                    setFormCustomerName(c.name);
                    setShowPicker(false);
                  }}
                >
                  <Text style={styles.pickItemText}>{c.name}</Text>
                  {c.id === form.customerId ? <Text style={styles.pickCheck}>✓</Text> : null}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </Sheet>
    </View>
  );
}

function AuthCard({
  item,
  onPress,
  onEdit,
  onDelete,
}: {
  item: CustomerAuthorization;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={styles.card}>
      <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.cardHead}>
          <Text style={styles.cardCustomer} numberOfLines={1}>
            {item.customer?.name || "—"}
          </Text>
          <Text style={styles.cardDate}>{item.authDate ? item.authDate.slice(0, 10) : "—"}</Text>
        </View>
        <View style={styles.cardTagRow}>
          <View style={[styles.typeTag, { backgroundColor: theme.accent + "22" }]}>
            <Text style={[styles.typeTagText, { color: theme.accent }]}>{item.authType}</Text>
          </View>
          <Text style={styles.cardSource}>{sourceLabel(item.source)}</Text>
        </View>
        <Text style={styles.cardContent} numberOfLines={2}>
          {truncate(item.content || "—")}
        </Text>
        <Text style={styles.cardOp}>操作人：{item.operator || "—"}</Text>
      </TouchableOpacity>
      <View style={styles.cardActions}>
        <TouchableOpacity activeOpacity={0.7} onPress={onEdit}>
          <Text style={styles.cardActionText}>编辑</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} onPress={onDelete}>
          <Text style={[styles.cardActionText, { color: theme.danger ?? "#ef4444" }]}>删除</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Field({ label }: { label: string }) {
  return <Text style={styles.fLabel}>{label}</Text>;
}
function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value || "—"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  filterBar: { padding: 16, paddingBottom: 8 },
  searchRow: { flexDirection: "row", gap: 8 },
  search: {
    flex: 1,
    backgroundColor: theme.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: theme.text1,
    borderWidth: 1,
    borderColor: theme.border,
  },
  searchBtn: { paddingHorizontal: 14, justifyContent: "center", backgroundColor: theme.accent, borderRadius: 10 },
  searchBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  chipRow: { paddingVertical: 8, gap: 6 },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  dateInput: {
    flex: 1,
    backgroundColor: theme.surface,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: theme.text1,
    borderWidth: 1,
    borderColor: theme.border,
  },
  dateSep: { color: theme.text3 },
  resetBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  resetBtnText: { color: theme.text3, fontSize: 12, fontWeight: "700" },
  foot: { textAlign: "center", color: theme.text3, fontSize: 12, paddingVertical: 12 },
  card: {
    flexDirection: "row",
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    alignItems: "stretch",
  },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardCustomer: { fontSize: 14, fontWeight: "700", color: theme.text1, flex: 1, marginRight: 8 },
  cardDate: { fontSize: 11, color: theme.text3 },
  cardTagRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  typeTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  typeTagText: { fontSize: 11, fontWeight: "700" },
  cardSource: { fontSize: 11, color: theme.text3 },
  cardContent: { fontSize: 12, color: theme.text2, marginTop: 6, lineHeight: 17 },
  cardOp: { fontSize: 11, color: theme.text3, marginTop: 4 },
  cardActions: { justifyContent: "center", gap: 12, paddingLeft: 10 },
  cardActionText: { fontSize: 12, color: theme.accent, fontWeight: "700" },
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
  row: { flexDirection: "row", paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.border },
  rowLabel: { width: 80, fontSize: 13, color: theme.text3 },
  rowValue: { flex: 1, fontSize: 13, color: theme.text1 },
  blockLabel: { marginTop: 12 },
  blockLabelText: { fontSize: 13, fontWeight: "700", color: theme.text1 },
  blockText: { fontSize: 13, color: theme.text2, marginTop: 6, lineHeight: 18 },
  detailActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  editBtn: { flex: 1, alignItems: "center", paddingVertical: 11, borderRadius: 12, backgroundColor: theme.accent },
  editBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  delBtn: { flex: 1, alignItems: "center", paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: theme.danger ?? "#ef4444" },
  delBtnText: { color: theme.danger ?? "#ef4444", fontWeight: "700", fontSize: 13 },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: theme.border,
  },
  pickerRowText: { fontSize: 13, color: theme.text1 },
  chevron: { color: theme.text3, fontSize: 18 },
  sourceRow: { flexDirection: "row", gap: 6, marginTop: 4 },
  fLabel: { fontSize: 13, fontWeight: "700", color: theme.text1, marginTop: 12, marginBottom: 6 },
  saveBtn: { marginTop: 18, alignItems: "center", paddingVertical: 13, borderRadius: 12, backgroundColor: theme.accent },
  saveBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  textArea: {
    backgroundColor: theme.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: theme.text1,
    borderWidth: 1,
    borderColor: theme.border,
    height: 80,
    textAlignVertical: "top",
  },
  pickItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: theme.surface,
    marginBottom: 6,
  },
  pickItemActive: { borderWidth: 1, borderColor: theme.accent },
  pickItemText: { fontSize: 14, color: theme.text1 },
  pickCheck: { color: theme.accent, fontWeight: "700", fontSize: 14 },
});
