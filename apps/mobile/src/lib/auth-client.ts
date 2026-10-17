import { expoClient } from "@better-auth/expo/client";
import { product } from "@repo/shared";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";
import { serverUrl } from "./server-url";

// The session cookie lives in secure storage, so it survives app launches.
export const authClient = createAuthClient({
  baseURL: serverUrl,
  plugins: [
    expoClient({
      scheme: product.scheme,
      storagePrefix: product.slug,
      storage: SecureStore,
    }),
  ],
});
