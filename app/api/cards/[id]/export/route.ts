import { ensureDatabase } from "@/db/migrate";
import { createExportCommand, createProfileSummary } from "@/lib/card-model";
import { forbidden, getCurrentUser, unauthorized } from "@/lib/server/auth";
import { getCardRow, getOwner, readCard } from "@/lib/server/cards";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
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

  const row = await getCardRow(id);
  if (!row) {
    return Response.json({ error: "车卡不存在" }, { status: 404 });
  }

  const card = readCard(row);
  return Response.json({
    card,
    command: createExportCommand(card.content),
    profile: createProfileSummary(card.content),
  });
}
