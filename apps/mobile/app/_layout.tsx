import { product } from "@repo/shared/product";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { Loading, Text } from "@/components/ui";
import { queryClient } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { fontFiles, headerBackTitleStyle, headerTitleStyle, navigationTheme, useTheme } from "@/theme";

export default function RootLayout() {
  const { data: session, isPending } = authClient.useSession();
  const [fontsLoaded, fontError] = useFonts(fontFiles);
  const { dark, colors } = useTheme();

  // Without the fonts the app still works in the system font, so a failed load doesn't block it.
  if (isPending || (!fontsLoaded && !fontError)) {
    return (
      <View style={{ flex: 1, justifyContent: "center", backgroundColor: colors.ground }}>
        <Loading />
      </View>
    );
  }

  const signedIn = Boolean(session);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={navigationTheme(dark)}>
        <StatusBar style="auto" />
        <Stack
          screenOptions={{
            headerShadowVisible: false,
            headerTitleStyle,
            headerBackTitleStyle,
            headerTintColor: colors.ink,
            contentStyle: { backgroundColor: colors.ground },
          }}
        >
          <Stack.Protected guard={signedIn}>
            <Stack.Screen
              name="index"
              options={{
                title: "Collections",
                // The wordmark is curate's only mark (DESIGN.md Identity).
                headerTitle: () => (
                  <Text variant="wordmark" accessibilityRole="header">
                    {product.name}
                  </Text>
                ),
              }}
            />
            <Stack.Screen name="collections/new" options={{ title: "New Collection" }} />
            <Stack.Screen name="collections/[id]" options={{ title: "" }} />
            <Stack.Screen name="collections/levels/[id]" options={{ title: "Level settings" }} />
            <Stack.Screen name="collections/edit/[id]" options={{ title: "Edit Collection" }} />
            <Stack.Screen name="fields/level/[id]" options={{ title: "Fields" }} />
            <Stack.Screen name="fields/new" options={{ title: "New Attribute" }} />
            <Stack.Screen name="fields/[id]" options={{ title: "Attribute" }} />
            <Stack.Screen name="items/[id]" options={{ title: "" }} />
            <Stack.Screen name="items/edit/[id]" options={{ title: "Edit Item" }} />
          </Stack.Protected>
          <Stack.Protected guard={!signedIn}>
            <Stack.Screen name="sign-in" options={{ title: "Sign in" }} />
            <Stack.Screen name="sign-up" options={{ title: "Create account" }} />
          </Stack.Protected>
        </Stack>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
