import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { apiCollect, apiList, apiPost } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { OdfModule, Rack } from "../api/types";
import {
  Chip,
  Count,
  EmptyState,
  Input,
  ListRow,
  Loading,
  SearchBar,
  Sheet,
} from "../components/ui";
import { theme } from "../theme";

const STATUS_TINT: Record<string, { fg: string; bg: string; text: string }> = {
  used: { fg: "#f79009", bg: "#fef3e2", text: "已用" },
  unused: { fg: "#12b76a", bg: "#e7f7ef", text: "空闭" },
  fault: { fg: "#f04438", bg: "#fdeceb", text: "故障" },
};
type FiberMode = "single-mode" | "multi-mode" | "";
type PortType = "LC" | "SC" | "MPO" | "";
/** 后端枚举：fiberMode 是 single-mode / multi-mode，portType 是 LC / SC / MPO（都不是前端习惯的小写） */

export function OdfScreen({ navigation }: any) {
  const { currentRoomId } = useAuth();
  const [modules, setModules] = useState<OdfModule[]>([]);
  const [racks, setRacks] = useState<Rack[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [fiber, setFiber] = useState<FiberMode>("");
  const [portType, setPortType] = useState<PortType>("");

  // 新建弹层
  const [creating, setCreating] = useState(false);
  const [mName, setMName] = useState("");
  const [mRackId, setMRackId] = useState("");
  const [mPorts, setMPorts] = useState("");
  const [mFiber, setMFiber] = useState<FiberMode>("single-mode");
  const [mPortType, setMPortType] = useState<PortType>("LC");
  // A/B 双端固定语义：A 端起始 U、B 端机柜、B 端起始 U 都是后端必填
  const [mUStart, setMUStart] = useState("1");
  const [mBRackId, setMBRackId] = useState("");
  const [mBUStart, setMBUStart] = useState("1");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      const res = await apiCollect<OdfModule>("/odf/modules");
      setModules(res);
      if (currentRoomId) {
        const r = await apiList<Rack>("/racks", { roomId: currentRoomId, pageSize: 200 });
        setRacks(r.data || []);
      }
    } catch {
      /* 静默 */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return modules.filter((m) => {
      const hit = q ? ((m.name || "") + (m.code || "")).toLowerCase().includes(q) : true;
      if (!hit) return false;
      if (fiber && (m as any).fiberMode && (m as any).fiberMode !== fiber) return false;
      if (portType && (m as any).portType && (m as any).portType !== portType) return false;
      return true;
    });
  }, [modules, keyword, fiber, portType]);

  const stats = useMemo(() => {
    const totalPorts = modules.reduce((s, m) => s + (m.portCount || 0), 0);
    return { total: modules.length, ports: totalPorts };
  }, [modules]);

  const openCreate = () => {
    if (!racks.length) { Alert.alert("提示", "当前机房暂无机柜，无法挂载 ODF 模块"); return; }
    setMName(""); setMRackId(""); setMPorts("24"); setMFiber("single-mode"); setMPortType("LC");
    setMUStart("1"); setMBRackId(""); setMBUStart("1");
    setCreating(true);
  };
  const confirmCreate = async () => {
    if (!mName.trim()) { Alert.alert("请填写模块编码"); return; }
    if (!mRackId) { Alert.alert("请选择 A 端机柜"); return; }
    if (!mBRackId) { Alert.alert("请选择 B 端机柜"); return; }
    const n = Number(mPorts);
    if (!Number.isInteger(n) || n < 1) { Alert.alert("请填写有效端口数（≥1）"); return; }
    const uStart = Number(mUStart);
    const bUStart = Number(mBUStart);
    if (!Number.isInteger(uStart) || uStart < 1) { Alert.alert("请填写 A 端起始 U（≥1）"); return; }
    if (!Number.isInteger(bUStart) || bUStart < 1) { Alert.alert("请填写 B 端起始 U（≥1）"); return; }
    setSaving(true);
    try {
      // OdfModule 落库只有 code 没有 name，名称就写进 code
      await apiPost("/odf/modules", {
        code: mName.trim(),
        roomId: currentRoomId,
        rackId: mRackId,
        uStart,
        bRackId: mBRackId,
        bUStart,
        portCount: n,
        fiberMode: mFiber || "single-mode",
        portType: mPortType || "LC",
      });
      // 端口由后端在建模块时自动初始化（unused），前端不要再逐个 POST，否则会重复建一份
      Alert.alert("已创建", `${mName.trim()}（${n} 口）`);
      setCreating(false);
      load();
    } catch (e: any) {
      Alert.alert("创建失败", e?.message || "操作失败");
    } finally { setSaving(false); }
  };

  if (loading) return <Loading />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={styles.head}>
        <View>
          <Text style={styles.headTitle}>光纤配线架</Text>
          <Text style={styles.headSub}>ODF 模块管理 / 全机房跳线总览</Text>
        </View>
        {Platform.OS === "web" ? (
          <TouchableOpacity onPress={() => Alert.alert("提示", "全机房跳线总览请在 web 后台查看")}>
            <Text style={styles.headLink}>↗ 总览</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <SearchBar value={keyword} onChangeText={setKeyword} placeholder="搜索 ODF 模块名 / 编码" />

      <View style={styles.statsRow}>
        <Stat label="模块数" value={stats.total} color={theme.text1} />
        <Stat label="总端口" value={stats.ports} color={theme.accent} />
      </View>

      <View style={styles.chipRow}>
        <Chip label="全部光纤" active={fiber === ""} onPress={() => setFiber("")} />
        <Chip label="单模" active={fiber === "single-mode"} onPress={() => setFiber(fiber === "single-mode" ? "" : "single-mode")} />
        <Chip label="多模" active={fiber === "multi-mode"} onPress={() => setFiber(fiber === "multi-mode" ? "" : "multi-mode")} />
      </View>
      <View style={styles.chipRow}>
        <Chip label="全部接口" active={portType === ""} onPress={() => setPortType("")} />
        <Chip label="LC" active={portType === "LC"} onPress={() => setPortType(portType === "LC" ? "" : "LC")} />
        <Chip label="SC" active={portType === "SC"} onPress={() => setPortType(portType === "SC" ? "" : "SC")} />
        <Chip label="MPO" active={portType === "MPO"} onPress={() => setPortType(portType === "MPO" ? "" : "MPO")} />
      </View>

      <View style={styles.toolbar}>
        <Count total={filtered.length} label="个模块" />
        <View style={{ flex: 1 }} />
        <ToolBtn label="＋ 新建" tone="primary" onPress={openCreate} />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => (
          <ModuleCard item={item} onPress={() => navigation.navigate("OdfModuleDetail", { moduleId: item.id, moduleName: item.name })} />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListEmptyComponent={<EmptyState text={keyword ? "无匹配 ODF 模块" : "暂无 ODF 模块"} />}
      />

      {/* 新建模块弹层 */}
      <Sheet visible={creating} title="新建 ODF 模块" onClose={() => setCreating(false)} scrollable>
        <View>
          <Text style={styles.fLabel}>模块编码 *</Text>
          <Input placeholder="如 ODF-A01" value={mName} onChangeText={setMName} />
          <Text style={styles.fLabel}>A 端机柜 *</Text>
          <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled>
            {racks.map((r) => (
              <ListRow key={r.id} title={r.code} subtitle={r.uHeight ? `${r.uHeight}U` : undefined}
                right={mRackId === r.id ? <Text style={{ color: theme.accent, fontWeight: "700" }}>已选</Text> : null}
                onPress={() => setMRackId(r.id)} />
            ))}
          </ScrollView>
          <Text style={styles.fLabel}>A 端起始 U *</Text>
          <Input placeholder="如 20" value={mUStart} onChangeText={setMUStart} keyboardType="numeric" />
          <Text style={styles.fLabel}>B 端机柜 *</Text>
          <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled>
            {racks.map((r) => (
              <ListRow key={r.id} title={r.code} subtitle={r.uHeight ? `${r.uHeight}U` : undefined}
                right={mBRackId === r.id ? <Text style={{ color: theme.accent, fontWeight: "700" }}>已选</Text> : null}
                onPress={() => setMBRackId(r.id)} />
            ))}
          </ScrollView>
          <Text style={styles.fLabel}>B 端起始 U *</Text>
          <Input placeholder="如 20" value={mBUStart} onChangeText={setMBUStart} keyboardType="numeric" />
          <Text style={styles.fLabel}>端口数</Text>
          <Input placeholder="如 24" value={mPorts} onChangeText={setMPorts} keyboardType="numeric" />
          <Text style={styles.fLabel}>光纤模式</Text>
          <View style={styles.chipRow}>
            <Chip label="单模" active={mFiber === "single-mode"} onPress={() => setMFiber("single-mode")} />
            <Chip label="多模" active={mFiber === "multi-mode"} onPress={() => setMFiber("multi-mode")} />
          </View>
          <Text style={styles.fLabel}>接口类型</Text>
          <View style={styles.chipRow}>
            <Chip label="LC" active={mPortType === "LC"} onPress={() => setMPortType("LC")} />
            <Chip label="SC" active={mPortType === "SC"} onPress={() => setMPortType("SC")} />
            <Chip label="MPO" active={mPortType === "MPO"} onPress={() => setMPortType("MPO")} />
          </View>
          <ToolBtn label={saving ? "创建中…" : "确认创建"} tone="primary" onPress={confirmCreate} />
        </View>
      </Sheet>
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return <View style={styles.statBox}><Text style={[styles.statVal, { color }]}>{value}</Text><Text style={styles.statLb}>{label}</Text></View>;
}
function ToolBtn({ label, onPress, tone }: { label: string; onPress: () => void; tone?: "primary" | "default" }) {
  const bg = tone === "primary" ? theme.accent : theme.surfaceAlt;
  const fg = tone === "primary" ? "#fff" : theme.text1;
  return <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={[styles.toolBtn, { backgroundColor: bg }]}><Text style={[styles.toolBtnText, { color: fg }]}>{label}</Text></TouchableOpacity>;
}
function ModuleCard({ item, onPress }: { item: OdfModule; onPress: () => void }) {
  const customerName = (item as any).customerName as string | undefined;
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.odfCard}>
      <View style={styles.odfBar} />
      <View style={styles.odfBody}>
        <View style={styles.odfLine1}>
          <Text style={styles.odfName} numberOfLines={1}>{item.name || item.code || "ODF 模块"}</Text>
          <Text style={styles.odfPorts}>{item.portCount || 0} 口</Text>
        </View>
        <View style={styles.odfLine2}>
          <Text style={styles.odfSub} numberOfLines={1}>{customerName ? `客户：${customerName}` : "公共模块"}</Text>
          <Text style={styles.odfArrow}>›</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  headTitle: { fontSize: 18, fontWeight: "700", color: theme.text1 },
  headSub: { fontSize: 11, color: theme.text3, marginTop: 2 },
  headLink: { fontSize: 12, color: theme.accent, fontWeight: "700", padding: 4 },
  statsRow: { flexDirection: "row", paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  statBox: { flex: 1, backgroundColor: theme.surface, borderRadius: 12, paddingVertical: 10, alignItems: "center", shadowColor: "#101828", shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  statVal: { fontSize: 18, fontWeight: "800" },
  statLb: { fontSize: 11, color: theme.text3, marginTop: 2 },
  chipRow: { flexDirection: "row", paddingHorizontal: 16, paddingBottom: 6, flexWrap: "wrap" },
  toolbar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8 },
  toolBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.rPill, backgroundColor: theme.surfaceAlt, marginLeft: 6 },
  toolBtnText: { fontSize: 12, color: theme.text1, fontWeight: "600" },
  odfCard: { flexDirection: "row", backgroundColor: theme.surface, borderRadius: 12, marginHorizontal: 16, marginVertical: 5, overflow: "hidden", shadowColor: "#101828", shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  odfBar: { width: 4, backgroundColor: theme.grad.odf[1] },
  odfBody: { flex: 1, paddingHorizontal: 12, paddingVertical: 12, minWidth: 0 },
  odfLine1: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
  odfName: { fontSize: 14, fontWeight: "700", color: theme.text1, flex: 1, minWidth: 0 },
  odfPorts: { fontSize: 12, color: theme.accent, fontWeight: "700" },
  odfLine2: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6, gap: 6 },
  odfSub: { fontSize: 11, color: theme.text2, flex: 1, minWidth: 0 },
  odfArrow: { fontSize: 18, color: theme.text3 },
  fLabel: { fontSize: 13, fontWeight: "700", color: theme.text1, marginTop: 12, marginBottom: 6 },
});
