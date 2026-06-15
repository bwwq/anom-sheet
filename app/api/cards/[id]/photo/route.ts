import { getD1, getFilesBucket } from "@/db";
import { ensureDatabase } from "@/db/migrate";
import { forbidden, getCurrentUser, unauthorized } from "@/lib/server/auth";
import { getOwner } from "@/lib/server/cards";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const maxPhotoBytes = 10 * 1024 * 1024;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

type UploadFile = {
  arrayBuffer: () => Promise<ArrayBuffer>;
  name?: string;
  size: number;
  stream?: () => ReadableStream;
  type?: string;
};

function isUploadFile(value: FormDataEntryValue | null): value is UploadFile {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<UploadFile>;
  return (
    typeof candidate.arrayBuffer === "function" &&
    typeof candidate.size === "number"
  );
}

function normalizePhotoContentType(file: UploadFile) {
  const type = file.type ?? "";
  if (allowedTypes.has(type)) {
    return type;
  }

  const name = file.name?.toLowerCase() ?? "";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (name.endsWith(".png")) {
    return "image/png";
  }
  if (name.endsWith(".webp")) {
    return "image/webp";
  }

  return null;
}

function extensionForType(type: string) {
  return type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

function base64ToBytes(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function deletePhotoObject(key: string) {
  try {
    await getFilesBucket().delete(key);
  } catch {
    return;
  }
}

async function canReadPhoto(request: Request, cardId: string) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (token) {
    const row = await getD1()
      .prepare(
        `SELECT id
        FROM cards
        WHERE id = ?
          AND share_token = ?
          AND share_expires_at > ?`
      )
      .bind(cardId, token, new Date().toISOString())
      .first<{ id: string }>();
    if (row) {
      return true;
    }
  }

  const user = await getCurrentUser(request);
  if (!user) {
    return false;
  }

  const owner = await getOwner(cardId);
  return Boolean(owner && (user.role === "admin" || owner.ownerId === user.id));
}

export async function GET(request: Request, context: RouteContext) {
  await ensureDatabase();
  const { id } = await context.params;
  const allowed = await canReadPhoto(request, id);
  if (!allowed) {
    return unauthorized();
  }

  const row = await getD1()
    .prepare(
      `SELECT photo_key AS photoKey,
        photo_content_type AS photoContentType,
        photo_data AS photoData
      FROM cards
      WHERE id = ?`
    )
    .bind(id)
    .first<{
      photoKey: string | null;
      photoContentType: string | null;
      photoData: string | null;
    }>();

  if (!row?.photoKey && !row?.photoData) {
    return Response.json({ error: "未上传照片" }, { status: 404 });
  }

  if (row.photoKey) {
    try {
      const object = await getFilesBucket().get(row.photoKey);
      if (object) {
        return new Response(object.body, {
          headers: {
            "Content-Type": row.photoContentType ?? "application/octet-stream",
            "Cache-Control": "private, max-age=60",
          },
        });
      }
    } catch {
      if (!row.photoData) {
        return Response.json({ error: "照片存储暂不可用" }, { status: 503 });
      }
    }
  }

  return new Response(base64ToBytes(row.photoData ?? ""), {
    headers: {
      "Content-Type": row.photoContentType ?? "application/octet-stream",
      "Cache-Control": "private, max-age=60",
    },
  });
}

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

  const form = await request.formData();
  const file = form.get("photo");

  if (!isUploadFile(file)) {
    return Response.json({ error: "请选择照片文件" }, { status: 400 });
  }

  const contentType = normalizePhotoContentType(file);
  if (!contentType) {
    return Response.json(
      { error: "仅支持 jpg、png、webp 图片" },
      { status: 400 }
    );
  }

  if (file.size > maxPhotoBytes) {
    return Response.json({ error: "照片不能超过 10MB" }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const extension = extensionForType(contentType);
  const key = `cards/${id}/portrait-${Date.now()}.${extension}`;
  let photoKey: string | null = key;
  let photoData: string | null = null;

  try {
    await getFilesBucket().put(key, buffer, {
      httpMetadata: { contentType },
    });
  } catch {
    photoKey = null;
    photoData = arrayBufferToBase64(buffer);
  }

  await getD1()
    .prepare(
      `UPDATE cards
      SET photo_key = ?,
        photo_content_type = ?,
        photo_data = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`
    )
    .bind(photoKey, contentType, photoData, id)
    .run();

  if (owner.photoKey) {
    await deletePhotoObject(owner.photoKey);
  }

  return Response.json({ photoUrl: `/api/cards/${id}/photo?v=${Date.now()}` });
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

  if (owner.photoKey) {
    await deletePhotoObject(owner.photoKey);
  }

  await getD1()
    .prepare(
      `UPDATE cards
      SET photo_key = NULL,
        photo_content_type = NULL,
        photo_data = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`
    )
    .bind(id)
    .run();

  return Response.json({ ok: true });
}
