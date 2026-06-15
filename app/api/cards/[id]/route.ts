import { getD1 } from "@/db";
import { ensureDatabase } from "@/db/migrate";
import type { CardContent } from "@/lib/card-model";
import { normalizeCardContent } from "@/lib/card-model";
import { forbidden, getCurrentUser, unauthorized } from "@/lib/server/auth";
import { cardSelect, getOwner, type CardRow, readCard } from "@/lib/server/cards";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type CardPayload = {
  content?: CardContent;
};

export async function PUT(request: Request, context: RouteContext) {
  await ensureDatabase();
  const user = await getCurrentUser(request);
  if (!user) {
    return unauthorized();
  }

  const { id } = await context.params;
  const existing = await getOwner(id);
  if (!existing) {
    return Response.json({ error: "车卡不存在" }, { status: 404 });
  }

  if (user.role !== "admin" && existing.ownerId !== user.id) {
    return forbidden();
  }

  const payload = (await request.json().catch(() => null)) as CardPayload | null;
  const content = normalizeCardContent(payload?.content);
  const ownerId = existing.ownerId;

  const name = content.identity.name.trim() || "未命名外勤人员";
  const personnelCode = content.identity.personnelCode.trim() || "ARD-000-0000";

  await getD1()
    .prepare(
      `UPDATE cards
      SET owner_id = ?,
        name = ?,
        personnel_code = ?,
        rank = ?,
        status = ?,
        content = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`
    )
    .bind(
      ownerId,
      name,
      personnelCode,
      content.identity.rank,
      content.identity.status,
      JSON.stringify(content),
      id
    )
    .run();

  const row = await getD1()
    .prepare(
      `SELECT ${cardSelect}
      FROM cards
      INNER JOIN users ON users.id = cards.owner_id
      WHERE cards.id = ?`
    )
    .bind(id)
    .first<CardRow>();

  if (!row) {
    return Response.json({ error: "保存失败" }, { status: 500 });
  }

  return Response.json({ card: readCard(row) });
}

export async function DELETE(request: Request, context: RouteContext) {
  await ensureDatabase();
  const user = await getCurrentUser(request);
  if (!user) {
    return unauthorized();
  }

  const { id } = await context.params;
  const existing = await getOwner(id);
  if (!existing) {
    return Response.json({ error: "车卡不存在" }, { status: 404 });
  }

  if (user.role !== "admin" && existing.ownerId !== user.id) {
    return forbidden();
  }

  await getD1().prepare("DELETE FROM cards WHERE id = ?").bind(id).run();
  return Response.json({ ok: true });
}
