import { useQuery } from "@tanstack/react-query";
import { Link, useRouter } from "expo-router";
import { Button, CardList, EmptyText, ErrorText, ListRow, Loading, Section } from "@/components/ui";
import { orpc, queryClient } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

// Home: the signed-in User's Collections.
export default function Collections() {
  const router = useRouter();
  const collections = useQuery(orpc.collection.list.queryOptions());

  async function signOut() {
    await authClient.signOut();
    queryClient.clear();
  }

  return (
    <CardList
      data={collections.data}
      keyExtractor={(c) => c.id}
      header={
        <Section title="Your Collections">
          <Button title="New Collection" onPress={() => router.push("/collections/new")} />
          <ErrorText>{collections.error ? "Couldn't load your Collections." : null}</ErrorText>
        </Section>
      }
      placeholder={collections.error ? null : <Loading />}
      empty={<EmptyText>No Collections yet.</EmptyText>}
      renderRow={(item, position) => (
        <Link href={{ pathname: "/collections/[id]", params: { id: item.id } }} asChild>
          <ListRow title={item.name} {...position} />
        </Link>
      )}
      footer={<Button variant="text" title="Sign out" onPress={signOut} />}
    />
  );
}
