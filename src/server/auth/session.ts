import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "demo_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // one week

function sessionSecret(): string {
  const secret = process.env.COOKIE_SECRET;
  if (!secret) {
    throw new Error("COOKIE_SECRET env var is required to sign the session cookie");
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export interface SessionPayload {
  userId: string;
}

// The unsigned cookie value carries a signed JSON payload: base64url(body).signature.
export function createSessionValue(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ userId }), "utf8").toString("base64url");
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

export function decodeSessionCookie(cookieValue: string | null | undefined): SessionPayload | null {
  if (!cookieValue) {
    return null;
  }
  const separator = cookieValue.indexOf(".");
  if (separator === -1) {
    return null;
  }
  const payload = cookieValue.slice(0, separator);
  const signature = cookieValue.slice(separator + 1);
  const expected = sign(payload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      userId?: unknown;
    };
    if (typeof parsed.userId === "string" && parsed.userId.length > 0) {
      return { userId: parsed.userId };
    }
  } catch {
    // Malformed payloads are treated as signed out.
  }
  return null;
}

export function parseCookieHeader(
  header: string | null | undefined,
  name: string,
): string | null {
  if (!header) {
    return null;
  }
  for (const part of header.split(";")) {
    const equals = part.indexOf("=");
    if (equals === -1) {
      continue;
    }
    if (part.slice(0, equals).trim() === name) {
      return part.slice(equals + 1).trim();
    }
  }
  return null;
}
