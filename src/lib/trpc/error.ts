export interface ErrorCause {
  reason?: string;
  remainingCents?: number;
}

export function getErrorCause(err: unknown): ErrorCause | undefined {
  if (typeof err !== "object" || err === null) {
    return undefined;
  }
  const data = (err as { data?: { cause?: unknown } }).data;
  const cause = data?.cause;
  if (typeof cause !== "object" || cause === null) {
    return undefined;
  }
  const record = cause as { reason?: unknown; remainingCents?: unknown };
  if (typeof record.reason !== "string") {
    return undefined;
  }
  return {
    reason: record.reason,
    remainingCents:
      typeof record.remainingCents === "number" ? record.remainingCents : undefined,
  };
}

export function getErrorMessage(err: unknown): string | undefined {
  if (typeof err === "object" && err !== null) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }
  return undefined;
}
