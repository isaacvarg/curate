import { ORPCError, isDefinedError } from "@orpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Button, ErrorText, Field } from "@/components/form";
import { orpc, queryClient } from "@/lib/api";

// The Items in a Collection under one parent, or at the top Level when there's
// no parent, in sort key order. Each row opens the Item screen.
export function ItemList({
  collectionId,
  parentId,
  emptyText,
}: {
  collectionId: string;
  parentId?: string;
  emptyText: string;
}) {
  const items = useQuery(orpc.item.list.queryOptions({ input: { collectionId, parentId } }));

  if (items.error) return <ErrorText>Couldn't load these Items.</ErrorText>;
  if (items.isPending) return <Text>Loading…</Text>;

  return (
    <FlatList
      data={items.data}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={<Text style={styles.empty}>{emptyText}</Text>}
      renderItem={({ item }) => (
        <Link href={{ pathname: "/items/[id]", params: { id: item.id } }} asChild>
          <Pressable accessibilityRole="link" style={styles.row}>
            <Text style={styles.rowText}>{item.name}</Text>
          </Pressable>
        </Link>
      )}
    />
  );
}

// Adds an Item at `level`: at the top Level without a parent, or as a child of
// `parentId` at the Level below it.
export function AddItem({
  collectionId,
  level,
  parentId,
}: {
  collectionId: string;
  level: { id: string; name: string };
  parentId?: string;
}) {
  const [name, setName] = useState("");
  const create = useCreateItem(() => setName(""));

  return (
    <View style={styles.add}>
      <Field placeholder={`New ${level.name}`} value={name} onChangeText={setName} />
      <ErrorText>{create.error ? createErrorMessage(create.error) : null}</ErrorText>
      <Button
        title={create.isPending ? "Adding…" : `Add ${level.name}`}
        onPress={() => create.mutate({ collectionId, levelId: level.id, parentId, name })}
        disabled={create.isPending}
      />
    </View>
  );
}

type CreateError = NonNullable<ReturnType<typeof useCreateItem>["error"]>;

function useCreateItem(onSuccess: () => void) {
  return useMutation(
    orpc.item.create.mutationOptions({
      onSuccess: async () => {
        onSuccess();
        // Refreshes the list and the parent's child count.
        await queryClient.invalidateQueries({ queryKey: orpc.item.key() });
      },
    }),
  );
}

function createErrorMessage(error: CreateError): string {
  if (isDefinedError(error)) {
    if (error.code === "INVALID_STRUCTURE") return "This Item can't go here. Go back and try again.";
    return error.message;
  }
  if (!(error instanceof ORPCError)) return "Couldn't reach the server. Try again.";
  if (error.code === "BAD_REQUEST") return "Give it a name.";
  return "Couldn't add it. Try again.";
}

const styles = StyleSheet.create({
  row: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#ccc" },
  rowText: { fontSize: 18 },
  empty: { color: "#666", fontSize: 16 },
  add: { gap: 8 },
});
