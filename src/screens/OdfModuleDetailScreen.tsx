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
import { apiCollect, apiDelete, apiGet, apiPost } from "../api/client";
import type { OdfLink, OdfPort, OdfPortHistory, OdfPortTrace } from "../api/types";
import { Chip, EmptyState, Input, Loading, Sheet } from "../components/ui";
import { theme } from "../theme";

const PORT_STATUS: { value: string; label: string; color: string }[] = [
  { value: "unused", label: "空闲", color: "#94a3b8" },
  { value: "used", label: "已占用", color: "#22c55e" },
  { value: "fault", label: "故障", color: "#ef4444" },
  { value: "retired", label: "退役", color: "#f59e0b" },
  { value: "planned", label: "规划", color: "#3b82f6" },
];
const colorOf = (s?: string) => PORT_STATUS.find((x) => x.value === s)?.color || "#94a3b8";
const labelOf = (s?: string) => PORT_STATUS.find((x) => x.value === s)?.label || s || "未知";

const TRACE_KIND: Record<string, string> = {
  "od-f-local": "本端母头",
  "odf-fixed": "固定端",
  device: "设备",
  external: "出局",
  fault: "故障",
};

export function OdfModuleDetailScreen({ route }: any) {
  const { moduleId, moduleName } = route.params;
  const [ports, setPorts] = useState<OdfPort[]>([]);
  const [links, setLinks] = useState<OdfLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"ports" | "links">("ports");
  const [filter, setFilter] = useState("");

  const [selected, setSelected] = useState<OdfPort | null>(null);
  const [panel, setPanel] = useState<"none" | "detail" | "trace" | "history">("none");
  const [trace, setTrace] = useState<OdfPortTrace | null>(null);
  const [histories, setHistories] = useState<OdfPortHistory[]>([]);

  const [creating, setCreating] = useState(false);
  const [cFromPort, setCFromPort] = useState("");
  const [cLinkType, setCLinkType] = useState<"" | "odf" | "device" | "external">("");
  const [cToOdfId, setCToOdfId] = useState("");
  const [cToPort, setCToPort] = useState("");
  const [cToDeviceSn, setCToDeviceSn] = useState("");
  const [cExternal, setCExternal] = useState("");
  const [cLabel, setCLabel] = useState("");
  const [cNote, setCNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [p, l] = await Promise.all([
        apiCollect<OdfPort>(`/odf/modules/${moduleId}/ports`),
        apiCollect<OdfLink>(`/odf/links?odfId=${moduleId}`),
      ]);
      setPorts(p);
      setLinks(l);
    } catch {
      /* 静默 */
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId]);

  const filteredPorts = filter ? ports.filter((p) => p.status === filter) : ports;
  const relatedLinks = selected
    ? links.filter(
        (l) =>
          (l.fromOdfId === moduleId && l.fromPort === selected.portNo) ||
          (l.toOdfId === moduleId && l.toPort === selected.portNo)
      )
    : [];

  const openDetail = (p: OdfPort) => {
    setSelected(p);
    setPanel("detail");
    setTrace(null);
    setHistories([]);
  };
  const doTrace = async () => {
    if (!selected) return;
    try {
      const t = await apiGet<OdfPortTrace>(`/odf/ports/${selected.id}/trace`);
      setTrace(t);
      setPanel("trace");
    } catch (e: any) {
      Alert.alert("追踪失败", e?.message || "操作失败");
    }
  };
  const doHistory = async () => {
    if (!selected) return;
    try {
      const h = await apiGet<OdfPortHistory[]>(`/odf/ports/${selected.id}/histories`);
      setHistories(h);
      setPanel("history");
    } catch (e: any) {
      Alert.alert("加载失败", e?.message || "操作失败");
    }
  };
  const deleteLink = (l: OdfLink) => {
    Alert.alert("删除跳线", "确认删除该跳线连接？对应端口将置为空闲。", [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          try {
            await apiDelete(`/odf/links/${l.id}`);
            Alert.alert("已删除");
            load();
          } catch (e: any) {
            Alert.alert("删除失败", e?.message || "操作失败");
          }
        },
      },
    ]);
  };

  const resetCreate = () => {
    setCFromPort("");
    setCLinkType("");
    setCToOdfId("");
    setCToPort("");
    setCToDeviceSn("");
    setCExternal("");
    setCLabel("");
    setCNote("");
  };
  const openCreate = () => {
    resetCreate();
    setCreating(true);
  };
  const confirmCreate = async () => {
    const fromPort = Number(cFromPort);
    if (!Number.isInteger(fromPort) || fromPort < 1) {
      Alert.alert("请填写起点端口号（≥1）");
      return;
    }
    const body: any = { fromOdfId: moduleId, fromPort };
    if (cLinkType === "odf") {
      const toPort = Number(cToPort);
      if (!cToOdfId.trim() || !Number.isInteger(toPort) || toPort < 1) {
        Alert.alert("请填写对端 ODF 模块 ID 与端口号");
        return;
      }
      body.toOdfId = cToOdfId.trim();
      body.toPort = toPort;
    } else if (cLinkType === "device") {
      if (!cToDeviceSn.trim()) {
        Alert.alert("请填写对端设备 SN");
        return;
      }
      body.toDeviceSn = cToDeviceSn.trim();
    } else if (cLinkType === "external") {
      if (!cExternal.trim()) {
        Alert.alert("请填写出局信息（运营商/电路/局点）");
        return;
      }
      body.externalInfo = cExternal.trim();
    } else {
      Alert.alert("请选择跳线类型");
      return;
    }
    if (cLabel.trim()) body.label = cLabel.trim();
    if (cNote.trim()) body.note = cNote.trim();
    setSaving(true);
    try {
      await apiPost("/odf/links", body);
      Alert.alert("已添加跳线");
      setCreating(false);
      load();
    } catch (e: any) {
      Alert.alert("创建失败", e?.message || "操作失败");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={styles.head}>
        <Text style={styles.headTitle}>{moduleName || "ODF 模块"}</Text>
        <Text style={styles.headSub}>
          {ports.length} 端口 · {links.length} 条跳线
        </Text>
      </View>

      <View style={styles.seg}>
        <SegTab label="端口矩阵" active={tab === "ports"} onPress={() => setTab("ports")} />
        <SegTab label="跳线管理" active={tab === "links"} onPress={() => setTab("links")} />
      </View>

      {tab === "ports" ? (
        <>
          <View style={styles.chipRow}>
            <Chip label="全部" active={filter === ""} onPress={() => setFilter("")} />
            {PORT_STATUS.map((s) => (
              <Chip
                key={s.value}
                label={s.label}
                active={filter === s.value}
                onPress={() => setFilter(filter === s.value ? "" : s.value)}
              />
            ))}
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, flexDirection: "row", flexWrap: "wrap" }}>
            {filteredPorts.map((p) => (
              <PortCell key={p.id} port={p} onPress={() => openDetail(p)} />
            ))}
          </ScrollView>
        </>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={styles.toolbar}>
            <Text style={styles.toolbarTitle}>本模块跳线</Text>
            <TouchableOpacity activeOpacity={0.7} style={styles.addBtn} onPress={openCreate}>
              <Text style={styles.addBtnText}>＋ 新增跳线</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={links}
            keyExtractor={(l) => l.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
            renderItem={({ item }) => (
              <LinkCard item={item} moduleId={moduleId} onDelete={() => deleteLink(item)} />
            )}
            ListEmptyComponent={<EmptyState text="暂无跳线" />}
          />
        </View>
      )}

      {/* 端口详情面板 */}
      <Sheet visible={panel !== "none"} title={selected ? `端口 ${selected.portNo ?? "?"}` : ""} onClose={() => setPanel("none")} scrollable>
        {panel === "detail" && selected && (
          <DetailView port={selected} relatedLinks={relatedLinks} onTrace={doTrace} onHistory={doHistory} />
        )}
        {panel === "trace" && (
          <View>
            <TouchableOpacity style={styles.backBtn} onPress={() => setPanel("detail")}>
              <Text style={styles.backBtnText}>← 返回</Text>
            </TouchableOpacity>
            <TraceView trace={trace} />
          </View>
        )}
        {panel === "history" && (
          <View>
            <TouchableOpacity style={styles.backBtn} onPress={() => setPanel("detail")}>
              <Text style={styles.backBtnText}>← 返回</Text>
            </TouchableOpacity>
            <HistoryView histories={histories} />
          </View>
        )}
      </Sheet>

      {/* 新增跳线 */}
      <Sheet visible={creating} title="新增跳线" onClose={() => setCreating(false)} scrollable>
        <View>
          <Field label="起点端口号 *" />
          <Input placeholder="如 1" value={cFromPort} onChangeText={setCFromPort} keyboardType="numeric" />
          <Field label="跳线类型 *" />
          <View style={styles.chipRow}>
            <Chip label="跳接 ODF" active={cLinkType === "odf"} onPress={() => setCLinkType(cLinkType === "odf" ? "" : "odf")} />
            <Chip label="接设备" active={cLinkType === "device"} onPress={() => setCLinkType(cLinkType === "device" ? "" : "device")} />
            <Chip label="出局" active={cLinkType === "external"} onPress={() => setCLinkType(cLinkType === "external" ? "" : "external")} />
          </View>
          {cLinkType === "odf" && (
            <>
              <Field label="对端 ODF 模块 ID *" />
              <Input placeholder="模块 ID" value={cToOdfId} onChangeText={setCToOdfId} />
              <Field label="对端端口号 *" />
              <Input placeholder="如 1" value={cToPort} onChangeText={setCToPort} keyboardType="numeric" />
            </>
          )}
          {cLinkType === "device" && (
            <>
              <Field label="对端设备 SN *" />
              <Input placeholder="设备 SN" value={cToDeviceSn} onChangeText={setCToDeviceSn} />
            </>
          )}
          {cLinkType === "external" && (
            <>
              <Field label="出局信息 *" />
              <Input placeholder="运营商/电路/局点" value={cExternal} onChangeText={setCExternal} />
            </>
          )}
          <Field label="用途 / 名称" />
          <Input placeholder="如 核心-接入互联" value={cLabel} onChangeText={setCLabel} />
          <Field label="备注" />
          <Input placeholder="备注" value={cNote} onChangeText={setCNote} />
          <TouchableOpacity activeOpacity={0.7} style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={confirmCreate}>
            <Text style={styles.saveBtnText}>{saving ? "创建中…" : "确认创建"}</Text>
          </TouchableOpacity>
        </View>
      </Sheet>
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

function PortCell({ port, onPress }: { port: OdfPort; onPress: () => void }) {
  const color = colorOf(port.status);
  const label = port.portNo != null ? String(port.portNo) : "?";
  return (
    <TouchableOpacity style={[styles.cell, { backgroundColor: color + "22", borderColor: color }]} activeOpacity={0.8} onPress={onPress}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.cellNo, { color }]}>{label}</Text>
      {port.linkType ? <Text style={styles.cellSub} numberOfLines={1}>{port.linkType}</Text> : null}
    </TouchableOpacity>
  );
}

function LinkCard({ item, moduleId, onDelete }: { item: OdfLink; moduleId: string; onDelete: () => void }) {
  const isFrom = item.fromOdfId === moduleId;
  const peer =
    item.linkType === "external"
      ? `出局 ${item.externalInfo || ""}`
      : item.linkType === "device"
      ? `设备 ${item.toDeviceSn || ""}`
      : `ODF ${item.toOdfId || ""}:${item.toPort ?? ""}`;
  const mePort = isFrom ? item.fromPort : item.toPort;
  return (
    <View style={styles.linkCard}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.linkTitle} numberOfLines={1}>
          本端 P{mePort ?? "?"} → {peer}
        </Text>
        {item.label ? <Text style={styles.linkSub}>{item.label}</Text> : null}
        <Text style={styles.linkSub}>
          类型：{item.linkType || "—"}
          {item.cableType ? ` · ${item.cableType}` : ""}
        </Text>
      </View>
      <TouchableOpacity activeOpacity={0.7} onPress={onDelete}>
        <Text style={styles.delTxt}>删除</Text>
      </TouchableOpacity>
    </View>
  );
}

function DetailView({
  port,
  relatedLinks,
  onTrace,
  onHistory,
}: {
  port: OdfPort;
  relatedLinks: OdfLink[];
  onTrace: () => void;
  onHistory: () => void;
}) {
  const color = colorOf(port.status);
  return (
    <View>
      <View style={[styles.badge, { backgroundColor: color + "22" }]}>
        <Text style={[styles.badgeText, { color }]}>{labelOf(port.status)}</Text>
      </View>
      <Row label="端口名称" value={port.portName} />
      <Row label="对端类型" value={port.linkType} />
      <Row label="对端设备" value={port.deviceId} />
      <Row label="对端端口" value={port.linkedOdfId ? `${port.linkedOdfId}:${port.linkedPortNo ?? ""}` : port.remotePortId} />
      <Row label="使用客户" value={port.customerName} />
      <Row label="备注" value={port.note} />
      <View style={styles.btnRow}>
        <ActionBtn label="光路追踪" onPress={onTrace} />
        <ActionBtn label="操作历史" onPress={onHistory} />
      </View>
      {relatedLinks.length > 0 && (
        <View style={{ marginTop: 12 }}>
          <Text style={styles.sectionTitle}>关联跳线</Text>
          {relatedLinks.map((l) => (
            <View key={l.id} style={styles.miniLink}>
              <Text style={styles.miniLinkText}>
                {l.linkType === "external"
                  ? "出局"
                  : l.linkType === "device"
                  ? `设备 ${l.toDeviceSn || ""}`
                  : `ODF ${l.toOdfId || ""}:${l.toPort ?? ""}`}
                {l.label ? ` · ${l.label}` : ""}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function TraceView({ trace }: { trace: OdfPortTrace | null }) {
  if (!trace) return <EmptyState text="无光路数据" />;
  const nodes = trace.nodes || [];
  return (
    <View>
      {trace.route ? <Text style={styles.routeText}>{trace.route}</Text> : null}
      {nodes.length === 0 ? (
        <EmptyState text="无光路节点" />
      ) : (
        <View style={styles.chain}>
          {nodes.map((n, i) => (
            <View key={i} style={styles.chainNode}>
              <View style={styles.chainDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.chainKind}>{TRACE_KIND[n.kind || ""] || n.kind || "节点"}</Text>
                {n.title ? <Text style={styles.chainTitle}>{n.title}</Text> : null}
                {n.sub ? <Text style={styles.chainSub}>{n.sub}</Text> : null}
              </View>
              {i < nodes.length - 1 ? <View style={styles.chainLine} /> : null}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function HistoryView({ histories }: { histories: OdfPortHistory[] }) {
  if (!histories || histories.length === 0) return <EmptyState text="暂无操作历史" />;
  return (
    <View>
      {histories.map((h) => (
        <View key={h.id} style={styles.histItem}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={styles.histType}>{h.eventType || "事件"}</Text>
            <Text style={styles.histTime}>{h.createdAt ? h.createdAt.slice(0, 10) : ""}</Text>
          </View>
          {h.note ? <Text style={styles.histNote}>{h.note}</Text> : null}
          {h.operatorName ? <Text style={styles.histOp}>操作人：{h.operatorName}</Text> : null}
        </View>
      ))}
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
function ActionBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.7} style={styles.actionBtn} onPress={onPress}>
      <Text style={styles.actionBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  headTitle: { fontSize: 18, fontWeight: "700", color: theme.text1 },
  headSub: { fontSize: 11, color: theme.text3, marginTop: 2 },
  seg: { flexDirection: "row", paddingHorizontal: 16, paddingBottom: 8 },
  segTab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
    backgroundColor: theme.surface,
    borderBottomWidth: 2,
    borderColor: "transparent",
  },
  segTabActive: { borderColor: theme.accent },
  segTabText: { fontSize: 13, fontWeight: "600", color: theme.text3 },
  segTabTextActive: { color: theme.accent },
  chipRow: { flexDirection: "row", paddingHorizontal: 16, paddingBottom: 6, flexWrap: "wrap" },
  cell: {
    width: 64,
    height: 64,
    margin: 6,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginBottom: 4 },
  cellNo: { fontSize: 18, fontWeight: "700" },
  cellSub: { fontSize: 10, color: theme.text3, marginTop: 2 },
  toolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 8 },
  toolbarTitle: { fontSize: 13, fontWeight: "700", color: theme.text1 },
  addBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.rPill, backgroundColor: theme.accent },
  addBtnText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  linkCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  linkTitle: { fontSize: 13, fontWeight: "700", color: theme.text1 },
  linkSub: { fontSize: 11, color: theme.text2, marginTop: 2 },
  delTxt: { fontSize: 12, color: theme.danger ?? "#ef4444", fontWeight: "700", paddingHorizontal: 8 },
  badge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, marginBottom: 10 },
  badgeText: { fontWeight: "700" },
  row: { flexDirection: "row", paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.border },
  rowLabel: { width: 90, fontSize: 13, color: theme.text3 },
  rowValue: { flex: 1, fontSize: 13, color: theme.text1 },
  btnRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  actionBtn: { flex: 1, alignItems: "center", paddingVertical: 11, borderRadius: 12, backgroundColor: theme.track },
  actionBtnText: { fontSize: 13, fontWeight: "700", color: theme.accent },
  sectionTitle: { fontSize: 12, fontWeight: "700", color: theme.text3, marginBottom: 6 },
  miniLink: { backgroundColor: theme.surface, borderRadius: 8, padding: 9, marginBottom: 6 },
  miniLinkText: { fontSize: 12, color: theme.text1 },
  backBtn: { alignSelf: "flex-start", marginBottom: 8 },
  backBtnText: { fontSize: 13, color: theme.accent, fontWeight: "700" },
  routeText: { fontSize: 12, color: theme.text2, marginBottom: 10, lineHeight: 18 },
  chain: { paddingLeft: 6 },
  chainNode: { position: "relative", paddingLeft: 20, paddingBottom: 16 },
  chainDot: { position: "absolute", left: 2, top: 4, width: 10, height: 10, borderRadius: 5, backgroundColor: theme.accent },
  chainLine: { position: "absolute", left: 6, top: 14, bottom: 0, width: 2, backgroundColor: theme.border },
  chainKind: { fontSize: 12, fontWeight: "700", color: theme.accent },
  chainTitle: { fontSize: 13, color: theme.text1, marginTop: 2 },
  chainSub: { fontSize: 11, color: theme.text2, marginTop: 1 },
  histItem: { backgroundColor: theme.surface, borderRadius: 10, padding: 10, marginBottom: 8 },
  histType: { fontSize: 13, fontWeight: "700", color: theme.text1 },
  histTime: { fontSize: 11, color: theme.text3 },
  histNote: { fontSize: 12, color: theme.text2, marginTop: 4 },
  histOp: { fontSize: 11, color: theme.text3, marginTop: 2 },
  fLabel: { fontSize: 13, fontWeight: "700", color: theme.text1, marginTop: 12, marginBottom: 6 },
  saveBtn: { marginTop: 18, alignItems: "center", paddingVertical: 13, borderRadius: 12, backgroundColor: theme.accent },
  saveBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
});
