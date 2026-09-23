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
import { apiCollect, apiDelete, apiList, apiPatch, apiPost } from "../api/client";
import { useCan } from "../auth/permission";
import type { InventoryItem, ItemCategory } from "../api/types";
import { Badge, Button, EmptyState, Input, Loading, Sheet } from "../components/ui";
import { theme } from "../theme";

type Node = { id: string; name: string; depth: number; hasChildren: boolean; expanded: boolean; selected: boolean; count: number };
type NameEditor = { mode: "root" | "child" | "rename"; parentId?: string; id?: string; cur?: string };

function flatten(tree: ItemCategory[], expanded: Record<string, boolean>, selectedId: string, depth = 0, acc: Node[] = []): Node[] {
  tree.forEach((c) => {
    const kids = c.children || [];
    acc.push({
      id: c.id,
      name: c.name,
      depth,
      hasChildren: kids.length > 0,
      expanded: !!expanded[c.id],
      selected: c.id === selectedId,
      count: (c._count?.items || 0) + (c._count?.children || 0),
    });
    if (kids.length && expanded[c.id]) flatten(kids, expanded, selectedId, depth + 1, acc);
  });
  return acc;
}

export function CategoriesScreen({ navigation }: any) {
  const can = useCan();
  const canEdit = can("inventory", "create") || can("inventory", "update") || can("inventory", "delete");

  const [tree, setTree] = useState<ItemCategory[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedCatId, setSelectedCatId] = useState("");
  const [selectedCatName, setSelectedCatName] = useState("");
  const [loading, setLoading] = useState(true);

  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [prodPage, setProdPage] = useState(1);
  const [prodTotal, setProdTotal] = useState(0);
  const [prodTotalPages, setProdTotalPages] = useState(1);
  const [prodKeyword, setProdKeyword] = useState("");
  const [prodLoading, setProdLoading] = useState(false);

  const [nameEditor, setNameEditor] = useState<NameEditor | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadTree() {
    try {
      const list = await apiCollect<ItemCategory>("/inventory/categories");
      setExpanded((prev) => {
        const next = { ...prev };
        if (Object.keys(prev).length === 0) list.forEach((t) => { if (!t.parentId) next[t.id] = true; });
        return next;
      });
      setTree(list);
    } catch (e) {
      /* 全局处理 */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTree();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(id: string) {
    setExpanded((e) => ({ ...e, [id]: !e[id] }));
  }

  function select(id: string, name: string) {
    if (selectedCatId === id) {
      setSelectedCatId("");
      setSelectedCatName("");
      setProducts([]);
    } else {
      setSelectedCatId(id);
      setSelectedCatName(name);
      loadProducts(id, true);
    }
  }

  async function loadProducts(catId: string, reset: boolean) {
    if (prodLoading) return;
    const page = reset ? 1 : prodPage + 1;
    setProdLoading(true);
    try {
      const res = await apiList<InventoryItem>("/inventory/items", {
        categoryId: catId,
        q: prodKeyword.trim() || undefined,
        page,
        pageSize: 30,
        sort: "name:asc",
      });
      const data = res.data || [];
      setProducts(reset ? data : products.concat(data));
      setProdPage(res.page);
      setProdTotal(res.total);
      setProdTotalPages(res.totalPages);
    } catch (e) {
      /* 全局处理 */
    } finally {
      setProdLoading(false);
    }
  }

  function openAddRoot() {
    if (!can("inventory", "create")) return;
    setNameEditor({ mode: "root" });
    setNameInput("");
  }
  function openAddChild(parentId: string) {
    if (!can("inventory", "create")) return;
    setNameEditor({ mode: "child", parentId });
    setNameInput("");
  }
  function openRename(id: string, cur: string) {
    if (!can("inventory", "update")) return;
    setNameEditor({ mode: "rename", id, cur });
    setNameInput(cur);
  }
  function remove(id: string, name: string) {
    if (!can("inventory", "delete")) return;
    Alert.alert("删除分类", `确认删除「${name}」？子分类将一并移除（物料会变为未分类）。`, [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          try {
            await apiDelete(`/inventory/categories/${id}`);
            if (selectedCatId === id) { setSelectedCatId(""); setSelectedCatName(""); setProducts([]); }
            loadTree();
          } catch (e) {
            /* 全局处理 */
          }
        },
      },
    ]);
  }

  async function saveName() {
    if (!nameEditor) return;
    const name = nameInput.trim();
    if (!name) return;
    if (saving) return;
    setSaving(true);
    try {
      if (nameEditor.mode === "root") await apiPost("/inventory/categories", { name });
      else if (nameEditor.mode === "child") await apiPost("/inventory/categories", { name, parentId: nameEditor.parentId });
      else if (nameEditor.mode === "rename" && nameEditor.id) await apiPatch(`/inventory/categories/${nameEditor.id}`, { name });
      setNameEditor(null);
      loadTree();
    } catch (e) {
      /* 全局处理 */
    } finally {
      setSaving(false);
    }
  }

  const nodes = flatten(tree, expanded, selectedCatId);

  return (
    <View style={s.wrap}>
      <View style={s.bar}>
        <Text style={s.barTitle}>分类 / 物料</Text>
        {can("inventory", "create") ? (
          <TouchableOpacity style={s.addBtn} onPress={openAddRoot}>
            <Text style={s.addBtnText}>＋ 分类</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <Loading />
      ) : (
        <FlatList
          data={nodes}
          keyExtractor={(n) => n.id}
          ListHeaderComponent={selectedCatId ? <ProductHeader name={selectedCatName} total={prodTotal} canAdd={can("inventory", "create")} onAdd={() => navigation.navigate("ProductEdit", { categoryId: selectedCatId, categoryName: selectedCatName })} onClose={() => { setSelectedCatId(""); setSelectedCatName(""); setProducts([]); }} /> : null}
          ListFooterComponent={selectedCatId ? <ProductList products={products} loading={prodLoading} hasMore={prodPage < prodTotalPages} onLoadMore={() => loadProducts(selectedCatId, false)} onTap={(p) => navigation.navigate("ProductEdit", { id: p.id })} /> : null}
          refreshControl={<RefreshControl refreshing={false} onRefresh={loadTree} />}
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={({ item: n }) => (
            <View style={[s.catRow, n.selected && s.catRowSel]}>
              <TouchableOpacity style={{ flex: 1, flexDirection: "row", alignItems: "center" }} onPress={() => toggle(n.id)}>
                <Text style={{ width: n.depth * 16 }} />
                {n.hasChildren ? (
                  <Text style={s.toggle}>{n.expanded ? "▾" : "▸"}</Text>
                ) : (
                  <Text style={s.toggle}>•</Text>
                )}
                <TouchableOpacity style={{ flex: 1 }} onPress={() => select(n.id, n.name)}>
                  <Text style={[s.catName, n.selected && s.catNameSel]}>{n.name}</Text>
                </TouchableOpacity>
                {n.count ? <Badge label={`${n.count}`} /> : null}
              </TouchableOpacity>
              {canEdit ? (
                <View style={s.catActs}>
                  {can("inventory", "create") ? (
                    <TouchableOpacity onPress={() => openAddChild(n.id)} style={s.catAct}>
                      <Text style={s.catActText}>＋子</Text>
                    </TouchableOpacity>
                  ) : null}
                  {can("inventory", "update") ? (
                    <TouchableOpacity onPress={() => openRename(n.id, n.name)} style={s.catAct}>
                      <Text style={s.catActText}>改</Text>
                    </TouchableOpacity>
                  ) : null}
                  {can("inventory", "delete") ? (
                    <TouchableOpacity onPress={() => remove(n.id, n.name)} style={s.catAct}>
                      <Text style={[s.catActText, s.catActDanger]}>删</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}
            </View>
          )}
        />
      )}

      <Sheet visible={!!nameEditor} title={nameEditor?.mode === "rename" ? "重命名分类" : nameEditor?.mode === "child" ? "新增子分类" : "新增根分类"} onClose={() => setNameEditor(null)}>
        <Text style={s.label}>名称</Text>
        <Input value={nameInput} onChangeText={setNameInput} placeholder="如：服务器配件" />
        <Button label={saving ? "保存中…" : "保存"} loading={saving} disabled={!nameInput.trim()} onPress={saveName} />
      </Sheet>
    </View>
  );
}

function ProductHeader({ name, total, canAdd, onAdd, onClose }: { name: string; total: number; canAdd: boolean; onAdd: () => void; onClose: () => void }) {
  return (
    <View style={s.prodHead}>
      <TouchableOpacity onPress={onClose} style={s.prodBack}>
        <Text style={s.prodBackText}>‹ 全部分类</Text>
      </TouchableOpacity>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={s.prodHeadTitle}>{name}（{total}）</Text>
        {canAdd ? (
          <TouchableOpacity style={s.addBtn} onPress={onAdd}>
            <Text style={s.addBtnText}>＋ 物料</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

function ProductList({ products, loading, hasMore, onLoadMore, onTap }: { products: InventoryItem[]; loading: boolean; hasMore: boolean; onLoadMore: () => void; onTap: (p: InventoryItem) => void }) {
  if (products.length === 0 && !loading) return <EmptyState text="该分类下暂无物料" />;
  return (
    <View>
      {products.map((p) => (
        <TouchableOpacity key={p.id} style={s.prodCard} onPress={() => onTap(p)}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.prodName} numberOfLines={1}>{p.name}</Text>
            <Text style={s.prodSub} numberOfLines={1}>
              {[p.manufacturer, p.model].filter(Boolean).join(" ") || "未填厂商/型号"}
            </Text>
          </View>
          <Text style={s.chev}>›</Text>
        </TouchableOpacity>
      ))}
      {hasMore ? (
        <TouchableOpacity style={s.moreBtn} onPress={onLoadMore} disabled={loading}>
          <Text style={s.moreText}>{loading ? "加载中…" : "加载更多"}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.bg },
  bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  barTitle: { fontSize: 22, fontWeight: "700", color: theme.text1 },
  addBtn: { backgroundColor: theme.accentSoft, paddingHorizontal: 14, paddingVertical: 7, borderRadius: theme.rPill },
  addBtnText: { color: theme.accent, fontWeight: "700", fontSize: 14 },
  catRow: { flexDirection: "row", alignItems: "center", backgroundColor: theme.surface, marginHorizontal: 16, marginVertical: 4, borderRadius: 12, paddingVertical: 10, paddingRight: 8, paddingLeft: 12 },
  catRowSel: { borderWidth: 1, borderColor: theme.accent },
  toggle: { fontSize: 14, color: theme.text3, width: 18, textAlign: "center" },
  catName: { fontSize: 15, color: theme.text1, fontWeight: "600" },
  catNameSel: { color: theme.accent },
  catActs: { flexDirection: "row", alignItems: "center" },
  catAct: { paddingHorizontal: 8, paddingVertical: 6 },
  catActText: { color: theme.accent, fontWeight: "600", fontSize: 13 },
  catActDanger: { color: theme.danger },
  label: { fontSize: 13, color: theme.text2, marginTop: 14, marginBottom: 6 },
  prodHead: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 4 },
  prodBack: { marginBottom: 6 },
  prodBackText: { color: theme.text3, fontSize: 13 },
  prodHeadTitle: { fontSize: 17, fontWeight: "700", color: theme.text1, flex: 1 },
  prodCard: { flexDirection: "row", alignItems: "center", backgroundColor: theme.surface, marginHorizontal: 16, marginVertical: 4, borderRadius: 12, padding: 14 },
  prodName: { fontSize: 15, fontWeight: "600", color: theme.text1 },
  prodSub: { fontSize: 12, color: theme.text3, marginTop: 2 },
  chev: { fontSize: 18, color: theme.text3, marginLeft: 8 },
  moreBtn: { alignItems: "center", paddingVertical: 14 },
  moreText: { color: theme.accent, fontWeight: "600", fontSize: 14 },
});
