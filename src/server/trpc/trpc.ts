import { initTRPC, TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { type NodePgDatabase } from "drizzle-orm/node-postgres";
import { getDb, schema } from "@/server/db";
import { users, type User } from "@/server/db/schema";
import {
  decodeSessionCookie,
  parseCookieHeader,
  SESSION_COOKIE,
} from "@/server/auth/session";

export interface TrpcContext {
  db: NodePgDatabase<typeof schema>;
  user: User | null;
  setCookie: (cookie: string) => void;
}

interface CreateContextInput {
  headers: Headers;
  setCookie: (cookie: string) => void;
}

export async function createContext(input: CreateContextInput): Promise<TrpcContext> {
  const db = getDb();
  let user: User | null = null;
  const cookieValue = parseCookieHeader(input.headers.get("cookie"), SESSION_COOKIE);
  const session = decodeSessionCookie(cookieValue);
  if (session) {
    const row = await db
      .select()
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);
    user = row[0] ?? null;
  }
  return { db, user, setCookie: input.setCookie };
}

const t = initTRPC.context<TrpcContext>().create({
  errorFormatter({ shape, error }) {
    // Structured causes (reason codes plus context like remainingCents) travel
    // to the client so the UI can render localized, actionable messages.
    const cause = error.cause;
    if (cause && typeof cause === "object") {
      const record = cause as { reason?: unknown; remainingCents?: unknown };
      if (record.reason !== undefined) {
        return {
          ...shape,
          data: {
            ...shape.data,
            cause: {
              reason: record.reason,
              remainingCents: record.remainingCents,
            },
          },
        };
      }
    }
    return shape;
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

const protectedMiddleware = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in by switching to a demo user" });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const protectedProcedure = t.procedure.use(protectedMiddleware);

export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin role required" });
  }
  return next({ ctx });
});

export const creatorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "creator") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Creator role required" });
  }
  return next({ ctx });
});

export function toTrpcError(err: unknown): TRPCError {
  if (err instanceof TRPCError) {
    return err;
  }
  const { reason, remainingCents } = err as {
    reason?: string;
    remainingCents?: number;
  };
  if (typeof reason === "string") {
    const message = err instanceof Error ? err.message : String(err);
    const codeByReason: Record<string, { code: "NOT_FOUND" | "CONFLICT" | "PRECONDITION_FAILED" | "BAD_REQUEST"; cause?: unknown }> = {
      CAMPAIGN_NOT_FOUND: { code: "NOT_FOUND", cause: { reason } },
      SUBMISSION_NOT_FOUND: { code: "NOT_FOUND", cause: { reason } },
      DUPLICATE_URL: { code: "CONFLICT", cause: { reason } },
      BUDGET_EXCEEDED: {
        code: "PRECONDITION_FAILED",
        cause: { reason, remainingCents },
      },
      ALREADY_REVIEWED: {
        code: "PRECONDITION_FAILED",
        cause: { reason },
      },
      CAMPAIGN_NOT_ACCEPTING: { code: "PRECONDITION_FAILED", cause: { reason } },
      PLATFORM_MISMATCH: { code: "BAD_REQUEST", cause: { reason } },
      INVALID_POST_URL: { code: "BAD_REQUEST", cause: { reason } },
    };
    const mapped = codeByReason[reason] ?? { code: "BAD_REQUEST" as const, cause: { reason } };
    return new TRPCError({
      code: mapped.code,
      message,
      cause: mapped.cause,
    });
  }
  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unexpected error" });
}
