import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const ADMIN_COOKIE = "tiny-office-admin";
const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 8;

function getSessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("Missing ADMIN_SESSION_SECRET.");
  return secret;
}

function sign(value: string) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

function createToken(userId: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + ADMIN_SESSION_TTL_SECONDS;
  const payload = `${userId}|${expiresAt}`;
  const encodedPayload = Buffer.from(payload).toString("base64url");
  return `${encodedPayload}.${sign(payload)}`;
}

function isValidToken(token: string | undefined, userId: string) {
  if (!token) return false;
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return false;
  const payload = Buffer.from(encodedPayload, "base64url").toString("utf8");
  const [tokenUserId, expiresAt] = payload.split("|");
  if (!tokenUserId || tokenUserId !== userId || !expiresAt || Number(expiresAt) <= Math.floor(Date.now() / 1000)) return false;
  const expected = sign(payload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export async function isAdminSession(userId: string) {
  const cookieStore = await cookies();
  try {
    return isValidToken(cookieStore.get(ADMIN_COOKIE)?.value, userId);
  } catch {
    return false;
  }
}

export async function startAdminSession(userId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, createToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ADMIN_SESSION_TTL_SECONDS,
    path: "/",
  });
}

export async function endAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE);
}
