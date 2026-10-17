import { isDefinedError } from "@orpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { ErrorText, formStyles } from "@/components/form";
import { ConfirmDelete, manageStyles, RenameField } from "@/components/manage";
import { errorMessage } from "@/lib/errors";
import { orpc, queryClient } from "@/lib/api";
import { describeCollectionDelete } from "@/lib/delete-preview";

// Rename a Collection, or delete it after seeing how many Items and Overall
// Ratings go with it.
export default function EditCollection() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const collection = useQuery(orpc.collection.get.queryOptions({ input: { id } }));
  const [confirming, setConfirming] = useState(false);
  const preview = useQuery({ ...orpc.collection.deletePreview.queryOptions({ input: { id } }), enabled: confirming });

  const rename = useMutation(
    orpc.collection.rename.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.collection.key() }),
    }),
  );
  const remove = useMutation(
    orpc.collection.delete.mutationOptions({
      onSuccess: async () => {
        router.dismissTo("/");
        queryClient.removeQueries({ queryKey: orpc.collection.get.key({ input: { id } }) });
        await queryClient.invalidateQueries({ queryKey: orpc.collection.key() });
      },
    }),
  );

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

  const { name } = collection.data;

  return (
    <ScrollView contentContainerStyle={manageStyles.screen} keyboardShouldPersistTaps="handled">
      <RenameField
        key={name}
        name={name}
        saving={rename.isPending}
        error={
          rename.error ? errorMessage(rename.error, { fallback: "Couldn't rename it.", badRequest: "Give it a name." }) : null
        }
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
        description={preview.data ? describeCollectionDelete(preview.data) : null}
        deleting={remove.isPending}
        error={
          preview.error
            ? errorMessage(preview.error, { fallback: "Couldn't check what would be deleted." })
            : remove.error
              ? errorMessage(remove.error, { fallback: "Couldn't delete it." })
              : null
        }
        // The user has read the preview, so this is their confirmation.
        onConfirm={() => remove.mutate({ id, confirmed: true })}
      />
    </ScrollView>
  );
}
