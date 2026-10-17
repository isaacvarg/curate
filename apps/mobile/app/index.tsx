import { useQuery } from "@tanstack/react-query";
import { Text, View } from "react-native";
import { Button, ErrorText, formStyles } from "@/components/form";
import { orpc, queryClient } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

export default function Home() {
  const me = useQuery(orpc.user.me.queryOptions());

  async function signOut() {
    await authClient.signOut();
    queryClient.clear();
  }

  return (
    <View style={formStyles.screen}>
      {me.data ? (
        <Text style={{ fontSize: 18 }}>Signed in as {me.data.name} ({me.data.email})</Text>
      ) : (
        <Text>Loading…</Text>
      )}
      <ErrorText>{me.error ? "Couldn't load your account." : null}</ErrorText>
      <Button title="Sign out" onPress={signOut} />
    </View>
  );
}
