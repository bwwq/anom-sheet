import { getD1 } from "@/db";
import { ensureDatabase } from "@/db/migrate";
import { forbidden, getCurrentUser, unauthorized } from "@/lib/server/auth";

type UserListRow = {
  id: string;
  username: string;
  displayName: string;
  role: "admin" | "user";
  createdAt: string;
};

export async function GET(request: Request) {
  await ensureDatabase();
  const user = await getCurrentUser(request);
  if (!user) {
    return unauthorized();
  }

  if (user.role !== "admin") {
    return forbidden();
  }

  const rows = await getD1()
    .prepare(
      `SELECT id,
        username,
        display_name AS displayName,
        role,
        created_at AS createdAt
      FROM users
      ORDER BY created_at ASC`
    )
    .all<UserListRow>();

  return Response.json({ users: rows.results ?? [] });
}
