import { useQuery } from "@tanstack/react-query";
import { Link, useRouter } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Button, ErrorText, formStyles } from "@/components/form";
import { orpc, queryClient } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

// Home: the signed-in User's Collections.
export default function Collections() {
  const router = useRouter();
  const collections = useQuery(orpc.collection.list.queryOptions());

  async function signOut() {
    await authClient.signOut();
    queryClient.clear();
  }

  return (
    <View style={formStyles.screen}>
      <Button title="New Collection" onPress={() => router.push("/collections/new")} />
      <ErrorText>{collections.error ? "Couldn't load your Collections." : null}</ErrorText>
      {collections.isPending ? (
        <Text>Loading…</Text>
      ) : (
        <FlatList
          data={collections.data ?? []}
          keyExtractor={(c) => c.id}
          ListEmptyComponent={<Text style={styles.empty}>No Collections yet.</Text>}
          renderItem={({ item }) => (
            <Link href={{ pathname: "/collections/[id]", params: { id: item.id } }} asChild>
              <Pressable accessibilityRole="link" style={styles.row}>
                <Text style={styles.rowText}>{item.name}</Text>
              </Pressable>
            </Link>
          )}
        />
      )}
      <Button title="Sign out" onPress={signOut} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#ccc" },
  rowText: { fontSize: 18 },
  empty: { color: "#666", fontSize: 16 },
});
