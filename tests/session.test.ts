import { config } from "dotenv";
import { describe, expect, it } from "vitest";
import {
  createSessionValue,
  decodeSessionCookie,
  parseCookieHeader,
  SESSION_COOKIE,
} from "../src/server/auth/session";

config({ path: ".env.test", quiet: true });

describe("session cookie", () => {
  it("round-trips a signed user id", () => {
    const userId = "521b9e42-5bab-4269-9ab9-af7b498ba7da";
    const value = createSessionValue(userId);
    expect(decodeSessionCookie(value)?.userId).toBe(userId);
  });

  it("rejects cookies whose signature does not match the payload", () => {
    const value = createSessionValue("521b9e42-5bab-4269-9ab9-af7b498ba7da");
    const [payload] = value.split(".");
    expect(decodeSessionCookie(`${payload}.forged-signature`)).toBeNull();
  });

  it("rejects malformed and empty cookie values", () => {
    expect(decodeSessionCookie(null)).toBeNull();
    expect(decodeSessionCookie("")).toBeNull();
    expect(decodeSessionCookie("no-separator")).toBeNull();
    expect(decodeSessionCookie("not-base64!.")).toBeNull();
  });

  it("extracts a named cookie from a raw header", () => {
    const header = `other=1; ${SESSION_COOKIE}=abc.def; lang=en`;
    expect(parseCookieHeader(header, SESSION_COOKIE)).toBe("abc.def");
    expect(parseCookieHeader(header, "missing")).toBeNull();
    expect(parseCookieHeader(undefined, SESSION_COOKIE)).toBeNull();
  });
});
