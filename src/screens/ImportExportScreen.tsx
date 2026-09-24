import React, { useEffect, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { apiCollect, request } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { Customer, Rack } from "../api/types";
import { Badge, Card, Input, SectionCard } from "../components/ui";
import { theme } from "../theme";

type Tab = "import" | "export";

const isWeb = Platform.OS === "web";

/** web 触发文件选择 → 返回 File；native 暂不支持 */
async function pickFileWeb(accept = ".xlsx,.xls"): Promise<File | null> {
  return new Promise((resolve) => {
    const el: HTMLInputElement = document.createElement("input");
    el.type = "file";
    el.accept = accept;
    el.style.display = "none";
    document.body.appendChild(el);
    el.onchange = () => {
      const f = el.files && el.files[0] ? el.files[0] : null;
      document.body.removeChild(el);
      resolve(f);
    };
    el.click();
  });
}

async function downloadBlobWeb(url: string, filename: string) {
  const base = await (await import("../api/client")).request<any>("GET", url, undefined, undefined);
  void base;
  // 直接用 fetch（不解析 JSON），拿 blob
  const res = await fetch(url, { headers: { Accept: "*/*" } });
  if (!res.ok) {
    alert(`下载失败 (${res.status})`);
    return;
  }
  const blob = await res.blob();
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(objUrl), 2000);
}

export function ImportExportScreen() {
  const { token } = useAuth();
  const [tab, setTab] = useState<Tab>("export");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [racks, setRacks] = useState<Rack[]>([]);
  const [customerId, setCustomerId] = useState<string>("");
  const [rackId, setRackId] = useState<string>("");
  const [placement, setPlacement] = useState<string>("mounted");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<{ inserted?: number; updated?: number; failed?: number } | null>(null);

  const append = (m: string) => setLog((l) => [m, ...l].slice(0, 20));

  useEffect(() => {
    (async () => {
      try {
        const cs = await apiCollect<Customer>("/customers", { pageSize: 100 });
        setCustomers(cs);
        const rs = await apiCollect<Rack>("/racks", { pageSize: 100 });
        setRacks(rs);
      } catch {
        /* 网络/权限问题静默，按下按钮时再报错 */
      }
    })();
  }, []);

  const onDownloadTpl = async () => {
    if (!isWeb) return append("请用网页端进行模板下载");
    setBusy(true);
    try {
      await downloadBlobWeb("/import-export/devices/template", `devices-template.xlsx`);
      append("模板已下载");
    } catch (e: any) {
      append(`模板下载失败：${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  const onPickFile = async () => {
    if (!isWeb) return append("请用网页端进行文件选择");
    setBusy(true);
    try {
      const f = await pickFileWeb(".xlsx,.xls");
      if (!f) return;
      const buf = await f.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      const res = await request<any>("POST", "/import-export/devices/import", { filename: f.name, contentBase64: base64 });
      setImportResult(res);
      append(`导入完成：新增 ${res?.inserted ?? 0} / 更新 ${res?.updated ?? 0} / 失败 ${res?.failed ?? 0}`);
    } catch (e: any) {
      append(`导入失败：${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  const onExport = async () => {
    if (!isWeb) return append("请用网页端进行导出");
    setBusy(true);
    try {
      const params = new URLSearchParams();
      if (customerId) params.set("customerId", customerId);
      if (rackId) params.set("rackId", rackId);
      if (placement) params.set("placement", placement);
      const url = `/import-export/devices/export?${params.toString()}`;
      const stamp = new Date().toISOString().slice(0, 10);
      await downloadBlobWeb(url, `devices-${stamp}.xlsx`);
      append(`已导出（客户 ${customerId || "全部"} · 机柜 ${rackId || "全部"} · ${placement}）`);
    } catch (e: any) {
      append(`导出失败：${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={styles.tabs}>
        {(["export", "import"] as Tab[]).map((k) => (
          <TouchableOpacity key={k} style={[styles.tab, tab === k && styles.tabOn]} onPress={() => setTab(k)} activeOpacity={0.85}>
            <Text style={[styles.tabText, tab === k && styles.tabTextOn]}>{k === "export" ? "导出" : "导入"}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ paddingHorizontal: 16 }}>
        {tab === "import" ? (
          <SectionCard title="设备导入">
            <Text style={styles.help}>第一步：下载模板，按列填写后再上传。</Text>
            <TouchableOpacity style={[styles.btn, styles.btnGhost, !isWeb && styles.btnDisabled]} onPress={onDownloadTpl} disabled={busy || !isWeb}>
              <Text style={styles.btnGhostText}>1. 下载模板 xlsx</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnPrimary, { marginTop: 8 }, !isWeb && styles.btnDisabled]} onPress={onPickFile} disabled={busy || !isWeb}>
              <Text style={styles.btnText}>2. 选择 xlsx 文件并导入</Text>
            </TouchableOpacity>
            {!isWeb ? <Text style={styles.webOnly}>当前为原生环境，请用网页端操作。</Text> : null}
            {importResult ? (
              <Card style={styles.resultCard}>
                <View style={styles.resultRow}>
                  <Badge label={`新增 ${importResult.inserted ?? 0}`} color={theme.ok} />
                  <Badge label={`更新 ${importResult.updated ?? 0}`} color={theme.info} />
                  <Badge label={`失败 ${importResult.failed ?? 0}`} color={theme.danger} />
                </View>
              </Card>
            ) : null}
          </SectionCard>
        ) : (
          <SectionCard title="设备导出">
            <Text style={styles.help}>按客户 / 机柜 / 状态过滤后导出 xlsx。</Text>
            <Text style={styles.lbl}>客户</Text>
            <View style={styles.chips}>
              <Chip active={!customerId} label="全部" onPress={() => setCustomerId("")} />
              {customers.slice(0, 12).map((c) => (
                <Chip key={c.id} active={customerId === c.id} label={c.name} onPress={() => setCustomerId(c.id)} />
              ))}
            </View>
            <Text style={styles.lbl}>机柜</Text>
            <View style={styles.chips}>
              <Chip active={!rackId} label="全部" onPress={() => setRackId("")} />
              {racks.slice(0, 12).map((r) => (
                <Chip key={r.id} active={rackId === r.id} label={r.code} onPress={() => setRackId(r.id)} />
              ))}
            </View>
            <Text style={styles.lbl}>位置</Text>
            <View style={styles.chips}>
              {(["mounted", "inventory", "shipped"] as const).map((p) => (
                <Chip key={p} active={placement === p} label={p === "mounted" ? "上架" : p === "inventory" ? "库存" : "出库"} onPress={() => setPlacement(p)} />
              ))}
            </View>
            <TouchableOpacity style={[styles.btn, styles.btnPrimary, { marginTop: 12 }, !isWeb && styles.btnDisabled]} onPress={onExport} disabled={busy || !isWeb}>
              <Text style={styles.btnText}>导出 xlsx</Text>
            </TouchableOpacity>
            {!isWeb ? <Text style={styles.webOnly}>当前为原生环境，请用网页端导出。</Text> : null}
          </SectionCard>
        )}

        {/* 操作日志 */}
        <SectionCard title="操作日志">
          {log.length === 0 ? <Text style={styles.help}>暂无操作</Text> : log.map((l, i) => <Text key={i} style={styles.logItem}>{l}</Text>)}
        </SectionCard>
      </View>
    </ScrollView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[styles.chip, active && styles.chipOn]}>
      <Text style={[styles.chipText, active && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    backgroundColor: theme.surface,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 4,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 9 },
  tabOn: { backgroundColor: theme.accent },
  tabText: { fontSize: 13, fontWeight: "600", color: theme.text2 },
  tabTextOn: { color: "#fff" },
  help: { fontSize: 12, color: theme.text2, marginBottom: 8 },
  lbl: { fontSize: 12, fontWeight: "700", color: theme.text2, marginTop: 12, marginBottom: 6 },
  btn: { borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  btnPrimary: { backgroundColor: theme.accent },
  btnGhost: { backgroundColor: theme.accentSoft },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  btnGhostText: { color: theme.accent, fontSize: 15, fontWeight: "700" },
  btnDisabled: { opacity: 0.45 },
  webOnly: { fontSize: 11, color: theme.warn, marginTop: 8, textAlign: "center" },
  resultCard: { marginTop: 12, marginHorizontal: 0, paddingVertical: 12 },
  resultRow: { flexDirection: "row", gap: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: theme.track, marginRight: 4, marginBottom: 4 },
  chipOn: { backgroundColor: theme.accent },
  chipText: { fontSize: 12, color: theme.text2, fontWeight: "600" },
  chipTextOn: { color: "#fff" },
  logItem: { fontSize: 12, color: theme.text2, paddingVertical: 4 },
});