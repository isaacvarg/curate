import Constants from "expo-constants";

// The web app's origin. Set EXPO_PUBLIC_API_URL to override; in development it
// defaults to port 3000 on the machine running Metro, which simulators and
// devices on the same network can both reach.
function resolveServerUrl() {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured) return configured.replace(/\/$/, "");
  const host = Constants.expoConfig?.hostUri?.split(":")[0] ?? "localhost";
  return `http://${host}:3000`;
}

export const serverUrl = resolveServerUrl();
