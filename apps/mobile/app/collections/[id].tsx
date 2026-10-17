import { isDefinedError } from "@orpc/client";
import { useQuery } from "@tanstack/react-query";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { ErrorText, formStyles } from "@/components/form";
import { AddItem, ItemList } from "@/components/items";
import { orpc } from "@/lib/api";

// A Collection: its top-level Items, and adding one.
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
  const topLevel = levels[0];

  return (
    <View style={formStyles.screen}>
      <Stack.Screen options={{ title: name }} />
      <Text style={styles.levels}>{levels.map((level) => level.name).join(" › ")}</Text>
      <Link href={{ pathname: "/collections/levels/[id]", params: { id } }} style={styles.settings}>
        Level settings
      </Link>
      {topLevel ? <AddItem collectionId={id} level={topLevel} /> : null}
      <ItemList collectionId={id} emptyText="Nothing here yet." />
    </View>
  );
}

const styles = StyleSheet.create({
  levels: { color: "#666", fontSize: 16 },
  settings: { color: "#2f6fed", fontSize: 16, fontWeight: "600" },
});
