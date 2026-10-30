import type { Field } from "@repo/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ConfirmDelete } from "@/components/manage";
import { api, orpc, queryClient } from "@/lib/api";
import { describeFieldDelete } from "@/lib/delete-preview";
import { errorMessage } from "@/lib/errors";

// Deletes a Field, or one saved choice option of it (`option`), in two steps:
// the preview with its counts comes first, and nothing goes until the user
// confirms it. Removing an option stays on the editor, which restarts from
// the saved Attribute.
export function FieldDelete({
  field,
  option,
  onCancel,
}: {
  field: Field;
  option?: { id: string; label: string };
  // Given for an option, whose confirmation opens from its row; the Field's
  // own delete opens from the button below the editor.
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(option !== undefined);
  const input = { id: field.id, optionId: option?.id };
  const preview = useQuery({ ...orpc.field.deletePreview.queryOptions({ input }), enabled: confirming });

  const remove = useMutation({
    mutationFn: () => api.field.delete({ ...input, confirmed: true }),
    onSuccess: async () => {
      if (!option) router.back();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: orpc.field.key() }),
        queryClient.invalidateQueries({ queryKey: orpc.item.key() }),
      ]);
      onCancel?.();
    },
  });

  const what = option ? "option" : field.kind;
  const name = option ? `option “${option.label}”` : field.name;

  return (
    <ConfirmDelete
      title={`Delete ${name}`}
      open={confirming}
      onOpen={() => setConfirming(true)}
      onCancel={() => {
        setConfirming(false);
        remove.reset();
        onCancel?.();
      }}
      description={preview.data ? describeFieldDelete(preview.data, what) : null}
      deleting={remove.isPending}
      error={
        preview.error
          ? errorMessage(preview.error, { fallback: "Couldn't check what would be deleted." })
          : remove.error
            ? errorMessage(remove.error, { fallback: "Couldn't delete it." })
            : null
      }
      // The user has read the preview, so this is their confirmation.
      onConfirm={() => remove.mutate()}
    />
  );
}
