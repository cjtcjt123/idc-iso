import { Alert } from "react-native";

/**
 * 轻量提示：沿用 BackupScreen 既有约定（ponytail 评审，避免引入 toast 库）。
 * 单参数 = 仅标题；双参数 = 标题 + 正文。
 */
export function toast(title: string, msg?: string) {
  Alert.alert(title, msg);
}
