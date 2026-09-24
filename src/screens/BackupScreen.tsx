import React, { useEffect, useState } from "react";
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as FileSystem from "expo-file-system";
import { useAuth } from "../auth/AuthContext";
import { isAdmin } from "../auth/permission";
import { apiCollect, apiDelete, apiDownloadBuffer, apiPost } from "../api/client";
import type { Backup } from "../api/types";
import { Badge, Button, Card, EmptyState, Loading, SectionCard } from "../components/ui";
import { theme } from "../theme";

interface BackupVM extends Backup {
  sizeText: string;
  timeText: string;
  statusLabel: string;
  statusColor: string;
}

// ponytail：沿用 RN Alert 做轻量提示，避免再引入 toast 库
function toast(title: string, msg?: string) {
  Alert.alert(title, msg);
}

function formatSize(size: number): string {
  if (!size) return "0 B";
  if (size >= 1024 * 1024) return (size / 1024 / 1024).toFixed(2) + " MB";
  if (size >= 1024) return (size / 1024).toFixed(1) + " KB";
  return size + " B";
}

function formatTime(s: string): string {
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  );
}

function statusOf(b: Backup): { label: string; color: string } {
  if (b.status === "failed") return { label: "失败", color: theme.danger };
  if (b.status === "done") return { label: "完成", color: theme.ok };
  return { label: "进行中", color: theme.warn };
}

function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
  }
  return btoa(binary);
}

export function BackupScreen() {
  const { user } = useAuth();
  const isSuper = isAdmin(user);

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [list, setList] = useState<BackupVM[]>([]);

  async function load() {
    setLoading(true);
    try {
      const raw = await apiCollect<Backup>("/backup");
      setList(
        (raw || [])
          .slice()
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
          .map((b) => {
            const s = statusOf(b);
            return { ...b, sizeText: formatSize(b.fileSize), timeText: formatTime(b.createdAt), statusLabel: s.label, statusColor: s.color };
          })
      );
    } catch (e: any) {
      toast("加载失败", e?.message || "无法获取备份列表");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onCreate() {
    if (creating) return;
    setCreating(true);
    try {
      await apiPost<Backup>("/backup", {});
      toast("备份成功");
      load();
    } catch (e: any) {
      toast("备份失败", e?.message || "请稍后重试");
    } finally {
      setCreating(false);
    }
  }

  function onRestore(b: BackupVM) {
    Alert.alert("恢复数据库", `确认用「${b.fileName}」恢复数据库？当前数据将被该备份覆盖，此操作不可撤销。`, [
      { text: "取消", style: "cancel" },
      {
        text: "恢复",
        style: "destructive",
        onPress: async () => {
          try {
            await apiPost(`/backup/${b.id}/restore`, {});
            toast("恢复成功");
            load();
          } catch (e: any) {
            toast("恢复失败", e?.message || "操作未完成");
          }
        },
      },
    ]);
  }

  function onDelete(b: BackupVM) {
    Alert.alert("删除备份", `确认删除「${b.fileName}」？`, [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          try {
            await apiDelete(`/backup/${b.id}`);
            toast("已删除");
            load();
          } catch (e: any) {
            toast("删除失败", e?.message || "操作未完成");
          }
        },
      },
    ]);
  }

  async function onDownload(b: BackupVM) {
    try {
      const buf = await apiDownloadBuffer(`/backup/${b.id}/download`);
      const uri = `${FileSystem.cacheDirectory}idcops-backup-${b.id}-${b.fileName}`;
      await FileSystem.writeAsStringAsync(uri, bufToBase64(buf), { encoding: FileSystem.EncodingType.Base64 });
      Alert.alert("已下载备份", `已保存到应用缓存：\n${uri}\n可通过本机文件管理导出。`, [{ text: "完成" }]);
      // 尽力唤起系统打开/分享（部分类型可用，未知类型会静默失败，文件仍可经缓存取出）
      Linking.openURL(uri).catch(() => {});
    } catch (e: any) {
      toast("下载失败", e?.message || "仅超级管理员可下载备份");
    }
  }

  if (!isSuper) {
    return (
      <View style={styles.noAccess}>
        <Text style={styles.noAccessTxt}>仅超级管理员可访问</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ paddingBottom: 24 }}>
      <SectionCard
        title="数据备份"
        right={
          <Button label={creating ? "备份中…" : "立即备份"} onPress={onCreate} loading={creating} style={styles.headBtn} />
        }
      >
        {loading ? (
          <Loading />
        ) : list.length === 0 ? (
          <EmptyState text="暂无备份，点击右上角创建" />
        ) : (
          list.map((b) => (
            <Card key={b.id} style={styles.item}>
              <View style={styles.itemTop}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.itemName} numberOfLines={1}>{b.fileName}</Text>
                  <Text style={styles.itemSub}>
                    {b.sizeText} · {b.timeText}
                  </Text>
                </View>
                <Badge label={b.statusLabel} color={b.statusColor} />
              </View>
              {b.status === "failed" && b.error ? (
                <Text style={styles.errText} numberOfLines={2}>错误：{b.error}</Text>
              ) : null}
              <View style={styles.actions}>
                <ActionBtn label="恢复" onPress={() => onRestore(b)} />
                <ActionBtn label="下载" onPress={() => onDownload(b)} />
                <ActionBtn label="删除" danger onPress={() => onDelete(b)} />
              </View>
            </Card>
          ))
        )}
      </SectionCard>
    </ScrollView>
  );
}

function ActionBtn({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={[styles.actBtn, danger && styles.actBtnDanger]}>
      <Text style={[styles.actBtnText, danger && styles.actBtnTextDanger]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  headBtn: { marginHorizontal: 0, marginTop: 0, paddingVertical: 8, paddingHorizontal: 14, marginBottom: 4 },
  noAccess: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  noAccessTxt: { fontSize: 14, color: theme.text2 },
  item: { marginHorizontal: 0, marginTop: 8 },
  itemTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  itemName: { fontSize: 14, fontWeight: "700", color: theme.text1 },
  itemSub: { fontSize: 12, color: theme.text3, marginTop: 3 },
  errText: { fontSize: 11.5, color: theme.danger, marginTop: 6 },
  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
  actBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: theme.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.border,
  },
  actBtnDanger: { backgroundColor: theme.dangerSoft, borderColor: theme.dangerSoft },
  actBtnText: { fontSize: 13, fontWeight: "700", color: theme.text1 },
  actBtnTextDanger: { color: theme.danger },
});
