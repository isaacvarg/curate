import { collection } from "./collection";
import { prisma } from "./db";
import { field } from "./field";
import { item } from "./item";
import { level } from "./level";
import { authed, os } from "./orpc";
import { rating } from "./rating";

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
  level,
  field,
  item,
  rating,
});
