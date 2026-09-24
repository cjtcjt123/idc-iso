import React, { useEffect, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { apiCollect, apiPost } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { Floor, Room, Zone } from "../api/types";
import { Badge, Button, Card, CardRow, EmptyState, Loading, SectionCard } from "../components/ui";
import { theme } from "../theme";

type LocType = "room" | "floor" | "zone";

interface CreateState {
  open: boolean;
  type: LocType;
  name: string;
  code: string;
  parentId: string;
  /** 区域网格尺寸（新建区域必填，后端 POST /zones 要求 roomId + cols + rows） */
  cols: string;
  rows: string;
}

const TYPE_LABEL: Record<LocType, string> = {
  room: "机房",
  floor: "楼层",
  zone: "区域",
};

export function FacilitiesScreen() {
  const { currentRoomId } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [openRoomId, setOpenRoomId] = useState<string | null>(null);
  const [openFloorId, setOpenFloorId] = useState<string | null>(null);
  const [create, setCreate] = useState<CreateState>({ open: false, type: "room", name: "", code: "", parentId: "", cols: "", rows: "" });

  const load = async () => {
    try {
      const rs = await apiCollect<Room>("/rooms/mine", { pageSize: 100 });
      setRooms(rs);
      if (rs.length) {
        const cur = rs.find((r) => r.id === currentRoomId) || rs[0];
        if (!openRoomId) setOpenRoomId(cur.id);
        const fs = await apiCollect<Floor>("/floors", { roomId: cur.id });
        setFloors(fs);
        if (fs.length) {
          const z = await apiCollect<Zone>("/zones", { floorId: fs[0].id });
          setZones(z);
        } else {
          setZones([]);
        }
      } else {
        setFloors([]);
        setZones([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadFloors = async (roomId: string) => {
    const fs = await apiCollect<Floor>("/floors", { roomId });
    setFloors(fs);
    setZones([]);
    setOpenFloorId(fs.length ? fs[0].id : null);
  };

  const loadZones = async (floorId: string) => {
    const z = await apiCollect<Zone>("/zones", { floorId });
    setZones(z);
    setOpenFloorId(floorId);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = (type: LocType, parentId = "") => {
    setCreate({ open: true, type, name: "", code: "", parentId, cols: "", rows: "" });
    setMsg("");
  };

  const submitCreate = async () => {
    if (!create.name.trim()) return setMsg("名称不能为空");
    if (create.type === "zone") {
      const c = Number(create.cols);
      const r = Number(create.rows);
      if (!Number.isInteger(c) || !Number.isInteger(r) || c < 1 || r < 1) {
        return setMsg("区域网格列数/行数必须为 ≥1 的整数");
      }
    }
    setBusy(true);
    try {
      if (create.type === "room") {
        await apiPost("/rooms", { name: create.name, code: create.code || undefined });
      } else if (create.type === "floor") {
        await apiPost("/floors", { name: create.name, code: create.code || undefined, roomId: create.parentId });
      } else {
        // POST /zones（顶层）要求 roomId + cols + rows，缺任一必 400
        await apiPost("/zones", {
          name: create.name,
          code: create.code || undefined,
          roomId: openRoomId || undefined,
          floorId: create.parentId,
          cols: Number(create.cols),
          rows: Number(create.rows),
        });
      }
      setMsg(`已创建${TYPE_LABEL[create.type]}`);
      setCreate({ ...create, open: false });
      if (create.type === "room") await load();
      else if (create.type === "floor" && create.parentId) await loadFloors(create.parentId);
      else if (create.type === "zone" && create.parentId) await loadZones(create.parentId);
    } catch (e: any) {
      setMsg(`创建失败：${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={{ paddingHorizontal: 16 }}>
        <SectionCard
          title="机房"
          right={<TouchableOpacity onPress={() => openCreate("room")}><Text style={styles.add}>+ 新建</Text></TouchableOpacity>}
        >
          {rooms.length === 0 ? (
            <EmptyState text="暂无机房" />
          ) : (
            rooms.map((r) => {
              const open = r.id === openRoomId;
              return (
                <TouchableOpacity key={r.id} activeOpacity={0.85} onPress={() => { setOpenRoomId(r.id); loadFloors(r.id); }}>
                  <CardRow
                    icon="🏢"
                    colors={theme.grad.rack}
                    title={r.name}
                    subtitle={r.code ? `编码 ${r.code}` : r.address || "机房"}
                    right={open ? <Badge label="展开中" color={theme.accent} /> : undefined}
                  />
                </TouchableOpacity>
              );
            })
          )}
        </SectionCard>

        {openRoomId ? (
          <SectionCard
            title="楼层"
            right={<TouchableOpacity onPress={() => openCreate("floor", openRoomId)}><Text style={styles.add}>+ 新建</Text></TouchableOpacity>}
          >
            {floors.length === 0 ? (
              <EmptyState text="暂无楼层" />
            ) : (
              floors.map((f) => {
                const open = f.id === openFloorId;
                return (
                  <TouchableOpacity key={f.id} activeOpacity={0.85} onPress={() => loadZones(f.id)}>
                    <CardRow
                      icon="▤"
                      colors={theme.grad.odf}
                      title={f.name || `楼层 ${f.index ?? "-"}`}
                      subtitle={f.code ? `编码 ${f.code}` : `序号 ${f.index ?? "-"}`}
                      right={open ? <Badge label="展开中" color={theme.accent} /> : undefined}
                    />
                  </TouchableOpacity>
                );
              })
            )}
          </SectionCard>
        ) : null}

        {openFloorId ? (
          <SectionCard
            title="区域"
            right={<TouchableOpacity onPress={() => openCreate("zone", openFloorId)}><Text style={styles.add}>+ 新建</Text></TouchableOpacity>}
          >
            {zones.length === 0 ? (
              <EmptyState text="暂无区域" />
            ) : (
              zones.map((z) => (
                <CardRow
                  key={z.id}
                  icon="▣"
                  colors={theme.grad.inventory}
                  title={z.name || "区域"}
                  subtitle={`${z.cols || 0} × ${z.rows || 0}  编码 ${z.code || "-"}`}
                />
              ))
            )}
          </SectionCard>
        ) : null}

        {msg ? <Text style={styles.msg}>{msg}</Text> : null}
      </View>

      {/* 新建弹层 */}
      <Modal visible={create.open} transparent animationType="slide" onRequestClose={() => setCreate({ ...create, open: false })}>
        <View style={styles.modalMask}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>新建{TYPE_LABEL[create.type]}</Text>
            <Text style={styles.lbl}>名称</Text>
            <TextInput
              style={styles.input}
              placeholder={`${TYPE_LABEL[create.type]}名称`}
              placeholderTextColor={theme.text3}
              value={create.name}
              onChangeText={(t) => setCreate({ ...create, name: t })}
            />
            <Text style={styles.lbl}>编码（可选）</Text>
            <TextInput
              style={styles.input}
              placeholder="例如 B1 / F1 / A"
              placeholderTextColor={theme.text3}
              value={create.code}
              onChangeText={(t) => setCreate({ ...create, code: t })}
              autoCapitalize="characters"
            />
            {create.type === "zone" ? (
              <>
                <Text style={styles.lbl}>网格列数 *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="例如 12"
                  placeholderTextColor={theme.text3}
                  keyboardType="numeric"
                  value={create.cols}
                  onChangeText={(t) => setCreate({ ...create, cols: t })}
                />
                <Text style={styles.lbl}>网格行数 *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="例如 8"
                  placeholderTextColor={theme.text3}
                  keyboardType="numeric"
                  value={create.rows}
                  onChangeText={(t) => setCreate({ ...create, rows: t })}
                />
              </>
            ) : null}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnGhost]} onPress={() => setCreate({ ...create, open: false })}>
                <Text style={styles.modalBtnGhostText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary, busy && styles.modalBtnDisabled]} onPress={submitCreate} disabled={busy}>
                <Text style={styles.modalBtnText}>{busy ? "提交中…" : "确认"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  add: { fontSize: 13, color: theme.accent, fontWeight: "700" },
  msg: { textAlign: "center", fontSize: 12, color: theme.info, marginTop: 8 },
  modalMask: { flex: 1, backgroundColor: "rgba(16,24,40,0.5)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: theme.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 32 },
  modalTitle: { fontSize: 17, fontWeight: "700", color: theme.text1, marginBottom: 12 },
  lbl: { fontSize: 12, fontWeight: "700", color: theme.text2, marginTop: 8, marginBottom: 6 },
  input: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: theme.text1 },
  modalBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: "center" },
  modalBtnPrimary: { backgroundColor: theme.accent },
  modalBtnGhost: { backgroundColor: theme.track },
  modalBtnDisabled: { opacity: 0.6 },
  modalBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  modalBtnGhostText: { color: theme.text2, fontSize: 15, fontWeight: "700" },
});