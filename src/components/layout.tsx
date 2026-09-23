import React from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "../theme";

/**
 * 统一页面容器 —— iPhone（刘海屏 / Home 指示条）安全区适配的唯一入口。
 *
 * 背景：React Navigation 的原生导航栏已经处理了「顶部状态栏」，
 * 底部 Tab 条也自带 Home 指示条留白，所以这里不再叠加 inset，
 * 只提供两件导航器没做的事：
 *   1) 顶部呼吸位 TOP_BREATH：让第一行内容不贴着导航栏，避免贴边难点；
 *   2) 可选滚动 + 底部呼吸位：保证长页面的最后一项能滚到完全可见。
 *
 * 真正需要 inset 的是「自己铺满整屏的弹层」（Sheet / HomeGuard），
 * 见下方 useHomeInset / HomeGuard。
 */

/** 顶部呼吸位（导航栏下方，避免第一行贴边） */
export const TOP_BREATH = 10;
/** 列表 / 表单滚动到底时的底部留白 */
export const BOTTOM_BREATH = 24;

/** Home 指示条高度（iPhone 无 Home 键机型约 34pt，有 Home 键为 0） */
export function useHomeInset(): number {
  return useSafeAreaInsets().bottom;
}

/** 顶部状态栏高度 */
export function useTopInset(): number {
  return useSafeAreaInsets().top;
}

/**
 * 页面容器。被 AppNavigator 的 withScreen 统一包裹每一个注册屏。
 */
export function Screen({
  children,
  style,
  top = TOP_BREATH,
  scroll = false,
  contentStyle,
}: {
  children: React.ReactNode;
  style?: any;
  /** 顶部呼吸位；传 0 可关闭 */
  top?: number;
  /** 本屏无自带滚动容器时置 true，由 Screen 提供 ScrollView */
  scroll?: boolean;
  contentStyle?: any;
}) {
  const container: any = [{ flex: 1, backgroundColor: theme.bg }, { paddingTop: top }, style];

  if (scroll) {
    return (
      <View style={container}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[{ paddingBottom: BOTTOM_BREATH }, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </View>
    );
  }

  return <View style={container}>{children}</View>;
}

/**
 * Home 指示条守卫：给「铺满整屏的自定义层」底部加安全区，
 * 例如全屏弹层 / 无 Tab 的落地页。
 */
export function HomeGuard({ children, style }: { children: React.ReactNode; style?: any }) {
  const bottom = useHomeInset();
  return <View style={[{ paddingBottom: bottom }, style]}>{children}</View>;
}
