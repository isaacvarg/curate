import { ORPCError } from "@orpc/client";
import type { Expression, ItemSearchSort } from "@repo/shared";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ConditionBuilder } from "@/components/condition-builder";
import {
  Button,
  CardList,
  EmptyText,
  ErrorText,
  Hint,
  ListRow,
  Loading,
  Screen,
  Section,
  SegmentedControl,
  SingleChoice,
} from "@/components/ui";
import { api, orpc } from "@/lib/api";
import { sortChoices, sortFor } from "@/lib/item-search";
import { formatVerdict } from "@/lib/verdict";

const PAGE_SIZE = 50;

// Browse one Level of a Collection: every Item at the Level, under every parent, narrowed by a
// filter (the condition builder in the filter profile) and ordered by a sort. Rating and Verdict
// filters and sorts always use the caller's own ratings.
export default function BrowseLevel() {
  const { id, collectionId } = useLocalSearchParams<{ id: string; collectionId: string }>();
  const collection = useQuery(orpc.collection.get.queryOptions({ input: { id: collectionId } }));
  const fields = useQuery(orpc.field.list.queryOptions({ input: { levelId: id } }));
  const level = collection.data?.levels.find((l) => l.id === id);

  if (collection.error || fields.error || (collection.data && !level)) {
    return (
      <>
        <Stack.Screen options={{ title: "Browse" }} />
        <Screen>
          <ErrorText>Couldn't load this Level.</ErrorText>
        </Screen>
      </>
    );
  }
  if (!collection.data || !level || !fields.data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: level.name }} />
      <Results
        collectionId={collectionId}
        levelId={id}
        levelName={level.name}
        verdict={level.overallVerdict}
        fields={fields.data}
      />
    </>
  );
}

function Results({
  collectionId,
  levelId,
  levelName,
  verdict,
  fields,
}: {
  collectionId: string;
  levelId: string;
  levelName: string;
  verdict: { name: string; scale: Parameters<typeof formatVerdict>[0] };
  fields: Parameters<typeof sortChoices>[0];
}) {
  // The builder's complete tree so far, and the one the results use, which changes on Apply.
  const [draft, setDraft] = useState<Expression | null>(null);
  const [filter, setFilter] = useState<Expression | null>(null);
  const [builderKey, setBuilderKey] = useState(0);
  const [sortChoice, setSortChoice] = useState<string | null>(null);
  const [direction, setDirection] = useState<ItemSearchSort["direction"]>("asc");

  const choices = useMemo(() => sortChoices(fields, verdict.name), [fields, verdict.name]);
  const sort = sortFor(sortChoice, direction);
  const level = useMemo(() => ({ fields, verdict }), [fields, verdict]);

  const search = useInfiniteQuery({
    queryKey: ["item", "browse", collectionId, levelId, filter, sort],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api.item.search({
        collectionId,
        levelId,
        ...(filter ? { filter } : {}),
        ...(sort ? { sort } : {}),
        limit: PAGE_SIZE,
        offset: pageParam,
      }),
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((count, page) => count + page.items.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
  });
  const items = search.data?.pages.flatMap((page) => page.items);
  const total = search.data?.pages[0]?.total;

  const error = search.error;
  const message = !error
    ? null
    : error instanceof ORPCError && error.defined && (error.code === "INVALID_FILTER" || error.code === "INVALID_SORT")
      ? error.message
      : "Couldn't load these Items.";

  const header = (
    <>
      <Section title="Filter">
        <ConditionBuilder
          key={builderKey}
          level={level}
          profile="filter"
          onChange={setDraft}
        />
        <Button
          title="Apply filter"
          disabled={draft === null || JSON.stringify(draft) === JSON.stringify(filter)}
          onPress={() => setFilter(draft)}
        />
        {filter ? (
          <Button
            variant="secondary"
            title="Clear filter"
            onPress={() => {
              setFilter(null);
              setDraft(null);
              setBuilderKey((key) => key + 1);
            }}
          />
        ) : null}
      </Section>
      <Section title="Sort">
        <SingleChoice
          label="Sort by"
          options={choices.map((c) => ({ value: c.value, label: c.label }))}
          value={sortChoice}
          onChange={setSortChoice}
        />
        <SegmentedControl<ItemSearchSort["direction"]>
          label="Order"
          value={direction}
          onChange={setDirection}
          options={[
            { value: "asc", label: "Ascending" },
            { value: "desc", label: "Descending" },
          ]}
        />
        <Hint>Items with nothing to sort by come last.</Hint>
      </Section>
      <Section title={levelName}>
        {total !== undefined ? <Hint>{total === 1 ? "1 match" : `${total} matches`}</Hint> : null}
        <ErrorText>{message}</ErrorText>
      </Section>
    </>
  );

  return (
    <CardList
      data={error && !items ? [] : items}
      keyExtractor={(item) => item.id}
      header={header}
      placeholder={<Loading />}
      empty={<EmptyText>{filter ? "No Items match this filter." : "Nothing here yet."}</EmptyText>}
      renderRow={(item, position) => (
        <Link href={{ pathname: "/items/[id]", params: { id: item.id } }} asChild>
          <ListRow
            title={item.name}
            detail={item.overallRating?.verdict != null ? formatVerdict(verdict.scale, item.overallRating.verdict) : undefined}
            {...position}
          />
        </Link>
      )}
      footer={
        search.hasNextPage ? (
          <Button
            variant="secondary"
            title={search.isFetchingNextPage ? "Loading…" : "Show more"}
            disabled={search.isFetchingNextPage}
            onPress={() => search.fetchNextPage()}
          />
        ) : undefined
      }
    />
  );
}
