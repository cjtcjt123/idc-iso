import React, { useEffect, useState } from "react";
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { apiCollect, apiGet } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { IpAddress, Subnet } from "../api/types";
import { Badge, Card, EmptyState, Loading } from "../components/ui";
import { theme } from "../theme";

/** cidr 转 IP 整数（IPv4）。简化版：仅支持 /8-/32 */
function cidrToInt(cidr: string): { net: number; count: number } | null {
  const [ip, maskStr] = cidr.split("/");
  if (!ip) return null;
  const mask = Number(maskStr || "32");
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => isNaN(p))) return null;
  const n = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
  const bits = 32 - mask;
  const count = bits <= 0 ? 1 : 1 << bits;
  const net = (n >>> bits) << bits;
  return { net, count };
}
function intToIp(n: number): string {
  return `${(n >>> 24) & 0xff}.${(n >>> 16) & 0xff}.${(n >>> 8) & 0xff}.${n & 0xff}`;
}

/** 从后端字段（networkAddr + 数字 cidr）合成 cidr 串 */
function deriveCidr(s: Subnet): string {
  const anyS = s as any;
  if (typeof anyS.cidr === "string" && anyS.cidr.includes("/")) return anyS.cidr;
  if (anyS.networkAddr && anyS.cidr !== undefined && anyS.cidr !== null) {
    return `${anyS.networkAddr}/${anyS.cidr}`;
  }
  return "";
}

const STATUS_COLOR: Record<string, string> = {
  assigned: theme.accent,
  reserved: theme.warn,
  free: theme.text3,
};
const STATUS_LABEL: Record<string, string> = {
  assigned: "已分",
  reserved: "预留",
  free: "空闲",
};

/** 12 列 × 8 行 = 96 格；若 >96 则滚动 */
function IpMatrix({ ips, cidr }: { ips: IpAddress[]; cidr?: string }) {
  // 把 ips 转成 ipInt → status 的 map
  const m = new Map<number, IpAddress>();
  let cap = 96;
  let offset = 0;
  const cidrStr = deriveCidr({ cidr: cidr } as any) || cidr;
  if (cidrStr) {
    const parsed = cidrToInt(cidrStr);
    if (parsed) {
      cap = parsed.count;
      offset = parsed.net;
    }
    for (const ip of ips) {
      if (!ip.ip) continue;
      const parts = ip.ip.split(".").map((p) => Number(p));
      const n = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
      m.set(n, ip);
    }
  }
  const total = cap;
  const cells: number[] = [];
  for (let i = 0; i < total; i++) cells.push(offset + i);

  return (
    <View>
      <View style={styles.matrix}>
        {cells.map((ipInt, idx) => {
          const rec = m.get(ipInt);
          const st = rec?.status || "free";
          const color = STATUS_COLOR[st] || STATUS_COLOR.free;
          return (
            <View
              key={idx}
              style={[styles.cell, { backgroundColor: color + "22", borderColor: color }]}
            >
              <Text style={styles.cellText}>{rec ? rec.ip?.split(".").slice(-1)[0] || (idx + 1) : idx + 1}</Text>
            </View>
          );
        })}
      </View>
      <View style={styles.legend}>
        {(["assigned", "reserved", "free"] as const).map((k) => (
          <View key={k} style={styles.legItem}>
            <View style={[styles.legDot, { backgroundColor: STATUS_COLOR[k] }]} />
            <Text style={styles.legTxt}>{STATUS_LABEL[k]} {k === "assigned" ? m.size : ""}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function NetworkScreen() {
  const { currentRoomId } = useAuth();
  const [subnets, setSubnets] = useState<Subnet[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [ips, setIps] = useState<Record<string, IpAddress[]>>({});
  const [loadingIp, setLoadingIp] = useState(false);

  const load = async () => {
    try {
      const res = await apiCollect<Subnet>("/networks/subnets", { roomId: currentRoomId || undefined });
      setSubnets(res);
      if (res.length && !openId) setOpenId(res[0].id);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadIps = async (subnetId: string) => {
    if (ips[subnetId]) return;
    setLoadingIp(true);
    try {
      const res = await apiCollect<IpAddress>(`/networks/subnets/${subnetId}/addresses`, { pageSize: 256 });
      setIps((m) => ({ ...m, [subnetId]: res }));
    } finally {
      setLoadingIp(false);
    }
  };

  useEffect(() => {
    load();
  }, [currentRoomId]);

  useEffect(() => {
    if (openId) loadIps(openId);
  }, [openId]);

  if (loading) return <Loading />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <FlatList
        data={subnets}
        keyExtractor={(s) => s.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListHeaderComponent={
          openId && ips[openId] ? (
            <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
              <Text style={styles.sectionTitle}>IP 分布</Text>
              <Card>
                <IpMatrix ips={ips[openId]} cidr={deriveCidr(subnets.find((s) => s.id === openId) || {} as Subnet)} />
              </Card>
              {loadingIp ? <Text style={styles.loadingHint}>加载 IP…</Text> : null}
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const open = item.id === openId;
          const anyS = item as any;
          const cidrTxt = deriveCidr(item) || anyS.networkAddr || "-";
          const vlanTxt = anyS.vlanId ?? item.vlan ?? "-";
          const gwTxt = item.gateway || anyS.gateway || "-";
          return (
            <TouchableOpacity activeOpacity={0.85} onPress={() => setOpenId(item.id)} style={{ marginHorizontal: 16, marginVertical: 6 }}>
              <Card>
                <View style={styles.row}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.subTitle}>{item.name || cidrTxt}</Text>
                    <Text style={styles.subMeta}>
                      {cidrTxt} · VLAN {vlanTxt} · 网关 {gwTxt}
                    </Text>
                  </View>
                  <Badge label={open ? "展开中" : `${item.capacity || 0} 地址`} color={open ? theme.accent : theme.text2} />
                </View>
              </Card>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<EmptyState text="暂无子网" />}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  subTitle: { fontSize: 14, color: theme.text1, fontWeight: "600" },
  subMeta: { fontSize: 11, color: theme.text3, marginTop: 4 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: theme.text2, marginBottom: 8, marginLeft: 4 },
  matrix: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  cell: {
    width: "7.4%",
    aspectRatio: 1,
    minWidth: 24,
    borderWidth: 1,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  cellText: { fontSize: 10, color: theme.text2, fontWeight: "600" },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 10 },
  legItem: { flexDirection: "row", alignItems: "center" },
  legDot: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },
  legTxt: { fontSize: 11, color: theme.text2 },
  loadingHint: { textAlign: "center", fontSize: 11, color: theme.text3, marginTop: 8 },
});