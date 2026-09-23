import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useAuth } from "../auth/AuthContext";
import { LoginScreen } from "../screens/LoginScreen";
import { DashboardScreen } from "../screens/DashboardScreen";
import { HardwareScreen } from "../screens/HardwareScreen";
import { DeviceDetailScreen } from "../screens/DeviceDetailScreen";
import { InventoryScreen } from "../screens/InventoryScreen";
import { InstanceDetailScreen } from "../screens/InstanceDetailScreen";
import { StockInScreen } from "../screens/StockInScreen";
import { StockOutScreen } from "../screens/StockOutScreen";
import { ScanScreen } from "../screens/ScanScreen";
import { LocationsScreen } from "../screens/LocationsScreen";
import { CategoriesScreen } from "../screens/CategoriesScreen";
import { ProductEditScreen } from "../screens/ProductEditScreen";
import { LogsScreen } from "../screens/LogsScreen";
import { CountListScreen } from "../screens/CountListScreen";
import { CountCreateScreen } from "../screens/CountCreateScreen";
import { CountRunScreen } from "../screens/CountRunScreen";
import { CountReportScreen } from "../screens/CountReportScreen";
import { FloorPlanScreen } from "../screens/FloorPlanScreen";
import { RackDetailScreen } from "../screens/RackDetailScreen";
import { OdfModuleDetailScreen } from "../screens/OdfModuleDetailScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { CustomersScreen } from "../screens/CustomersScreen";
import { CustomerDetailScreen } from "../screens/CustomerDetailScreen";
import { CustomerCreateScreen } from "../screens/CustomerCreateScreen";
import { AccessoriesScreen } from "../screens/AccessoriesScreen";
import { AccessoryDetailScreen } from "../screens/AccessoryDetailScreen";
import { OperationsScreen } from "../screens/OperationsScreen";
import { AuditScreen } from "../screens/AuditScreen";
import { RoomsScreen } from "../screens/RoomsScreen";
import { RoomDetailScreen } from "../screens/RoomDetailScreen";
import { StatsScreen } from "../screens/StatsScreen";
import { NetworkScreen } from "../screens/NetworkScreen";
import { ImportExportScreen } from "../screens/ImportExportScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { AdminConsoleScreen } from "../screens/AdminConsoleScreen";
import { FacilitiesScreen } from "../screens/FacilitiesScreen";
import { theme } from "../theme";
import { Screen } from "../components/layout";

/**
 * 统一给每个注册的屏套一层 Screen：
 *  - 顶部呼吸位：第一行内容不贴着导航栏（iPhone 上贴边会很难点到）
 *  - 统一下沉背景色，避免各屏各自为政
 *
 * 用 WeakMap 缓存，保证包裹组件的标识稳定 —— 若在 JSX 里现包，
 * 每次渲染都会生成新组件类型，会导致整屏被反复重挂载。
 */
const _screenCache = new WeakMap<object, React.ComponentType<any>>();
function S(Comp: React.ComponentType<any>): React.ComponentType<any> {
  const cached = _screenCache.get(Comp);
  if (cached) return cached;
  const Wrapped = (props: any) => (
    <Screen>
      <Comp {...props} />
    </Screen>
  );
  Wrapped.displayName = `Screen(${Comp.displayName || Comp.name || "Anon"})`;
  _screenCache.set(Comp, Wrapped);
  return Wrapped;
}

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function IconTab({ name, color }: { name: string; color: string }) {
  const glyph: Record<string, string> = {
    首页: "⌂",
    机柜设备: "▦",
    库存: "▤",
    平面图: "▣",
    我的: "◍",
  };
  return <Text style={{ fontSize: 22, color }}>{glyph[name] || "•"}</Text>;
}

function HomeStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Dashboard" component={S(DashboardScreen)} options={{ title: "首页" }} />
    </Stack.Navigator>
  );
}

// 机柜设备：聚合 设备 / 机柜 / ODF（对齐小程序 机柜设备 页）
function HardwareStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Hardware" component={S(HardwareScreen)} options={{ title: "机柜设备" }} />
      <Stack.Screen name="RackDetail" component={S(RackDetailScreen)} options={{ title: "机柜" }} />
      <Stack.Screen name="DeviceDetail" component={S(DeviceDetailScreen)} options={{ title: "设备详情" }} />
      <Stack.Screen name="OdfModuleDetail" component={S(OdfModuleDetailScreen)} options={{ title: "ODF 端口" }} />
    </Stack.Navigator>
  );
}

function InventoryStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Inventory" component={S(InventoryScreen)} options={{ title: "库存" }} />
      <Stack.Screen name="InstanceDetail" component={S(InstanceDetailScreen)} options={{ title: "物料详情" }} />
      <Stack.Screen name="StockIn" component={S(StockInScreen)} options={{ title: "入库" }} />
      <Stack.Screen name="StockOut" component={S(StockOutScreen)} options={{ title: "出库" }} />
      <Stack.Screen name="Scan" component={S(ScanScreen)} options={{ title: "扫码入库" }} />
      <Stack.Screen name="Locations" component={S(LocationsScreen)} options={{ title: "库位" }} />
      <Stack.Screen name="Categories" component={S(CategoriesScreen)} options={{ title: "分类 / 物料" }} />
      <Stack.Screen name="ProductEdit" component={S(ProductEditScreen)} options={{ title: "物料" }} />
      <Stack.Screen name="Logs" component={S(LogsScreen)} options={{ title: "操作日志" }} />
      <Stack.Screen name="CountList" component={S(CountListScreen)} options={{ title: "盘点任务" }} />
      <Stack.Screen name="CountCreate" component={S(CountCreateScreen)} options={{ title: "新建盘点" }} />
      <Stack.Screen name="CountRun" component={S(CountRunScreen)} options={{ title: "盘点执行" }} />
      <Stack.Screen name="CountReport" component={S(CountReportScreen)} options={{ title: "盘点报告" }} />
    </Stack.Navigator>
  );
}

function FloorPlanStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="FloorPlan" component={S(FloorPlanScreen)} options={{ title: "平面图" }} />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Profile" component={S(ProfileScreen)} options={{ title: "我的" }} />
      <Stack.Screen name="Customers" component={S(CustomersScreen)} options={{ title: "客户" }} />
      <Stack.Screen name="CustomerDetail" component={S(CustomerDetailScreen)} options={{ title: "客户详情" }} />
      <Stack.Screen name="CustomerCreate" component={S(CustomerCreateScreen)} options={{ title: "新建客户" }} />
      <Stack.Screen name="Accessories" component={S(AccessoriesScreen)} options={{ title: "配件" }} />
      <Stack.Screen name="AccessoryDetail" component={S(AccessoryDetailScreen)} options={{ title: "配件详情" }} />
      <Stack.Screen name="Operations" component={S(OperationsScreen)} options={{ title: "出入库流水" }} />
      <Stack.Screen name="Audit" component={S(AuditScreen)} options={{ title: "审计日志" }} />
      {/* 切换机房入口（对齐小程序 profile → 切换机房） */}
      <Stack.Screen name="Rooms" component={S(RoomsScreen)} options={{ title: "机房" }} />
      <Stack.Screen name="RoomDetail" component={S(RoomDetailScreen)} options={{ title: "机房详情" }} />
      <Stack.Screen name="RackDetail" component={S(RackDetailScreen)} options={{ title: "机柜" }} />
      <Stack.Screen name="DeviceDetail" component={S(DeviceDetailScreen)} options={{ title: "设备详情" }} />
      {/* 6 个二级页（待接入 → 已接入） */}
      <Stack.Screen name="Stats" component={S(StatsScreen)} options={{ title: "统计报表" }} />
      <Stack.Screen name="Network" component={S(NetworkScreen)} options={{ title: "网络管理" }} />
      <Stack.Screen name="ImportExport" component={S(ImportExportScreen)} options={{ title: "导入导出" }} />
      <Stack.Screen name="Settings" component={S(SettingsScreen)} options={{ title: "设置" }} />
      <Stack.Screen name="AdminConsole" component={S(AdminConsoleScreen)} options={{ title: "管理台" }} />
      <Stack.Screen name="Facilities" component={S(FacilitiesScreen)} options={{ title: "机房设施" }} />
    </Stack.Navigator>
  );
}

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.text3,
        tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.border },
        headerShown: true,
      }}
    >
      <Tab.Screen name="首页Tab" component={HomeStack} options={{ title: "首页", tabBarIcon: ({ color }) => <IconTab name="首页" color={color} /> }} />
      <Tab.Screen name="机柜设备Tab" component={HardwareStack} options={{ title: "机柜设备", tabBarIcon: ({ color }) => <IconTab name="机柜设备" color={color} /> }} />
      <Tab.Screen name="库存Tab" component={InventoryStack} options={{ title: "库存", tabBarIcon: ({ color }) => <IconTab name="库存" color={color} /> }} />
      <Tab.Screen name="平面图Tab" component={FloorPlanStack} options={{ title: "平面图", tabBarIcon: ({ color }) => <IconTab name="平面图" color={color} /> }} />
      <Tab.Screen name="我的Tab" component={ProfileStack} options={{ title: "我的", tabBarIcon: ({ color }) => <IconTab name="我的" color={color} /> }} />
    </Tab.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={S(LoginScreen)} />
    </Stack.Navigator>
  );
}

export function AppNavigator() {
  const { token, ready } = useAuth();
  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={theme.accent} size="large" />
      </View>
    );
  }
  return (
    <NavigationContainer>
      {token ? <Tabs /> : <AuthStack />}
    </NavigationContainer>
  );
}
