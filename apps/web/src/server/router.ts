import { collection } from "./collection";
import { prisma } from "./db";
import { authed, os } from "./orpc";

export const router = os.router({
  user: {
    me: authed.user.me.handler(async ({ context }) => {
      return prisma.user.findUniqueOrThrow({
        where: { id: context.user.id },
        select: { id: true, name: true, email: true },
      });
    }),
  },
  collection,
});
