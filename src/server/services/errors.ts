// Domain errors carry a stable `reason` code plus optional context. Routers
// map them onto TRPCError with the same shape in the error formatter, so the
// UI can branch on `reason` and render a localized message.

export type ErrorReason =
  | "BUDGET_EXCEEDED"
  | "CAMPAIGN_NOT_ACCEPTING"
  | "CAMPAIGN_NOT_FOUND"
  | "SUBMISSION_NOT_FOUND"
  | "PLATFORM_MISMATCH"
  | "INVALID_POST_URL"
  | "DUPLICATE_URL"
  | "ALREADY_REVIEWED";

export class DomainError extends Error {
  readonly reason: ErrorReason;

  constructor(reason: ErrorReason, message: string) {
    super(message);
    this.name = "DomainError";
    this.reason = reason;
  }
}

export class BudgetExceededError extends DomainError {
  readonly remainingCents: number;

  constructor(remainingCents: number) {
    super(
      "BUDGET_EXCEEDED",
      `Approval would exceed the campaign budget (only ${remainingCents} cents remain)`,
    );
    this.remainingCents = remainingCents;
  }
}

export class AlreadyReviewedError extends DomainError {
  constructor() {
    super("ALREADY_REVIEWED", "This submission was already reviewed");
  }
}
