import React, { useEffect, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { apiCollect } from "../api/client";
import type { OdfModule } from "../api/types";
import { EmptyState, ListRow, Loading } from "../components/ui";

export function OdfScreen({ navigation }: any) {
  const [modules, setModules] = useState<OdfModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await apiCollect<OdfModule>("/odf/modules");
      setModules(res);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <Loading />;

  return (
    <View style={{ flex: 1, backgroundColor: "#f5f7fa" }}>
      <FlatList
        data={modules}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <ListRow
            title={item.name || item.code || "ODF 模块"}
            subtitle={item.portCount ? `${item.portCount} 口` : undefined}
            onPress={() =>
              navigation.navigate("OdfModuleDetail", { moduleId: item.id, moduleName: item.name })
            }
          />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListEmptyComponent={<EmptyState text="暂无 ODF 模块" />}
      />
    </View>
  );
}
