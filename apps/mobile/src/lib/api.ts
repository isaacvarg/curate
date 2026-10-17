import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { Contract } from "@repo/shared";
import { QueryClient } from "@tanstack/react-query";
import { authClient } from "./auth-client";
import { serverUrl } from "./server-url";

// The only way the app reaches the server's data: the typed oRPC API,
// authenticated with the Better Auth session cookie.
const link = new RPCLink({
  url: `${serverUrl}/rpc`,
  headers: async () => {
    const cookie = await authClient.getCookie();
    return cookie ? { Cookie: cookie } : {};
  },
  // Better Auth's Expo client manages the cookie; keep the native cookie jar out of it.
  fetch: (request, init) => fetch(request, { ...init, credentials: "omit" }),
});

export const api: ContractRouterClient<Contract> = createORPCClient(link);
export const orpc = createTanstackQueryUtils(api);
export const queryClient = new QueryClient();
