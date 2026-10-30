import { describeCondition, type Expression, type ExpressionLevel, type ExpressionProfile } from "@repo/shared";
import { X } from "lucide-react-native";
import { useMemo, useState } from "react";
import { View } from "react-native";
import {
  Button,
  Card,
  DateInput,
  Hint,
  IconButton,
  Label,
  MultipleChoice,
  NumberInput,
  SegmentedControl,
  SingleChoice,
  Text,
  TextField,
} from "@/components/ui";
import {
  type BuilderState,
  buildCondition,
  emptyRow,
  operatorsFor,
  parseCondition,
  type RowDraft,
  type Subject,
  subjectsFor,
  valueInputFor,
} from "@/lib/condition-builder";
import { formatIsoDate, parseIsoDate } from "@/lib/attribute";
import { spacing } from "@/theme";

const noExclusions: readonly string[] = [];

export type ConditionBuilderProps = {
  // What the rows can refer to: the Level's Fields and its Verdict.
  level: ExpressionLevel;
  // "condition" offers Attributes only; "filter" also Rating fields and the Verdict.
  profile: ExpressionProfile;
  // The stored tree being edited, or nothing for a new one. Read once, when the builder mounts:
  // key the builder by the saved tree to start again from it.
  value?: unknown;
  // Called after every edit with the tree the rows now make, or null while there are no rows or any
  // is incomplete. Never called for a tree shown read-only.
  onChange: (expression: Expression | null) => void;
  // Subjects the rows must not offer, by key ("attribute:<id>"); a field's own condition leaves
  // itself out.
  exclude?: readonly string[];
  disabled?: boolean;
};

// Rows of [subject] [operator] [value] under all of / any of, one level only. It builds the
// Expression of ADR 0002 for conditions and, with `profile="filter"`, for filters. A stored tree
// the rows can't represent is shown as read-only text with a note and is never rewritten.
export function ConditionBuilder({ level, profile, value, onChange, exclude = noExclusions, disabled }: ConditionBuilderProps) {
  const subjects = useMemo(
    () => subjectsFor(level, profile).filter((s) => !exclude.includes(s.key)),
    [level, profile, exclude],
  );
  const [initial] = useState(() => (value == null ? { mode: "allOf" as const, rows: [emptyRow] } : parseCondition(value, subjects)));
  const [state, setState] = useState<BuilderState | null>(initial);

  if (state === null) {
    return (
      <Card>
        <Text variant="body">{describeCondition(value, level.fields)}</Text>
        <Hint>
          This condition is more complex than the builder can show, so it is read-only here. It is kept as it is when
          you save other changes.
        </Hint>
      </Card>
    );
  }

  const update = (next: BuilderState) => {
    setState(next);
    onChange(buildCondition(next, subjects));
  };
  const setRow = (index: number, row: RowDraft) =>
    update({ ...state, rows: state.rows.map((r, i) => (i === index ? row : r)) });

  return (
    <View style={{ gap: spacing.md }}>
      <SegmentedControl<BuilderState["mode"]>
        label="Match"
        value={state.mode}
        onChange={(mode) => update({ ...state, mode })}
        options={[
          { value: "allOf", label: "All of" },
          { value: "anyOf", label: "Any of" },
        ]}
        disabled={disabled}
      />
      {state.rows.map((row, index) => (
        <ConditionRow
          // Rows have no identity beyond their place in the list.
          key={index}
          row={row}
          subjects={subjects}
          disabled={disabled}
          onChange={(next) => setRow(index, next)}
          onRemove={state.rows.length > 1 ? () => update({ ...state, rows: state.rows.filter((_, i) => i !== index) }) : undefined}
        />
      ))}
      <Button
        variant="secondary"
        title="Add row"
        disabled={disabled}
        onPress={() => update({ ...state, rows: [...state.rows, emptyRow] })}
      />
    </View>
  );
}

function ConditionRow({
  row,
  subjects,
  disabled,
  onChange,
  onRemove,
}: {
  row: RowDraft;
  subjects: Subject[];
  disabled?: boolean;
  onChange: (row: RowDraft) => void;
  onRemove?: () => void;
}) {
  const subject = subjects.find((s) => s.key === row.subject);
  const operators = subject ? operatorsFor(subject) : [];
  const input = subject && row.operator ? valueInputFor(subject, row.operator) : "none";

  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Label>Row</Label>
        {onRemove ? <IconButton icon={X} label="Remove row" onPress={onRemove} disabled={disabled} /> : null}
      </View>
      <SingleChoice
        label="Field"
        options={subjects.map((s) => ({ value: s.key, label: s.name }))}
        value={row.subject}
        // A new subject starts the row over: its operators and values are different.
        onChange={(key) => key !== row.subject && onChange({ ...emptyRow, subject: key })}
        disabled={disabled}
      />
      {subject ? (
        <SingleChoice
          label="Operator"
          options={operators}
          value={row.operator}
          onChange={(operator) => onChange({ ...row, operator, value: "", optionIds: [] })}
          disabled={disabled}
        />
      ) : null}
      {subject && row.operator ? (
        <ValueInput subject={subject} kind={input} row={row} disabled={disabled} onChange={onChange} />
      ) : null}
    </Card>
  );
}

function ValueInput({
  subject,
  kind,
  row,
  disabled,
  onChange,
}: {
  subject: Subject;
  kind: ReturnType<typeof valueInputFor>;
  row: RowDraft;
  disabled?: boolean;
  onChange: (row: RowDraft) => void;
}) {
  const options = subject.options.map((o) => ({ value: o.id, label: o.label }));
  switch (kind) {
    case "none":
      return null;
    case "option":
      return (
        <SingleChoice
          label={`${subject.name} value`}
          options={options}
          value={row.optionIds[0] ?? null}
          onChange={(id) => onChange({ ...row, optionIds: [id] })}
          disabled={disabled}
        />
      );
    case "options":
      return (
        <MultipleChoice
          label={`${subject.name} values`}
          options={options}
          values={row.optionIds}
          onChange={(optionIds) => onChange({ ...row, optionIds })}
          disabled={disabled}
        />
      );
    case "label":
      return (
        <SingleChoice
          label={`${subject.name} value`}
          options={options}
          value={row.value === "" ? null : row.value}
          onChange={(value) => onChange({ ...row, value })}
          disabled={disabled}
        />
      );
    case "number":
      return (
        <NumberInput
          label="Value"
          unit={subject.unit}
          value={row.value}
          onChangeText={(value) => onChange({ ...row, value })}
        />
      );
    case "text":
      return <TextField label="Value" value={row.value} onChangeText={(value) => onChange({ ...row, value })} />;
    case "date":
      return (
        <DateInput
          label="Date"
          value={row.value === "" ? null : parseIsoDate(row.value)}
          onChange={(date) => onChange({ ...row, value: formatIsoDate(date) })}
        />
      );
  }
}
