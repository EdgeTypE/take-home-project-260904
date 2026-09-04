import { eq } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure, router } from "@/server/trpc/trpc";
import { users } from "@/server/db/schema";
import { encodeSessionCookie } from "@/server/auth/session";
import { TRPCError } from "@trpc/server";

export const devRouter = router({
  whoami: publicProcedure.query(({ ctx }) => {
    if (!ctx.user) {
      return null;
    }
    return { id: ctx.user.id, email: ctx.user.email, role: ctx.user.role };
  }),

  listUsers: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({ id: users.id, email: users.email, role: users.role })
      .from(users)
      .orderBy(users.role, users.email);
    return rows;
  }),

  // Demo auth only: switching to any seeded user. There is no real login, so
  // this is the entire sign-in surface of the take-home.
  switchUser: publicProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);
      if (rows.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }
      ctx.setCookie(encodeSessionCookie(input.userId));
      return { ok: true as const };
    }),
});
