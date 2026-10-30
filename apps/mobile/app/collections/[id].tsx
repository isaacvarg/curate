import { isDefinedError } from "@orpc/client";
import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { View } from "react-native";
import { AddItem, ItemList } from "@/components/items";
import { Button, ErrorText, Hint, Loading, Screen } from "@/components/ui";
import { orpc } from "@/lib/api";

// A Collection: its top-level Items, and adding one.
export default function CollectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const collection = useQuery(orpc.collection.get.queryOptions({ input: { id } }));

  if (collection.error) {
    const notFound = isDefinedError(collection.error) && collection.error.code === "NOT_FOUND";
    return (
      <Screen>
        <ErrorText>{notFound ? "This Collection doesn't exist." : "Couldn't load this Collection."}</ErrorText>
      </Screen>
    );
  }

  if (!collection.data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const { name, levels } = collection.data;
  const topLevel = levels[0];

  const header = (
    <>
      <Stack.Screen options={{ title: name }} />
      <View>
        <Hint>{levels.map((level) => level.name).join(" › ")}</Hint>
        {levels.map((level) => (
          <Button
            key={level.id}
            variant="text"
            title={`Find ${level.name} Items`}
            onPress={() =>
              router.push({ pathname: "/browse/[id]", params: { id: level.id, collectionId: id } })
            }
          />
        ))}
        <Button
          variant="text"
          title="Level settings"
          onPress={() => router.push({ pathname: "/collections/levels/[id]", params: { id } })}
        />
        <Button
          variant="text"
          title="Rename or delete"
          onPress={() => router.push({ pathname: "/collections/edit/[id]", params: { id } })}
        />
      </View>
      {topLevel ? <AddItem collectionId={id} level={topLevel} /> : null}
    </>
  );

  if (!topLevel) return <Screen>{header}</Screen>;
  return (
    <ItemList collectionId={id} scale={topLevel.overallVerdict.scale} emptyText="Nothing here yet." header={header} />
  );
}
