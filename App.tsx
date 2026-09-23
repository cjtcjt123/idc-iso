import React from "react";
import { Text, TextInput } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/auth/AuthContext";
import { AppNavigator } from "./src/navigation/AppNavigator";

/**
 * 统一禁止字号跟随 iOS「设置 → 显示与亮度 → 文字大小 / 辅助功能更大字体」放大。
 *
 * 这是 iPhone 上「页面太长、内容显示不全」最常见的根因：系统字号一旦调大，
 * RN 的 Text 会整体放大，卡片 / 行高随之撑开，原本一屏放得下的内容被挤出屏幕。
 * IDC 这类信息密集型工具优先保证布局稳定，故锁定为 1（完全不缩放）。
 * 若将来要兼顾无障碍阅读，可改 1.15 或在设置页做成开关。
 */
const MAX_FONT_SCALE = 1;
// RN 0.76 已从类型里移除 defaultProps，但 React 18 运行期仍支持，故用 any 断言
const TextAny = Text as any;
const TextInputAny = TextInput as any;
TextAny.defaultProps = { ...(TextAny.defaultProps || {}), maxFontSizeMultiplier: MAX_FONT_SCALE };
TextInputAny.defaultProps = { ...(TextInputAny.defaultProps || {}), maxFontSizeMultiplier: MAX_FONT_SCALE };

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
