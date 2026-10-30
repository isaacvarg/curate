import { isDefinedError } from "@orpc/client";
import type { AttributeField, FieldValue } from "@repo/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { View } from "react-native";
import {
  Button,
  DateInput,
  EmptyText,
  ErrorText,
  Label,
  Loading,
  MultipleChoice,
  NumberInput,
  SegmentedControl,
  SingleChoice,
  TextField,
} from "@/components/ui";
import { orpc, queryClient } from "@/lib/api";
import {
  changedValues,
  formatIsoDate,
  parseIsoDate,
  toValueDraft,
  type ValueDraft,
} from "@/lib/attribute";
import { errorMessage } from "@/lib/errors";
import { spacing } from "@/theme";

// An Item's Attributes: every Attribute configured at its Level, filled in
// here. The values belong to the Item, so every Collection Member sees the
// same ones. (Conditions arrive later; for now every Attribute is shown.)
export function ItemAttributes({
  itemId,
  levelId,
  values,
}: {
  itemId: string;
  levelId: string;
  values: Record<string, FieldValue>;
}) {
  const fields = useQuery(orpc.field.list.queryOptions({ input: { levelId } }));

  if (fields.error) return <ErrorText>Couldn't load the Attributes.</ErrorText>;
  if (!fields.data) return <Loading />;
  const attributes = fields.data.filter((field): field is AttributeField => field.kind === "attribute");
  if (attributes.length === 0) return <EmptyText>No Attributes yet. Add them in the Level's settings.</EmptyText>;

  // Keyed by what was saved and how the Attributes are set up, so the drafts
  // reset once a save (or a settings change) lands.
  return <AttributesForm key={JSON.stringify([attributes, values])} itemId={itemId} fields={attributes} saved={values} />;
}

function AttributesForm({
  itemId,
  fields,
  saved,
}: {
  itemId: string;
  fields: AttributeField[];
  saved: Record<string, FieldValue>;
}) {
  const [drafts, setDrafts] = useState<Record<string, ValueDraft>>(() =>
    Object.fromEntries(fields.map((field) => [field.id, toValueDraft(field, saved[field.id])])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = useMutation(
    orpc.item.setAttributes.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.item.key() }),
    }),
  );

  const change = changedValues(fields, saved, drafts);
  const pending = "values" in change ? change.values : {};
  const dirty = Object.keys(pending).length > 0;

  const edit = (fieldId: string, draft: ValueDraft) => {
    setDrafts((current) => ({ ...current, [fieldId]: draft }));
    setErrors((current) => ({ ...current, [fieldId]: "" }));
  };

  const save = () => {
    if ("errors" in change) {
      setErrors(change.errors);
      return;
    }
    set.mutate({ itemId, values: pending });
  };

  // The server names the Attribute it rejected; show its message there.
  const rejected = isDefinedError(set.error) && set.error.code === "INVALID_VALUE" ? set.error.data : null;
  const generalError =
    set.error && !rejected ? errorMessage(set.error, { fallback: "Couldn't save the Attributes." }) : null;

  return (
    <View style={{ gap: spacing.lg }}>
      {fields.map((field) => (
        <AttributeControl
          key={field.id}
          field={field}
          draft={drafts[field.id] ?? null}
          error={errors[field.id] || (rejected?.fieldId === field.id ? rejected.message : null)}
          disabled={set.isPending}
          onChange={(draft) => edit(field.id, draft)}
        />
      ))}
      <ErrorText>{generalError}</ErrorText>
      {dirty || "errors" in change ? (
        <Button title={set.isPending ? "Saving…" : "Save Attributes"} disabled={set.isPending} onPress={save} />
      ) : null}
    </View>
  );
}

type YesNoChoice = "unset" | "yes" | "no";

// The control for one Attribute, picked by its type.
function AttributeControl({
  field,
  draft,
  error,
  disabled,
  onChange,
}: {
  field: AttributeField;
  draft: ValueDraft;
  error: string | null;
  disabled: boolean;
  onChange: (draft: ValueDraft) => void;
}) {
  const { config, name } = field;
  let control: ReactNode;

  switch (config.type) {
    case "text":
      control = <TextField label={name} value={String(draft ?? "")} onChangeText={onChange} editable={!disabled} />;
      break;
    case "number":
      control = (
        <NumberInput label={name} unit={config.unit} value={String(draft ?? "")} onChangeText={onChange} />
      );
      break;
    case "singleChoice":
      control = (
        <View style={{ gap: spacing.sm }}>
          <Label>{name}</Label>
          <SingleChoice
            label={name}
            options={config.options.map((option) => ({ value: option.id, label: option.label }))}
            value={typeof draft === "string" ? draft : null}
            onChange={onChange}
            disabled={disabled}
          />
          {draft !== null ? (
            <Button variant="text" title="Clear" accessibilityLabel={`Clear ${name}`} onPress={() => onChange(null)} />
          ) : null}
        </View>
      );
      break;
    case "multipleChoice":
      control = (
        <View style={{ gap: spacing.sm }}>
          <Label>{name}</Label>
          <MultipleChoice
            label={name}
            options={config.options.map((option) => ({ value: option.id, label: option.label }))}
            values={Array.isArray(draft) ? draft : []}
            onChange={onChange}
            disabled={disabled}
          />
        </View>
      );
      break;
    case "yesNo": {
      const choice: YesNoChoice = draft === true ? "yes" : draft === false ? "no" : "unset";
      control = (
        <View style={{ gap: spacing.sm }}>
          <Label>{name}</Label>
          <SegmentedControl<YesNoChoice>
            label={name}
            options={[
              { value: "unset", label: "Not set" },
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
            ]}
            value={choice}
            onChange={(next) => onChange(next === "unset" ? null : next === "yes")}
            disabled={disabled}
          />
        </View>
      );
      break;
    }
    case "date": {
      const date = typeof draft === "string" ? parseIsoDate(draft) : null;
      control = (
        <View style={{ gap: spacing.xs }}>
          <DateInput label={name} value={date} onChange={(next) => onChange(formatIsoDate(next))} />
          {date ? (
            <Button variant="text" title="Clear" accessibilityLabel={`Clear ${name}`} onPress={() => onChange("")} />
          ) : null}
        </View>
      );
      break;
    }
  }

  return (
    <View style={{ gap: spacing.xs }}>
      {control}
      <ErrorText>{error}</ErrorText>
    </View>
  );
}
