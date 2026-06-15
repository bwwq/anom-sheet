import { getD1 } from "@/db";
import { ensureDatabase } from "@/db/migrate";
import { createSession, sessionCookie, toPublicUser } from "@/lib/server/auth";
import { verifyPassword } from "@/lib/server/password";

type LoginPayload = {
  username?: string;
  password?: string;
};

type LoginRow = {
  id: string;
  username: string;
  displayName: string;
  passwordHash: string;
  role: "admin" | "user";
  createdAt: string;
};

export async function POST(request: Request) {
  await ensureDatabase();
  const payload = (await request.json().catch(() => null)) as LoginPayload | null;
  const username = payload?.username?.trim().toLowerCase() ?? "";
  const password = payload?.password ?? "";

  const row = await getD1()
    .prepare(
      `SELECT id,
        username,
        display_name AS displayName,
        password_hash AS passwordHash,
        role,
        created_at AS createdAt
      FROM users
      WHERE username = ?`
    )
    .bind(username)
    .first<LoginRow>();

  if (!row || !(await verifyPassword(password, row.passwordHash))) {
    return Response.json({ error: "账号或密码不正确" }, { status: 401 });
  }

  const session = await createSession(row.id);

  return Response.json(
    { user: toPublicUser(row) },
    {
      headers: {
        "Set-Cookie": sessionCookie(session.token, session.expiresAt),
      },
    }
  );
}
