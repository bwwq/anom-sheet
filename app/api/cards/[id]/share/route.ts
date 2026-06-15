import { getD1 } from "@/db";
import { ensureDatabase } from "@/db/migrate";
import { forbidden, getCurrentUser, unauthorized } from "@/lib/server/auth";
import { getCardRow, getOwner, readCard } from "@/lib/server/cards";
import { createToken } from "@/lib/server/password";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type SharePayload = {
  hours?: number;
};

export async function POST(request: Request, context: RouteContext) {
  await ensureDatabase();
  const user = await getCurrentUser(request);
  if (!user) {
    return unauthorized();
  }

  const { id } = await context.params;
  const owner = await getOwner(id);
  if (!owner) {
    return Response.json({ error: "车卡不存在" }, { status: 404 });
  }

  if (user.role !== "admin" && owner.ownerId !== user.id) {
    return forbidden();
  }

  const payload = (await request.json().catch(() => null)) as SharePayload | null;
  const hours = Math.min(168, Math.max(1, Math.round(payload?.hours ?? 24)));
  const token = createToken("share");
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

  await getD1()
    .prepare(
      `UPDATE cards
      SET share_token = ?,
        share_expires_at = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`
    )
    .bind(token, expiresAt, id)
    .run();

  const row = await getCardRow(id);
  if (!row) {
    return Response.json({ error: "分享失败" }, { status: 500 });
  }

  return Response.json({ card: readCard(row), shareUrl: `/share/${token}` });
}

export async function DELETE(request: Request, context: RouteContext) {
  await ensureDatabase();
  const user = await getCurrentUser(request);
  if (!user) {
    return unauthorized();
  }

  const { id } = await context.params;
  const owner = await getOwner(id);
  if (!owner) {
    return Response.json({ error: "车卡不存在" }, { status: 404 });
  }

  if (user.role !== "admin" && owner.ownerId !== user.id) {
    return forbidden();
  }

  await getD1()
    .prepare(
      `UPDATE cards
      SET share_token = NULL,
        share_expires_at = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`
    )
    .bind(id)
    .run();

  const row = await getCardRow(id);
  return Response.json({ card: row ? readCard(row) : null });
}
