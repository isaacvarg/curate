import { isDefinedError } from "@orpc/client";
import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { FieldEditor } from "@/components/field-editor";
import { RatingFieldEditor } from "@/components/rating-field-editor";
import { ErrorText, Loading, Screen } from "@/components/ui";
import { orpc } from "@/lib/api";

// Edits one Attribute or Rating field of the Level named in the route.
export default function EditField() {
  const { id, levelId } = useLocalSearchParams<{ id: string; levelId: string }>();
  const fields = useQuery(orpc.field.list.queryOptions({ input: { levelId } }));
  const field = fields.data?.find((f) => f.id === id);

  if (fields.error) {
    const notFound = isDefinedError(fields.error) && fields.error.code === "NOT_FOUND";
    return (
      <Screen>
        <ErrorText>{notFound ? "This Level doesn't exist." : "Couldn't load this field."}</ErrorText>
      </Screen>
    );
  }
  if (!fields.data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  if (!field) {
    return (
      <Screen>
        <ErrorText>This field doesn't exist.</ErrorText>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: field.name }} />
      {/* Keyed by the saved field, so the editor starts again from what was saved. */}
      {field.kind === "rating" ? (
        <RatingFieldEditor key={JSON.stringify(field)} levelId={levelId} field={field} />
      ) : (
        <FieldEditor key={JSON.stringify(field)} levelId={levelId} field={field} />
      )}
    </Screen>
  );
}
