import { publicProcedure, router } from "@/server/trpc/trpc";
import { users } from "@/server/db/schema";

// Demo helpers only. Session switching lives in POST /api/dev/switch-user so
// the HttpOnly cookie is written by Next's own response handling.
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
});
