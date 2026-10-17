import { isDefinedError } from "@orpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { ErrorText, formStyles } from "@/components/form";
import { ConfirmDelete, errorMessage, manageStyles, RenameField } from "@/components/manage";
import { orpc, queryClient } from "@/lib/api";
import { describeItemDelete } from "@/lib/delete-preview";

// Rename an Item, or delete it after seeing how many Items inside it and
// Overall Ratings go with it.
export default function EditItem() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const item = useQuery(orpc.item.get.queryOptions({ input: { id } }));
  const [confirming, setConfirming] = useState(false);
  const preview = useQuery({ ...orpc.item.deletePreview.queryOptions({ input: { id } }), enabled: confirming });

  const rename = useMutation(
    orpc.item.rename.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.item.key() }),
    }),
  );
  const remove = useMutation(
    orpc.item.delete.mutationOptions({
      onSuccess: async () => {
        const { parentId, collectionId } = item.data ?? {};
        // Back to the parent, popping the deleted Item's screen.
        if (parentId) router.dismissTo({ pathname: "/items/[id]", params: { id: parentId } });
        else if (collectionId) router.dismissTo({ pathname: "/collections/[id]", params: { id: collectionId } });
        else router.dismissTo("/");
        queryClient.removeQueries({ queryKey: orpc.item.get.key({ input: { id } }) });
        await queryClient.invalidateQueries({ queryKey: orpc.item.key() });
      },
    }),
  );

  if (item.error) {
    const notFound = isDefinedError(item.error) && item.error.code === "NOT_FOUND";
    return (
      <View style={formStyles.screen}>
        <ErrorText>{notFound ? "This Item doesn't exist." : "Couldn't load this Item."}</ErrorText>
      </View>
    );
  }

  if (!item.data) {
    return (
      <View style={formStyles.screen}>
        <Text>Loading…</Text>
      </View>
    );
  }

  const { name } = item.data;

  return (
    <ScrollView contentContainerStyle={manageStyles.screen} keyboardShouldPersistTaps="handled">
      <RenameField
        key={name}
        name={name}
        saving={rename.isPending}
        error={rename.error ? errorMessage(rename.error, "Couldn't rename it.") : null}
        onSave={(newName) => rename.mutate({ id, name: newName })}
      />
      <ConfirmDelete
        title={`Delete ${name}`}
        open={confirming}
        onOpen={() => setConfirming(true)}
        onCancel={() => {
          setConfirming(false);
          remove.reset();
        }}
        description={preview.data ? describeItemDelete(preview.data) : null}
        deleting={remove.isPending}
        error={
          preview.error
            ? errorMessage(preview.error, "Couldn't check what would be deleted.")
            : remove.error
              ? errorMessage(remove.error, "Couldn't delete it.")
              : null
        }
        // The user has read the preview, so this confirms any cascade.
        onConfirm={() => remove.mutate({ id, confirmed: true })}
      />
    </ScrollView>
  );
}
