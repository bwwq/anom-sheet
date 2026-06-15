import { getD1 } from "@/db";
import type { AgentCard } from "@/lib/card-model";
import { normalizeCardContent } from "@/lib/card-model";

export type CardRow = {
  id: string;
  ownerId: string;
  ownerUsername: string;
  ownerDisplayName: string;
  name: string;
  personnelCode: string;
  rank: string;
  status: string;
  photoKey: string | null;
  photoContentType: string | null;
  hasPhoto: number | boolean | null;
  shareToken: string | null;
  shareExpiresAt: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export const cardSelect = `cards.id,
  cards.owner_id AS ownerId,
  users.username AS ownerUsername,
  users.display_name AS ownerDisplayName,
  cards.name,
  cards.personnel_code AS personnelCode,
  cards.rank,
  cards.status,
  cards.photo_key AS photoKey,
  cards.photo_content_type AS photoContentType,
  CASE
    WHEN cards.photo_key IS NOT NULL OR cards.photo_data IS NOT NULL THEN 1
    ELSE 0
  END AS hasPhoto,
  cards.share_token AS shareToken,
  cards.share_expires_at AS shareExpiresAt,
  cards.content,
  cards.created_at AS createdAt,
  cards.updated_at AS updatedAt`;

export function readCard(row: CardRow): AgentCard {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(row.content);
  } catch {
    parsed = null;
  }

  const content = normalizeCardContent(parsed);
  const photoUrl =
    row.photoKey || Boolean(row.hasPhoto) ? `/api/cards/${row.id}/photo` : null;
  const shareActive =
    row.shareToken &&
    row.shareExpiresAt &&
    new Date(row.shareExpiresAt).getTime() > Date.now();
  const shareUrl = shareActive ? `/share/${row.shareToken}` : null;

  content.identity.photoUrl = photoUrl ?? "";

  return {
    id: row.id,
    ownerId: row.ownerId,
    ownerUsername: row.ownerUsername,
    ownerDisplayName: row.ownerDisplayName,
    name: row.name,
    personnelCode: row.personnelCode,
    rank: row.rank,
    status: row.status,
    photoUrl,
    shareUrl,
    shareToken: shareActive ? row.shareToken : null,
    shareExpiresAt: shareActive ? row.shareExpiresAt : null,
    content,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getCardRow(cardId: string) {
  return getD1()
    .prepare(
      `SELECT ${cardSelect}
      FROM cards
      INNER JOIN users ON users.id = cards.owner_id
      WHERE cards.id = ?`
    )
    .bind(cardId)
    .first<CardRow>();
}

export async function getOwner(cardId: string) {
  return getD1()
    .prepare(
      "SELECT owner_id AS ownerId, photo_key AS photoKey FROM cards WHERE id = ?"
    )
    .bind(cardId)
    .first<{ ownerId: string; photoKey: string | null }>();
}
