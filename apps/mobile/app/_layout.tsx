import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { queryClient } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

export default function RootLayout() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  const signedIn = Boolean(session);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="index" options={{ title: "Collections" }} />
          <Stack.Screen name="collections/new" options={{ title: "New Collection" }} />
          <Stack.Screen name="collections/[id]" options={{ title: "" }} />
          <Stack.Screen name="collections/levels/[id]" options={{ title: "Level settings" }} />
          <Stack.Screen name="collections/edit/[id]" options={{ title: "Edit Collection" }} />
          <Stack.Screen name="items/[id]" options={{ title: "" }} />
          <Stack.Screen name="items/edit/[id]" options={{ title: "Edit Item" }} />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" options={{ title: "Sign in" }} />
          <Stack.Screen name="sign-up" options={{ title: "Create account" }} />
        </Stack.Protected>
      </Stack>
    </QueryClientProvider>
  );
}
