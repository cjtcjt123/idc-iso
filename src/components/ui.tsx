import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { theme } from "../theme";

export function ScreenHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>{title}</Text>
      {right}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function ListRow({
  title,
  subtitle,
  right,
  onPress,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
}) {
  const body = (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {right}
        <Text style={styles.chevron}>›</Text>
      </View>
    </View>
  );
  if (onPress) return <TouchableOpacity onPress={onPress}>{body}</TouchableOpacity>;
  return body;
}

export function Badge({ label, color }: { label: string; color?: string }) {
  return (
    <View style={[styles.badge, color ? { backgroundColor: color + "22" } : null]}>
      <Text style={[styles.badgeText, color ? { color } : null]}>{label}</Text>
    </View>
  );
}

export function Input({
  value,
  onChangeText,
  placeholder,
  secure,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secure?: boolean;
}) {
  return (
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.text3}
      secureTextEntry={secure}
      autoCapitalize="none"
      autoCorrect={false}
    />
  );
}

export function Button({
  label,
  onPress,
  loading,
  danger,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.btn, danger ? styles.btnDanger : null]}
      onPress={onPress}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.btnText}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={theme.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: { fontSize: 22, fontWeight: "700", color: theme.text1 },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: "#101828",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: theme.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
  },
  rowTitle: { fontSize: 15, color: theme.text1, fontWeight: "600" },
  rowSub: { fontSize: 12, color: theme.text3, marginTop: 2 },
  chevron: { fontSize: 20, color: theme.text3, marginLeft: 8 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: theme.accentSoft,
    alignSelf: "flex-start",
  },
  badgeText: { fontSize: 12, color: theme.accent, fontWeight: "600" },
  input: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.text1,
  },
  btn: {
    backgroundColor: theme.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 10,
  },
  btnDanger: { backgroundColor: theme.danger },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  empty: { padding: 40, alignItems: "center" },
  emptyText: { color: theme.text3, fontSize: 14 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
});
