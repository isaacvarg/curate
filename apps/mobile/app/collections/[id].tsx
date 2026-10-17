import { isDefinedError } from "@orpc/client";
import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { ErrorText, formStyles } from "@/components/form";
import { orpc } from "@/lib/api";

// A Collection. Items arrive in a later slice, so for now it shows its Levels.
export default function CollectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const collection = useQuery(orpc.collection.get.queryOptions({ input: { id } }));

  if (collection.error) {
    const notFound = isDefinedError(collection.error) && collection.error.code === "NOT_FOUND";
    return (
      <View style={formStyles.screen}>
        <ErrorText>{notFound ? "This Collection doesn't exist." : "Couldn't load this Collection."}</ErrorText>
      </View>
    );
  }

  if (!collection.data) {
    return (
      <View style={formStyles.screen}>
        <Text>Loading…</Text>
      </View>
    );
  }

  const { name, levels } = collection.data;

  return (
    <View style={formStyles.screen}>
      <Stack.Screen options={{ title: name }} />
      <Text style={styles.levels}>{levels.map((level) => level.name).join(" › ")}</Text>
      <Text style={styles.empty}>Nothing here yet.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  levels: { color: "#666", fontSize: 16 },
  empty: { fontSize: 18, marginTop: 24, textAlign: "center" },
});
