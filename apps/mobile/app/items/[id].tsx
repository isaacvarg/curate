import { isDefinedError } from "@orpc/client";
import { useQuery } from "@tanstack/react-query";
import { Link, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { type ComponentProps, Fragment } from "react";
import { Pressable, View } from "react-native";
import { AddItem, ItemList } from "@/components/items";
import { Button, Card, ErrorText, Label, Loading, Screen, Text } from "@/components/ui";
import { VerdictControl } from "@/components/verdict";
import { orpc } from "@/lib/api";
import { spacing } from "@/theme";

// An Item: its breadcrumb (Collection, then ancestors from the top Level),
// its child Items, and adding a child unless it's at the deepest Level.
export default function ItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const item = useQuery(orpc.item.get.queryOptions({ input: { id } }));
  const collectionId = item.data?.collectionId;
  const collection = useQuery({
    ...orpc.collection.get.queryOptions({ input: { id: collectionId ?? "" } }),
    enabled: collectionId !== undefined,
  });

  if (item.error || collection.error) {
    const notFound = isDefinedError(item.error) && item.error.code === "NOT_FOUND";
    return (
      <Screen>
        <ErrorText>{notFound ? "This Item doesn't exist." : "Couldn't load this Item."}</ErrorText>
      </Screen>
    );
  }

  if (!item.data || !collection.data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const { name, breadcrumb, levelId } = item.data;
  const { levels } = collection.data;
  const position = levels.findIndex((level) => level.id === levelId);
  const level = levels[position];
  // Undefined at the deepest Level, which can't have children.
  const childLevel = levels[position + 1];

  const header = (
    <>
      <Stack.Screen options={{ title: name }} />
      <View>
        <View
          style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: spacing.sm }}
          accessibilityRole="header"
        >
          {/* dismissTo pops back to the screen if it's in the stack, so going up never piles screens on. */}
          <Link dismissTo href={{ pathname: "/collections/[id]", params: { id: collection.data.id } }} asChild>
            <CrumbLink title={collection.data.name} />
          </Link>
          {breadcrumb.map((ancestor) => (
            <Fragment key={ancestor.id}>
              <Text variant="ui" tone="ink-faint" importantForAccessibility="no">
                ›
              </Text>
              <Link dismissTo href={{ pathname: "/items/[id]", params: { id: ancestor.id } }} asChild>
                <CrumbLink title={ancestor.name} />
              </Link>
            </Fragment>
          ))}
        </View>
        <Button
          variant="text"
          title="Rename or delete"
          onPress={() => router.push({ pathname: "/items/edit/[id]", params: { id } })}
        />
      </View>
      {level ? (
        <View style={{ gap: spacing.sm }}>
          <Label>{level.name}</Label>
          <Card>
            <VerdictControl itemId={id} verdict={level.overallVerdict} overallRating={item.data.overallRating} />
          </Card>
        </View>
      ) : null}
      {childLevel ? <AddItem collectionId={collection.data.id} level={childLevel} parentId={id} /> : null}
    </>
  );

  if (!childLevel) return <Screen>{header}</Screen>;
  return (
    <ItemList
      collectionId={collection.data.id}
      parentId={id}
      scale={childLevel.overallVerdict.scale}
      emptyText={`No ${childLevel.name} yet.`}
      header={header}
    />
  );
}

// One step up the breadcrumb, at least 44pt tall.
function CrumbLink({ title, ...props }: { title: string } & Omit<ComponentProps<typeof Pressable>, "children">) {
  return (
    <Pressable
      accessibilityRole="link"
      {...props}
      style={{ minHeight: spacing["touch-target-min"], justifyContent: "center" }}
    >
      <Text variant="ui" tone="ink-muted" style={{ textDecorationLine: "underline" }}>
        {title}
      </Text>
    </Pressable>
  );
}
