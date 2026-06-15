import { getD1 } from "@/db";
import { ensureDatabase } from "@/db/migrate";
import type { CardContent } from "@/lib/card-model";
import { normalizeCardContent } from "@/lib/card-model";
import { getCurrentUser, unauthorized } from "@/lib/server/auth";
import { cardSelect, type CardRow, readCard } from "@/lib/server/cards";
import { createToken } from "@/lib/server/password";

type CardPayload = {
  content?: CardContent;
};

export async function GET(request: Request) {
  await ensureDatabase();
  const user = await getCurrentUser(request);
  if (!user) {
    return unauthorized();
  }

  const d1 = getD1();
  const statement =
    user.role === "admin"
      ? d1.prepare(
          `SELECT ${cardSelect}
          FROM cards
          INNER JOIN users ON users.id = cards.owner_id
          ORDER BY cards.updated_at DESC`
        )
      : d1
          .prepare(
            `SELECT ${cardSelect}
            FROM cards
            INNER JOIN users ON users.id = cards.owner_id
            WHERE cards.owner_id = ?
            ORDER BY cards.updated_at DESC`
          )
          .bind(user.id);

  const rows = await statement.all<CardRow>();
  return Response.json({ cards: (rows.results ?? []).map(readCard) });
}

export async function POST(request: Request) {
  await ensureDatabase();
  const user = await getCurrentUser(request);
  if (!user) {
    return unauthorized();
  }

  const payload = (await request.json().catch(() => null)) as CardPayload | null;
  const content = normalizeCardContent(payload?.content);
  const ownerId = user.id;

  const id = createToken("card");
  const name = content.identity.name.trim() || "未命名外勤人员";
  const personnelCode = content.identity.personnelCode.trim() || "ARD-000-0000";
  const rank = content.identity.rank;
  const status = content.identity.status;

  await getD1()
    .prepare(
      `INSERT INTO cards
        (id, owner_id, name, personnel_code, rank, status, content)
      VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, ownerId, name, personnelCode, rank, status, JSON.stringify(content))
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

  return Response.json({ card: readCard(row) }, { status: 201 });
}
