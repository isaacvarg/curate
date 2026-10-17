import { expo } from "@better-auth/expo";
import { product } from "@repo/shared";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./db";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true },
  session: { modelName: "authSession" },
  plugins: [expo()],
  trustedOrigins: [`${product.scheme}://`],
});
