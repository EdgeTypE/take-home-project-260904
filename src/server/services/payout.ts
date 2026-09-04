// Pure payout math, free of any database or I/O so it is trivially testable.
// Earnings follow the assignment: floor(views / 1000) * payout_per_1k_views,
// taken from the submission's most recent metric row.
export function calculateEarningsCents(
  latestViews: number,
  payoutPer1kViewsCents: number,
): number {
  const views = Math.max(0, Math.floor(latestViews));
  const payout = Math.max(0, Math.floor(payoutPer1kViewsCents));
  return Math.floor(views / 1000) * payout;
}
