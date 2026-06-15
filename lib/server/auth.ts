import { getD1 } from "@/db";
import { ensureDatabase } from "@/db/migrate";
import type { SessionUser } from "@/lib/card-model";
import { createToken } from "@/lib/server/password";

const sessionCookieName = "field_card_session";
const sessionDurationMs = 1000 * 60 * 60 * 24 * 14;

type UserRow = {
  id: string;
  username: string;
  displayName: string;
  role: "admin" | "user";
  createdAt: string;
};

function parseCookies(header: string | null) {
  const cookies = new Map<string, string>();
  if (!header) {
    return cookies;
  }

  for (const part of header.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (!rawKey) {
      continue;
    }

    cookies.set(rawKey, decodeURIComponent(rest.join("=")));
  }

  return cookies;
}

export function toPublicUser(row: UserRow): SessionUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    role: row.role,
    createdAt: row.createdAt,
  };
}

export async function getCurrentUser(request: Request) {
  await ensureDatabase();
  const token = parseCookies(request.headers.get("cookie")).get(sessionCookieName);
  if (!token) {
    return null;
  }

  const now = new Date().toISOString();
  const d1 = getD1();
  const row = await d1
    .prepare(
      `SELECT users.id,
        users.username,
        users.display_name AS displayName,
        users.role,
        users.created_at AS createdAt
      FROM sessions
      INNER JOIN users ON users.id = sessions.user_id
      WHERE sessions.token = ? AND sessions.expires_at > ?`
    )
    .bind(token, now)
    .first<UserRow>();

  if (!row) {
    await d1.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
    return null;
  }

  return toPublicUser(row);
}

export async function createSession(userId: string) {
  const d1 = getD1();
  const token = createToken("ses");
  const expiresAt = new Date(Date.now() + sessionDurationMs).toISOString();

  await d1
    .prepare(
      "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)"
    )
    .bind(token, userId, expiresAt)
    .run();

  await d1
    .prepare("DELETE FROM sessions WHERE expires_at <= ?")
    .bind(new Date().toISOString())
    .run();

  return { token, expiresAt };
}

export async function deleteSession(request: Request) {
  await ensureDatabase();
  const token = parseCookies(request.headers.get("cookie")).get(sessionCookieName);
  if (!token) {
    return;
  }

  await getD1().prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
}

export function sessionCookie(token: string, expiresAt: string) {
  const maxAge = Math.max(
    1,
    Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
  );

  return `${sessionCookieName}=${encodeURIComponent(
    token
  )}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}; Expires=${new Date(
    expiresAt
  ).toUTCString()}`;
}

export function clearSessionCookie() {
  return `${sessionCookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export function unauthorized() {
  return Response.json({ error: "请先登录" }, { status: 401 });
}

export function forbidden() {
  return Response.json({ error: "权限不足" }, { status: 403 });
}
