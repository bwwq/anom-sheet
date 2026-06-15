import { getD1 } from "@/db";
import { ensureDatabase } from "@/db/migrate";
import {
  forbidden,
  getCurrentUser,
  toPublicUser,
  unauthorized,
} from "@/lib/server/auth";
import { hashPassword } from "@/lib/server/password";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type UpdateUserPayload = {
  username?: string;
  displayName?: string;
  role?: "admin" | "user";
  password?: string;
};

const usernamePattern = /^[a-zA-Z0-9_.-]{3,32}$/;

export async function PUT(request: Request, context: RouteContext) {
  await ensureDatabase();
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return unauthorized();
  }

  if (currentUser.role !== "admin") {
    return forbidden();
  }

  const { id } = await context.params;
  const payload = (await request.json().catch(() => null)) as
    | UpdateUserPayload
    | null;
  const existing = await getD1()
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

  if (!existing) {
    return Response.json({ error: "用户不存在" }, { status: 404 });
  }

  const username = payload?.username?.trim().toLowerCase() || existing.username;
  const displayName = payload?.displayName?.trim() || existing.displayName;
  const role = payload?.role ?? existing.role;
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

  if (password && password.length < 8) {
    return Response.json({ error: "密码至少 8 位" }, { status: 400 });
  }

  if (existing.role === "admin" && role === "user") {
    const adminCount = await getD1()
      .prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'")
      .first<{ count: number }>();
    if ((adminCount?.count ?? 0) <= 1) {
      return Response.json({ error: "至少保留一个 admin" }, { status: 400 });
    }
  }

  try {
    if (password) {
      await getD1()
        .prepare(
          `UPDATE users
          SET username = ?,
            display_name = ?,
            role = ?,
            password_hash = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`
        )
        .bind(username, displayName, role, await hashPassword(password), id)
        .run();
    } else {
      await getD1()
        .prepare(
          `UPDATE users
          SET username = ?,
            display_name = ?,
            role = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`
        )
        .bind(username, displayName, role, id)
        .run();
    }
  } catch {
    return Response.json({ error: "账号已存在" }, { status: 409 });
  }

  const row = await getD1()
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

  if (!row) {
    return Response.json({ error: "保存失败" }, { status: 500 });
  }

  return Response.json({ user: toPublicUser(row) });
}
