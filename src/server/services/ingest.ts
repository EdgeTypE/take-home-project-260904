import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { type NodePgDatabase } from "drizzle-orm/node-postgres";
import { schema } from "@/server/db";
import { submissionMetrics, submissions } from "@/server/db/schema";

export interface IngestReport {
  date: string;
  processed: number;
  failed: { submissionId: string; error: string }[];
}

// Deterministic pseudo-random helpers: the same (submission, day) must always
// produce the same candidate values, otherwise a same-day re-run of the ingest
// script would keep growing views and break idempotency.
function hashString(input: string): number {
  let hash = 1779033703 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    hash = Math.imul(hash ^ input.charCodeAt(i), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
  hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
  return (hash ^= hash >>> 16) >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededRange(seedKey: string, min: number, max: number): number {
  const rand = mulberry32(hashString(seedKey));
  return min + Math.floor(rand() * (max - min + 1));
}

/**
 * Simulate a daily third-party sync for every approved submission:
 *   - one submission_metric row per approved submission per day (upsert),
 *   - views only ever go up (candidate is previous day plus a positive delta,
 *     and the upsert applies GREATEST as a second guarantee),
 *   - deterministic per (submission, day), so running twice for the same day
 *     leaves the data unchanged,
 *   - per-submission failures are isolated and reported, never fatal.
 */
export async function ingestDay(
  db: NodePgDatabase<typeof schema>,
  date: string,
): Promise<IngestReport> {
  const approved = await db
    .select({ id: submissions.id })
    .from(submissions)
    .where(inArray(submissions.status, ["approved", "paid"]));

  const report: IngestReport = { date, processed: approved.length, failed: [] };

  for (const submission of approved) {
    try {
      const previous = await db
        .select({
          views: submissionMetrics.views,
          likes: submissionMetrics.likes,
          comments: submissionMetrics.comments,
        })
        .from(submissionMetrics)
        .where(
          and(
            eq(submissionMetrics.submissionId, submission.id),
            lt(submissionMetrics.capturedAt, date),
          ),
        )
        .orderBy(desc(submissionMetrics.capturedAt))
        .limit(1);

      const baseline = (key: string, min: number, max: number) =>
        seededRange(`${submission.id}|base|${key}`, min, max);
      const delta = (key: string, min: number, max: number) =>
        seededRange(`${submission.id}|${date}|${key}`, min, max);

      const views =
        (previous[0]?.views ?? baseline("views", 400, 12000)) +
        delta("views", 1, 1400);
      const likes =
        (previous[0]?.likes ?? baseline("likes", 10, 400)) +
        delta("likes", 0, 60);
      const comments =
        (previous[0]?.comments ?? baseline("comments", 0, 60)) +
        delta("comments", 0, 12);

      await db
        .insert(submissionMetrics)
        .values({
          submissionId: submission.id,
          capturedAt: date,
          views,
          likes,
          comments,
        })
        .onConflictDoUpdate({
          target: [submissionMetrics.submissionId, submissionMetrics.capturedAt],
          set: {
            views: sql`greatest(${submissionMetrics.views}, excluded.views)`,
            likes: sql`greatest(${submissionMetrics.likes}, excluded.likes)`,
            comments: sql`greatest(${submissionMetrics.comments}, excluded.comments)`,
          },
        });
    } catch (err) {
      report.failed.push({
        submissionId: submission.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return report;
}
