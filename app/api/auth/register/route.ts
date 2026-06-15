import { getD1 } from "@/db";
import { ensureDatabase } from "@/db/migrate";
import {
  createSession,
  sessionCookie,
  toPublicUser,
} from "@/lib/server/auth";
import { createToken, hashPassword } from "@/lib/server/password";

type RegisterPayload = {
  username?: string;
  displayName?: string;
  password?: string;
};

type InsertResult = {
  meta?: {
    changes?: number;
  };
};

const usernamePattern = /^[a-zA-Z0-9_.-]{3,32}$/;

export async function POST(request: Request) {
  await ensureDatabase();
  const payload = (await request.json().catch(() => null)) as RegisterPayload | null;
  const username = payload?.username?.trim().toLowerCase() ?? "";
  const displayName = payload?.displayName?.trim() || username;
  const password = payload?.password ?? "";

  if (!usernamePattern.test(username)) {
    return Response.json(
      { error: "账号需为 3-32 位字母、数字、点、横线或下划线" },
      { status: 400 }
    );
  }

  if (displayName.length > 48) {
    return Response.json({ error: "显示名过长" }, { status: 400 });
  }

  if (password.length < 8) {
    return Response.json({ error: "密码至少 8 位" }, { status: 400 });
  }

  const d1 = getD1();
  const id = createToken("usr");
  const passwordHash = await hashPassword(password);

  try {
    await d1
      .prepare(
        `INSERT INTO users (id, username, display_name, password_hash, role)
        VALUES (?, ?, ?, ?, 'user')`
      )
      .bind(id, username, displayName, passwordHash)
      .run();
  } catch {
    return Response.json({ error: "账号已存在" }, { status: 409 });
  }

  const adminClaim = (await d1
    .prepare(
      "INSERT OR IGNORE INTO system_settings (key, value) VALUES ('admin_user_id', ?)"
    )
    .bind(id)
    .run()) as InsertResult;

  const role = adminClaim.meta?.changes ? "admin" : "user";
  if (role === "admin") {
    await d1
      .prepare(
        "UPDATE users SET role = 'admin', updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      )
      .bind(id)
      .run();
  }

  const userRow = await d1
    .prepare(
      `SELECT id,
        username,
        display_name AS displayName,
        role,
        created_at AS createdAt
      FROM users
      WHERE id = ?`
    )
    .bind(id)
    .first<{
      id: string;
      username: string;
      displayName: string;
      role: "admin" | "user";
      createdAt: string;
    }>();

  if (!userRow) {
    return Response.json({ error: "注册失败" }, { status: 500 });
  }

  const session = await createSession(id);

  return Response.json(
    { user: toPublicUser(userRow) },
    {
      status: 201,
      headers: {
        "Set-Cookie": sessionCookie(session.token, session.expiresAt),
      },
    }
  );
}
