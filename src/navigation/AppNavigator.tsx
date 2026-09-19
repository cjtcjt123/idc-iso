import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useAuth } from "../auth/AuthContext";
import { LoginScreen } from "../screens/LoginScreen";
import { RoomsScreen } from "../screens/RoomsScreen";
import { RoomDetailScreen } from "../screens/RoomDetailScreen";
import { RackDetailScreen } from "../screens/RackDetailScreen";
import { DevicesScreen } from "../screens/DevicesScreen";
import { DeviceDetailScreen } from "../screens/DeviceDetailScreen";
import { InventoryScreen } from "../screens/InventoryScreen";
import { InstanceDetailScreen } from "../screens/InstanceDetailScreen";
import { ScanScreen } from "../screens/ScanScreen";
import { OdfScreen } from "../screens/OdfScreen";
import { OdfModuleDetailScreen } from "../screens/OdfModuleDetailScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { CustomersScreen } from "../screens/CustomersScreen";
import { CustomerDetailScreen } from "../screens/CustomerDetailScreen";
import { CustomerCreateScreen } from "../screens/CustomerCreateScreen";
import { AccessoriesScreen } from "../screens/AccessoriesScreen";
import { AccessoryDetailScreen } from "../screens/AccessoryDetailScreen";
import { OperationsScreen } from "../screens/OperationsScreen";
import { AuditScreen } from "../screens/AuditScreen";
import { theme } from "../theme";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function IconTab({ name, color }: { name: string; color: string }) {
  const glyph: Record<string, string> = {
    机房: "▦",
    设备: "⬚",
    库存: "▤",
    光配: "⌁",
    我的: "◍",
  };
  return <Text style={{ fontSize: 22, color }}>{glyph[name] || "•"}</Text>;
}

function RoomsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Rooms" component={RoomsScreen} options={{ title: "机房" }} />
      <Stack.Screen name="RoomDetail" component={RoomDetailScreen} options={{ title: "机房详情" }} />
      <Stack.Screen name="RackDetail" component={RackDetailScreen} options={{ title: "机柜" }} />
      <Stack.Screen name="DeviceDetail" component={DeviceDetailScreen} options={{ title: "设备详情" }} />
    </Stack.Navigator>
  );
}

function DevicesStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Devices" component={DevicesScreen} options={{ title: "设备" }} />
      <Stack.Screen name="DeviceDetail" component={DeviceDetailScreen} options={{ title: "设备详情" }} />
    </Stack.Navigator>
  );
}

function InventoryStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Inventory" component={InventoryScreen} options={{ title: "库存" }} />
      <Stack.Screen
        name="InstanceDetail"
        component={InstanceDetailScreen}
        options={{ title: "物料详情" }}
      />
      <Stack.Screen name="Scan" component={ScanScreen} options={{ title: "扫码入库" }} />
    </Stack.Navigator>
  );
}

function OdfStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Odf" component={OdfScreen} options={{ title: "光配 ODF" }} />
      <Stack.Screen
        name="OdfModuleDetail"
        component={OdfModuleDetailScreen}
        options={{ title: "ODF 端口" }}
      />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: "我的" }} />
      <Stack.Screen name="Customers" component={CustomersScreen} options={{ title: "客户" }} />
      <Stack.Screen
        name="CustomerDetail"
        component={CustomerDetailScreen}
        options={{ title: "客户详情" }}
      />
      <Stack.Screen name="CustomerCreate" component={CustomerCreateScreen} options={{ title: "新建客户" }} />
      <Stack.Screen name="Accessories" component={AccessoriesScreen} options={{ title: "配件" }} />
      <Stack.Screen
        name="AccessoryDetail"
        component={AccessoryDetailScreen}
        options={{ title: "配件详情" }}
      />
      <Stack.Screen name="Operations" component={OperationsScreen} options={{ title: "出入库流水" }} />
      <Stack.Screen name="Audit" component={AuditScreen} options={{ title: "审计日志" }} />
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
      <Tab.Screen name="机房Tab" component={RoomsStack} options={{ title: "机房", tabBarIcon: ({ color }) => <IconTab name="机房" color={color} /> }} />
      <Tab.Screen name="设备Tab" component={DevicesStack} options={{ title: "设备", tabBarIcon: ({ color }) => <IconTab name="设备" color={color} /> }} />
      <Tab.Screen name="库存Tab" component={InventoryStack} options={{ title: "库存", tabBarIcon: ({ color }) => <IconTab name="库存" color={color} /> }} />
      <Tab.Screen name="光配Tab" component={OdfStack} options={{ title: "光配", tabBarIcon: ({ color }) => <IconTab name="光配" color={color} /> }} />
      <Tab.Screen name="我的Tab" component={ProfileStack} options={{ title: "我的", tabBarIcon: ({ color }) => <IconTab name="我的" color={color} /> }} />
    </Tab.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
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
