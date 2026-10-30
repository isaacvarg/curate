import { ORPCError } from "@orpc/client";
import type { AttributeField } from "@repo/shared";
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
import { attributeTypes, moveItem } from "@/lib/attribute";
import { errorMessage } from "@/lib/errors";
import { describeScale } from "@/lib/verdict-settings";
import { spacing } from "@/theme";

// A Level's Fields: the Verdict at the top (always there, never an Attribute),
// then the Level's Attributes, which can be added, opened to edit, and
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

  const attributes = fields.data.filter((f): f is AttributeField => f.kind === "attribute");
  const move = (index: number, direction: 1 | -1) =>
    reorder.mutate({ levelId: id, ids: moveItem(attributes, index, direction).map((f) => f.id) });

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

      <Section title="Attributes">
        <Hint>Facts that describe each {level.name}, such as a Network or an Air date. Every Collection Member sees the same values.</Hint>
        {attributes.length === 0 ? (
          <EmptyText>No Attributes yet.</EmptyText>
        ) : reordering ? (
          <Card padded={false}>
            {attributes.map((field, index) => (
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
                  disabled={index === 0 || reorder.isPending}
                  onPress={() => move(index, -1)}
                />
                <IconButton
                  icon={ChevronDown}
                  label={`Move ${field.name} down`}
                  disabled={index === attributes.length - 1 || reorder.isPending}
                  onPress={() => move(index, 1)}
                />
              </View>
            ))}
          </Card>
        ) : (
          <View>
            {attributes.map((field, index) => (
              <Link
                key={field.id}
                href={{ pathname: "/fields/[id]", params: { id: field.id, levelId: id } }}
                asChild
              >
                <ListRow
                  title={field.name}
                  detail={attributeTypes.find((t) => t.value === field.config.type)?.label}
                  first={index === 0}
                  last={index === attributes.length - 1}
                />
              </Link>
            ))}
          </View>
        )}
        <ErrorText>{reorder.error ? errorMessage(reorder.error, { fallback: "Couldn't reorder them." }) : null}</ErrorText>
        {attributes.length > 1 ? (
          <Button
            variant="text"
            title={reordering ? "Done reordering" : "Reorder"}
            onPress={() => setReordering((current) => !current)}
          />
        ) : null}
        <Button
          variant="secondary"
          title="Add Attribute"
          onPress={() => router.push({ pathname: "/fields/new", params: { levelId: id } })}
        />
      </Section>
    </Screen>
  );
}
