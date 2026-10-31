import { ORPCError } from "@orpc/client";
import { type AttributeField, describeCondition, type Field, type FieldKind, type RatingField } from "@repo/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import {
  Button,
  Card,
  EmptyText,
  ErrorText,
  Hint,
  IconButton,
  ListRow,
  Loading,
  Screen,
  Section,
  Text,
} from "@/components/ui";
import { orpc, queryClient } from "@/lib/api";
import { attributeTypes } from "@/lib/attribute";
import { errorMessage } from "@/lib/errors";
import { moveItem, orderAfterMove } from "@/lib/order";
import { describeScale } from "@/lib/verdict-settings";
import { spacing } from "@/theme";

// A Level's Fields: the Verdict at the top (always there, never a Field), then
// its Rating fields and its Attributes, which can be added, opened to edit, and
// reordered.
export default function LevelFields() {
  const { id, collectionId } = useLocalSearchParams<{ id: string; collectionId: string }>();
  const router = useRouter();
  const collection = useQuery(orpc.collection.get.queryOptions({ input: { id: collectionId } }));
  const fields = useQuery(orpc.field.list.queryOptions({ input: { levelId: id } }));
  const [reordering, setReordering] = useState(false);
  const reorder = useMutation(
    orpc.field.reorder.mutationOptions({ onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.field.key() }) }),
  );

  if (collection.error || fields.error) {
    const notFound = [collection.error, fields.error].some(
      (e) => e instanceof ORPCError && e.defined && e.code === "NOT_FOUND",
    );
    return (
      <Screen>
        <ErrorText>{notFound ? "This Level doesn't exist." : "Couldn't load this Level."}</ErrorText>
      </Screen>
    );
  }
  const level = collection.data?.levels.find((l) => l.id === id);
  if (!collection.data || !fields.data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  if (!level) {
    return (
      <Screen>
        <ErrorText>This Level doesn't exist.</ErrorText>
      </Screen>
    );
  }

  const all = fields.data;
  const attributes = all.filter((f): f is AttributeField => f.kind === "attribute");
  const ratingFields = all.filter((f): f is RatingField => f.kind === "rating");
  // Reordering moves a field among those of its own kind; field.reorder wants
  // every Field at the Level, so the other kind keeps its slots.
  const move = (kind: FieldKind, index: number, direction: 1 | -1) =>
    reorder.mutate({ levelId: id, ids: orderAfterMove(all, kind, index, direction) });

  return (
    <Screen>
      <Stack.Screen options={{ title: `${level.name} fields` }} />
      <Section title="Verdict">
        <Card>
          <Text variant="ui-strong">{level.overallVerdict.name}</Text>
          <Hint>{describeScale(level.overallVerdict.scale)}. Every Item gets one, and it can't be removed.</Hint>
          <Button
            variant="text"
            title="Edit Verdict"
            onPress={() => router.push({ pathname: "/collections/levels/[id]", params: { id: collectionId } })}
          />
        </Card>
      </Section>

      <Section title="Rating fields">
        <Hint>
          Aspects to rate on the Overall Rating, such as Plot or Hype, each on its own scale. Each Collection Member
          rates for themself.
        </Hint>
        <FieldList
          kind="rating"
          fields={ratingFields}
          allFields={all}
          levelId={id}
          emptyText="No Rating fields yet."
          detail={(field) => describeScale(field.scale)}
          reordering={reordering}
          busy={reorder.isPending}
          onMove={move}
        />
        <Button
          variant="secondary"
          title="Add Rating field"
          onPress={() => router.push({ pathname: "/fields/new", params: { levelId: id, kind: "rating" } })}
        />
      </Section>

      <Section title="Attributes">
        <Hint>Facts that describe each {level.name}, such as a Network or an Air date. Every Collection Member sees the same values.</Hint>
        <FieldList
          kind="attribute"
          fields={attributes}
          allFields={all}
          levelId={id}
          emptyText="No Attributes yet."
          detail={(field) => attributeTypes.find((t) => t.value === field.config.type)?.label}
          reordering={reordering}
          busy={reorder.isPending}
          onMove={move}
        />
        <Button
          variant="secondary"
          title="Add Attribute"
          onPress={() => router.push({ pathname: "/fields/new", params: { levelId: id } })}
        />
      </Section>

      <ErrorText>{reorder.error ? errorMessage(reorder.error, { fallback: "Couldn't reorder them." }) : null}</ErrorText>
      {attributes.length > 1 || ratingFields.length > 1 ? (
        <Button
          variant="text"
          title={reordering ? "Done reordering" : "Reorder"}
          onPress={() => setReordering((current) => !current)}
        />
      ) : null}
    </Screen>
  );
}

// One kind of Field at the Level: rows that open the field to edit, or, while
// reordering, rows with up and down buttons.
function FieldList<T extends Field>({
  kind,
  fields,
  allFields,
  levelId,
  emptyText,
  detail,
  reordering,
  busy,
  onMove,
}: {
  kind: FieldKind;
  fields: T[];
  // Every Field at the Level, which a condition's summary names.
  allFields: Field[];
  levelId: string;
  emptyText: string;
  detail: (field: T) => string | undefined;
  reordering: boolean;
  busy: boolean;
  onMove: (kind: FieldKind, index: number, direction: 1 | -1) => void;
}) {
  if (fields.length === 0) return <EmptyText>{emptyText}</EmptyText>;
  if (reordering) {
    return (
      <Card padded={false}>
        {fields.map((field, index) => (
          <View
            key={field.id}
            style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md }}
          >
            <Text variant="body" style={{ flex: 1 }}>
              {field.name}
            </Text>
            <IconButton
              icon={ChevronUp}
              label={`Move ${field.name} up`}
              disabled={index === 0 || busy}
              onPress={() => onMove(kind, index, -1)}
            />
            <IconButton
              icon={ChevronDown}
              label={`Move ${field.name} down`}
              disabled={index === fields.length - 1 || busy}
              onPress={() => onMove(kind, index, 1)}
            />
          </View>
        ))}
      </Card>
    );
  }
  return (
    <View>
      {fields.map((field, index) => (
        <Link key={field.id} href={{ pathname: "/fields/[id]", params: { id: field.id, levelId } }} asChild>
          <ListRow
            title={field.name}
            detail={detail(field)}
            subtitle={field.condition === undefined ? undefined : describeCondition(field.condition, allFields)}
            first={index === 0} last={index === fields.length - 1} />
        </Link>
      ))}
    </View>
  );
}
