import { ORPCError } from "@orpc/client";
import { defaultVerdict, type Expression, type Field } from "@repo/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ConditionBuilder } from "@/components/condition-builder";
import { Button, ErrorText, Hint, Loading, Section } from "@/components/ui";
import { api, orpc, queryClient } from "@/lib/api";
import { conditionProblem } from "@/lib/condition-builder";
import { errorMessage } from "@/lib/errors";

// A saved Field's condition: "only show this when …". It saves on its own, apart from the field's
// other settings, through setCondition and clearCondition. A tree the builder can't show stays
// read-only and is only ever replaced by Clear.
export function FieldCondition({ levelId, field }: { levelId: string; field: Field }) {
  const fields = useQuery(orpc.field.list.queryOptions({ input: { levelId } }));
  // Null until the rows make a complete condition; undefined until the user edits.
  const [draft, setDraft] = useState<Expression | null | undefined>(undefined);

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: orpc.field.key() }),
      queryClient.invalidateQueries({ queryKey: orpc.item.key() }),
    ]);
  const save = useMutation({
    mutationFn: (condition: Expression) => api.field.setCondition({ id: field.id, condition }),
    onSuccess: refresh,
  });
  const clear = useMutation({ mutationFn: () => api.field.clearCondition({ id: field.id }), onSuccess: refresh });

  if (!fields.data) return <Section title="Condition">{fields.error ? <ErrorText>Couldn't load the Level's fields.</ErrorText> : <Loading />}</Section>;

  const error = save.error ?? clear.error;
  const message =
    error instanceof ORPCError && error.defined
      ? (conditionProblem(error.code, error.data) ?? error.message)
      : error
        ? errorMessage(error, { fallback: "Couldn't save the condition." })
        : null;

  return (
    <Section title="Condition">
      <Hint>
        Show this field only for Items whose Attributes meet the condition. Its values are kept when it is hidden.
      </Hint>
      <ConditionBuilder
        // Starts again from what was saved.
        key={JSON.stringify(field.condition ?? null)}
        // Conditions read Attributes only, so the Verdict given here is never used.
        level={{ fields: fields.data, verdict: defaultVerdict }}
        profile="condition"
        value={field.condition}
        exclude={field.kind === "attribute" ? [`attribute:${field.id}`] : undefined}
        disabled={save.isPending || clear.isPending}
        onChange={(next) => {
          save.reset();
          clear.reset();
          setDraft(next);
        }}
      />
      <ErrorText>{message}</ErrorText>
      {draft ? <Button title={save.isPending ? "Saving…" : "Save condition"} disabled={save.isPending} onPress={() => save.mutate(draft)} /> : null}
      {field.condition !== undefined ? (
        <Button variant="secondary" title="Clear condition" disabled={clear.isPending} onPress={() => clear.mutate()} />
      ) : null}
    </Section>
  );
}
