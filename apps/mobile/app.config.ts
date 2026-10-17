import type { ExpoConfig } from "expo/config";
import { product } from "@repo/shared/product";

const config: ExpoConfig = {
  name: product.name,
  slug: product.slug,
  scheme: product.scheme,
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  ios: { bundleIdentifier: product.bundleIdentifier },
  android: { package: product.bundleIdentifier },
  plugins: ["expo-router", "expo-secure-store"],
  experiments: { typedRoutes: true },
};

export default config;
