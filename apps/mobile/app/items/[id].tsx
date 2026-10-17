import { isDefinedError } from "@orpc/client";
import { useQuery } from "@tanstack/react-query";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import { Fragment } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ErrorText, formStyles } from "@/components/form";
import { AddItem, ItemList } from "@/components/items";
import { VerdictControl } from "@/components/verdict";
import { orpc } from "@/lib/api";

// An Item: its breadcrumb (Collection, then ancestors from the top Level),
// its child Items, and adding a child unless it's at the deepest Level.
export default function ItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = useQuery(orpc.item.get.queryOptions({ input: { id } }));
  const collectionId = item.data?.collectionId;
  const collection = useQuery({
    ...orpc.collection.get.queryOptions({ input: { id: collectionId ?? "" } }),
    enabled: collectionId !== undefined,
  });

  if (item.error || collection.error) {
    const notFound = isDefinedError(item.error) && item.error.code === "NOT_FOUND";
    return (
      <View style={formStyles.screen}>
        <ErrorText>{notFound ? "This Item doesn't exist." : "Couldn't load this Item."}</ErrorText>
      </View>
    );
  }

  if (!item.data || !collection.data) {
    return (
      <View style={formStyles.screen}>
        <Text>Loading…</Text>
      </View>
    );
  }

  const { name, breadcrumb, levelId } = item.data;
  const { levels } = collection.data;
  const position = levels.findIndex((level) => level.id === levelId);
  const level = levels[position];
  // Undefined at the deepest Level, which can't have children.
  const childLevel = levels[position + 1];

  return (
    <View style={formStyles.screen}>
      <Stack.Screen options={{ title: name }} />
      <View style={styles.breadcrumb} accessibilityRole="header">
        {/* dismissTo pops back to the screen if it's in the stack, so going up never piles screens on. */}
        <Link dismissTo href={{ pathname: "/collections/[id]", params: { id: collection.data.id } }} asChild>
          <Pressable accessibilityRole="link">
            <Text style={styles.crumbLink}>{collection.data.name}</Text>
          </Pressable>
        </Link>
        {breadcrumb.map((ancestor) => (
          <Fragment key={ancestor.id}>
            <Text style={styles.separator}>›</Text>
            <Link dismissTo href={{ pathname: "/items/[id]", params: { id: ancestor.id } }} asChild>
              <Pressable accessibilityRole="link">
                <Text style={styles.crumbLink}>{ancestor.name}</Text>
              </Pressable>
            </Link>
          </Fragment>
        ))}
      </View>
      <Link href={{ pathname: "/items/edit/[id]", params: { id } }} style={styles.edit}>
        Rename or delete
      </Link>
      {level ? (
        <>
          <Text style={styles.level}>{level.name}</Text>
          <VerdictControl itemId={id} verdict={level.overallVerdict} overallRating={item.data.overallRating} />
        </>
      ) : null}

      {childLevel ? (
        <>
          <AddItem collectionId={collection.data.id} level={childLevel} parentId={id} />
          <ItemList
            collectionId={collection.data.id}
            parentId={id}
            scale={childLevel.overallVerdict.scale}
            emptyText={`No ${childLevel.name} yet.`}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  breadcrumb: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  crumbLink: { color: "#2f6fed", fontSize: 16 },
  separator: { color: "#666", fontSize: 16 },
  level: { color: "#666", fontSize: 15 },
  edit: { color: "#2f6fed", fontSize: 16, fontWeight: "600" },
});
