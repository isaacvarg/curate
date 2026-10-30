import { ORPCError, isDefinedError } from "@orpc/client";
import type { RatingScale } from "@repo/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { type ReactNode, useState } from "react";
import { Button, CardList, EmptyText, ErrorText, ListRow, Loading, Section, TextField } from "@/components/ui";
import { orpc, queryClient } from "@/lib/api";
import { formatVerdict } from "@/lib/verdict";

// The Items in a Collection under one parent, or at the top Level when there's
// no parent, in sort key order, each with the caller's Verdict on `scale` (the
// Items' Level's Overall Verdict scale). Each row opens the Item screen. The
// list is the screen's scroll view, with the rest of the screen in `header`.
export function ItemList({
  collectionId,
  parentId,
  scale,
  emptyText,
  header,
}: {
  collectionId: string;
  parentId?: string;
  scale: RatingScale;
  emptyText: string;
  header: ReactNode;
}) {
  const items = useQuery(orpc.item.list.queryOptions({ input: { collectionId, parentId } }));

  return (
    <CardList
      data={items.data}
      keyExtractor={(item) => item.id}
      header={header}
      placeholder={items.error ? <ErrorText>Couldn't load these Items.</ErrorText> : <Loading />}
      empty={<EmptyText>{emptyText}</EmptyText>}
      renderRow={(item, position) => (
        <Link href={{ pathname: "/items/[id]", params: { id: item.id } }} asChild>
          <ListRow
            title={item.name}
            detail={item.overallRating ? formatVerdict(scale, item.overallRating.verdict) : undefined}
            {...position}
          />
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
    <Section>
      <TextField placeholder={`New ${level.name}`} value={name} onChangeText={setName} />
      <ErrorText>{create.error ? createErrorMessage(create.error) : null}</ErrorText>
      <Button
        title={create.isPending ? "Adding…" : `Add ${level.name}`}
        onPress={() => create.mutate({ collectionId, levelId: level.id, parentId, name })}
        disabled={create.isPending}
      />
    </Section>
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
