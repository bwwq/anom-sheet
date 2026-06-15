"use client";

import {
  Activity,
  Camera,
  ClipboardList,
  Copy,
  Eye,
  FileText,
  Link,
  LockKeyhole,
  LogOut,
  Plus,
  Save,
  Search,
  Shield,
  Trash2,
  UserCog,
  UserRound,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type {
  AgentCard,
  AttributeKey,
  CardContent,
  ConditionKey,
  CustomEquipment,
  EquipmentKey,
  RatingLine,
  ResistanceKey,
  SessionUser,
  SkillKey,
} from "@/lib/card-model";
import {
  attributeFields,
  conditionFields,
  createDefaultCardContent,
  createExportCommand,
  createProfileSummary,
  duplicateCardContent,
  equipmentFields,
  normalizeCardContent,
  resistanceFields,
  skillFields,
} from "@/lib/card-model";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type AuthMode = "login" | "register";
type ApiUserList = { users: SessionUser[] };
type ApiCards = { cards: AgentCard[] };
type ApiCard = { card: AgentCard };
type ApiMe = { user: SessionUser | null };

const fieldShell =
  "space-y-1.5 min-w-0 [&_input]:min-w-0 [&_textarea]:min-w-0";
const clientMaxPhotoBytes = 750 * 1024;
const maxPhotoEdge = 1600;

async function requestJson<T>(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error || "请求失败");
  }

  return data;
}

async function uploadPhoto(path: string, file: File) {
  const form = new FormData();
  form.set("photo", file);
  const response = await fetch(path, { method: "POST", body: form });
  const data = (await response.json().catch(() => ({}))) as {
    photoUrl?: string;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error || "上传失败");
  }

  return data;
}

async function compressPhoto(file: File) {
  if (!file.type.startsWith("image/") || file.size <= clientMaxPhotoBytes) {
    return file;
  }

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) {
    throw new Error("图片过大，且浏览器无法压缩；请换一张小于 750KB 的图片");
  }

  const attempts = [
    { edge: maxPhotoEdge, quality: 0.82 },
    { edge: 1400, quality: 0.78 },
    { edge: 1200, quality: 0.72 },
    { edge: 1000, quality: 0.68 },
    { edge: 800, quality: 0.62 },
    { edge: 640, quality: 0.58 },
  ];
  const baseName = file.name.replace(/\.[^.]+$/, "") || "portrait";
  let bestBlob: Blob | null = null;

  for (const attempt of attempts) {
    const scale = Math.min(1, attempt.edge / bitmap.width, attempt.edge / bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      continue;
    }

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", attempt.quality)
    );

    if (!blob) {
      continue;
    }

    if (!bestBlob || blob.size < bestBlob.size) {
      bestBlob = blob;
    }

    if (blob.size <= clientMaxPhotoBytes) {
      bitmap.close();
      return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
    }
  }

  if (bestBlob && bestBlob.size <= clientMaxPhotoBytes) {
    bitmap.close();
    return new File([bestBlob], `${baseName}.jpg`, { type: "image/jpeg" });
  }

  bitmap.close();
  throw new Error("图片过大，压缩后仍超过 750KB；请换一张更小的图片");
}

function sumRating<T extends string>(
  map: Record<T, RatingLine>,
  key: keyof RatingLine
) {
  return (Object.values(map) as RatingLine[]).reduce(
    (total, line) => total + line[key],
    0
  );
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}

function makeNewCardContent(index: number) {
  const content = createDefaultCardContent();
  content.identity.name = `新外勤人员 ${index}`;
  content.identity.personnelCode = `ARD-${String(index).padStart(3, "0")}-${new Date().getFullYear()}`;
  return content;
}

function absoluteShareUrl(path: string | null) {
  if (!path || typeof window === "undefined") {
    return "";
  }

  return `${window.location.origin}${path}`;
}

export function FieldCardApp() {
  const [booting, setBooting] = useState(true);
  const [me, setMe] = useState<SessionUser | null>(null);
  const [users, setUsers] = useState<SessionUser[]>([]);
  const [cards, setCards] = useState<AgentCard[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CardContent>(() => createDefaultCardContent());
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("register");
  const [shareHours, setShareHours] = useState(24);
  const [authForm, setAuthForm] = useState({
    username: "",
    displayName: "",
    password: "",
  });

  useEffect(() => {
    let mounted = true;

    async function boot() {
      try {
        const data = await requestJson<ApiMe>("/api/auth/me");
        if (!mounted) {
          return;
        }

        setMe(data.user);
        if (data.user) {
          const [cardData, userData] = await Promise.all([
            requestJson<ApiCards>("/api/cards"),
            data.user.role === "admin"
              ? requestJson<ApiUserList>("/api/users")
              : Promise.resolve({ users: [data.user] }),
          ]);
          setCards(cardData.cards);
          setUsers(userData.users);

          const firstCard = cardData.cards[0];
          if (firstCard) {
            setSelectedId(firstCard.id);
            setDraft(duplicateCardContent(firstCard.content));
          } else {
            setSelectedId(null);
            setDraft(makeNewCardContent(1));
          }
        }
      } catch (bootError) {
        setError(bootError instanceof Error ? bootError.message : "加载失败");
      } finally {
        if (mounted) {
          setBooting(false);
        }
      }
    }

    void boot();
    return () => {
      mounted = false;
    };
  }, []);

  const selectedCard = cards.find((card) => card.id === selectedId) ?? null;
  const filteredCards = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return cards;
    }

    return cards.filter((card) =>
      [
        card.name,
        card.personnelCode,
        card.ownerUsername,
        card.ownerDisplayName,
        card.status,
        card.rank,
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }, [cards, query]);

  const attributeInitialTotal = sumRating(draft.attributes, "initial");
  const attributeTotal = sumRating(draft.attributes, "total");
  const skillTotal = sumRating(draft.skills, "total");
  const resistanceTotal = sumRating(draft.resistances, "total");
  const resistanceBase = Math.floor(
    (draft.attributes.con.total + draft.attributes.wil.total) / 2
  );
  const equippedCount =
    Object.values(draft.equipment).filter(Boolean).length +
    draft.customEquipment.filter((item) => item.carried).length;
  const exportCommand = createExportCommand(draft);
  const profile = createProfileSummary(draft);

  async function loadWorkspace(currentUser: SessionUser) {
    const [cardData, userData] = await Promise.all([
      requestJson<ApiCards>("/api/cards"),
      currentUser.role === "admin"
        ? requestJson<ApiUserList>("/api/users")
        : Promise.resolve({ users: [currentUser] }),
    ]);

    setCards(cardData.cards);
    setUsers(userData.users);

    const firstCard = cardData.cards[0];
    if (firstCard) {
      selectCard(firstCard);
    } else {
      startNewDraft(1);
    }
  }

  function selectCard(card: AgentCard) {
    setSelectedId(card.id);
    setDraft(duplicateCardContent(card.content));
    setMessage("");
    setError("");
  }

  function startNewDraft(index = cards.length + 1) {
    setSelectedId(null);
    setDraft(makeNewCardContent(index));
    setMessage("已准备新卡草稿");
    setError("");
  }

  async function handleCreateCard() {
    if (!me) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const content = makeNewCardContent(cards.length + 1);
      const data = await requestJson<ApiCard>("/api/cards", {
        method: "POST",
        body: JSON.stringify({ content }),
      });

      setCards((current) => [data.card, ...current]);
      selectCard(data.card);
      setMessage("已创建新卡");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "创建失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const endpoint =
        authMode === "register" ? "/api/auth/register" : "/api/auth/login";
      const data = await requestJson<{ user: SessionUser }>(endpoint, {
        method: "POST",
        body: JSON.stringify(authForm),
      });
      setMe(data.user);
      await loadWorkspace(data.user);
      setMessage(authMode === "register" ? "登记完成" : "已登录");
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "认证失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await requestJson<{ ok: true }>("/api/auth/logout", { method: "POST" });
    setMe(null);
    setCards([]);
    setUsers([]);
    setSelectedId(null);
    setMessage("");
    setError("");
    setAuthMode("login");
  }

  async function handleSave() {
    if (!me) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const content = normalizeCardContent(draft);
      const payload = { content };
      const data = selectedId
        ? await requestJson<ApiCard>(`/api/cards/${selectedId}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          })
        : await requestJson<ApiCard>("/api/cards", {
            method: "POST",
            body: JSON.stringify(payload),
          });

      setCards((current) => {
        const rest = current.filter((card) => card.id !== data.card.id);
        return [data.card, ...rest].sort((left, right) =>
          right.updatedAt.localeCompare(left.updatedAt)
        );
      });
      selectCard(data.card);
      setMessage("已保存");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedId) {
      return;
    }

    const confirmed = window.confirm("确认删除当前车卡？");
    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError("");
    try {
      await requestJson<{ ok: true }>(`/api/cards/${selectedId}`, {
        method: "DELETE",
      });
      const nextCards = cards.filter((card) => card.id !== selectedId);
      setCards(nextCards);
      if (nextCards[0]) {
        selectCard(nextCards[0]);
      } else {
        startNewDraft(1);
      }
      setMessage("已删除");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "删除失败");
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoUpload(file: File | null) {
    if (!file) {
      return;
    }

    if (!selectedId) {
      setError("请先保存或点击加号创建卡，再上传照片");
      return;
    }

    setUploading(true);
    setError("");
    setMessage("");

    try {
      const preparedFile = await compressPhoto(file);
      const data = await uploadPhoto(`/api/cards/${selectedId}/photo`, preparedFile);
      const photoUrl = data.photoUrl ?? `/api/cards/${selectedId}/photo`;
      setDraft((current) => ({
        ...current,
        identity: { ...current.identity, photoUrl, portraitNote: "已上传" },
      }));
      setCards((current) =>
        current.map((card) =>
          card.id === selectedId
            ? {
                ...card,
                photoUrl,
                content: {
                  ...card.content,
                  identity: {
                    ...card.content.identity,
                    photoUrl,
                    portraitNote: "已上传",
                  },
                },
              }
            : card
        )
      );
      setMessage("照片已上传");
    } catch (photoError) {
      setError(photoError instanceof Error ? photoError.message : "上传失败");
    } finally {
      setUploading(false);
    }
  }

  async function handleShare() {
    if (!selectedId) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const data = await requestJson<ApiCard & { shareUrl: string }>(
        `/api/cards/${selectedId}/share`,
        {
          method: "POST",
          body: JSON.stringify({ hours: shareHours }),
        }
      );
      setCards((current) =>
        current.map((card) => (card.id === data.card.id ? data.card : card))
      );
      selectCard(data.card);
      setMessage("临时链接已生成");
    } catch (shareError) {
      setError(shareError instanceof Error ? shareError.message : "分享失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleRevokeShare() {
    if (!selectedId) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      const data = await requestJson<{ card: AgentCard | null }>(
        `/api/cards/${selectedId}/share`,
        { method: "DELETE" }
      );
      if (data.card) {
        setCards((current) =>
          current.map((card) => (card.id === data.card?.id ? data.card : card))
        );
        selectCard(data.card);
      }
      setMessage("临时链接已撤销");
    } catch (shareError) {
      setError(shareError instanceof Error ? shareError.message : "撤销失败");
    } finally {
      setSaving(false);
    }
  }

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text);
    setMessage("已复制");
  }

  function upsertCard(updated: AgentCard) {
    setCards((current) =>
      current.map((card) => (card.id === updated.id ? updated : card))
    );
    selectCard(updated);
  }

  function updateUser(updated: SessionUser) {
    setUsers((current) =>
      current.map((user) => (user.id === updated.id ? updated : user))
    );
    if (me?.id === updated.id) {
      setMe(updated);
    }
  }

  function updateIdentity<K extends keyof CardContent["identity"]>(
    key: K,
    value: CardContent["identity"][K]
  ) {
    setDraft((current) => ({
      ...current,
      identity: { ...current.identity, [key]: value },
    }));
  }

  function updateBackground<K extends keyof CardContent["background"]>(
    key: K,
    value: CardContent["background"][K]
  ) {
    setDraft((current) => ({
      ...current,
      background: { ...current.background, [key]: value },
    }));
  }

  function updateAftermath<K extends keyof CardContent["aftermath"]>(
    key: K,
    value: CardContent["aftermath"][K]
  ) {
    setDraft((current) => ({
      ...current,
      aftermath: { ...current.aftermath, [key]: value },
    }));
  }

  function updateAttribute(
    key: AttributeKey,
    field: keyof RatingLine,
    value: number
  ) {
    setDraft((current) => ({
      ...current,
      attributes: {
        ...current.attributes,
        [key]: { ...current.attributes[key], [field]: value },
      },
    }));
  }

  function updateSkill(key: SkillKey, field: keyof RatingLine, value: number) {
    setDraft((current) => ({
      ...current,
      skills: {
        ...current.skills,
        [key]: { ...current.skills[key], [field]: value },
      },
    }));
  }

  function updateResistance(
    key: ResistanceKey,
    field: keyof RatingLine,
    value: number
  ) {
    setDraft((current) => ({
      ...current,
      resistances: {
        ...current.resistances,
        [key]: { ...current.resistances[key], [field]: value },
      },
    }));
  }

  function updateCondition(key: ConditionKey, value: number) {
    setDraft((current) => ({
      ...current,
      conditions: { ...current.conditions, [key]: clampNumber(value, 0, 100) },
    }));
  }

  function updateEquipment(key: EquipmentKey, value: boolean) {
    setDraft((current) => ({
      ...current,
      equipment: { ...current.equipment, [key]: value },
    }));
  }

  function updateCustomEquipment(next: CustomEquipment[]) {
    setDraft((current) => ({
      ...current,
      customEquipment: next,
    }));
  }

  if (booting) {
    return (
      <main className="grid min-h-screen place-items-center bg-zinc-950 text-zinc-100">
        <div className="rounded-md border border-zinc-800 bg-zinc-900 px-5 py-4 text-sm text-zinc-400 shadow-sm">
          正在载入档案库
        </div>
      </main>
    );
  }

  if (!me) {
    return (
      <AuthScreen
        authMode={authMode}
        setAuthMode={setAuthMode}
        authForm={authForm}
        setAuthForm={setAuthForm}
        error={error}
        message={message}
        saving={saving}
        onSubmit={handleAuth}
      />
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md border border-zinc-700 bg-zinc-900 text-zinc-300">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-200">风险部外勤档案</p>
              <p className="text-xs text-zinc-500">
                {me.displayName} / {me.role === "admin" ? "admin" : "user"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {message ? <Badge tone="muted">{message}</Badge> : null}
            {error ? <Badge tone="default">{error}</Badge> : null}
            <Button variant="ghost" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              退出
            </Button>
          </div>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-57px)] lg:grid-cols-[330px_minmax(0,1fr)]">
        <aside className="border-b border-zinc-800 bg-zinc-900 p-4 lg:border-b-0 lg:border-r">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <p className="text-xs text-zinc-500">车卡</p>
              <h2 className="text-lg font-semibold text-zinc-200">{cards.length} 份档案</h2>
            </div>
            <Button
              size="icon"
              title="新建车卡"
              onClick={handleCreateCard}
              disabled={saving}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <Input
              className="pl-9"
              placeholder="检索姓名、编号、状态"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="max-h-[42vh] space-y-2 overflow-auto pr-1 lg:max-h-[calc(100vh-230px)]">
            {filteredCards.map((card) => (
              <button
                key={card.id}
                className={cn(
                  "block w-full rounded-md border p-3 text-left transition-colors",
                  selectedId === card.id
                    ? "border-zinc-600 bg-zinc-800 text-zinc-100"
                    : "border-zinc-800 bg-zinc-950 text-zinc-100 hover:bg-zinc-900"
                )}
                onClick={() => selectCard(card)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{card.name}</p>
                    <p
                      className={cn(
                        "mt-1 truncate text-xs",
                        selectedId === card.id ? "text-zinc-400" : "text-zinc-500"
                      )}
                    >
                      {card.personnelCode}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded border px-1.5 py-0.5 text-xs",
                      selectedId === card.id
                        ? "border-zinc-600 text-zinc-300"
                        : "border-zinc-700 text-zinc-400"
                    )}
                  >
                    {card.status}
                  </span>
                </div>
                {me.role === "admin" ? (
                  <p
                    className={cn(
                      "mt-2 truncate text-xs",
                      selectedId === card.id ? "text-zinc-400" : "text-zinc-500"
                    )}
                  >
                    {card.ownerDisplayName}
                  </p>
                ) : null}
              </button>
            ))}
          </div>
        </aside>

        <section className="p-4 lg:p-6">
          <div className="mx-auto max-w-6xl">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs text-zinc-500">
                  {selectedCard ? selectedCard.personnelCode : "未保存草稿"}
                </p>
                <h1 className="text-2xl font-semibold tracking-normal text-zinc-200">
                  {draft.identity.name || "未命名外勤人员"}
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="default">{draft.identity.rank}</Badge>
                <Badge tone="default">{draft.identity.clearanceLevel}</Badge>
                <Badge tone={draft.identity.status === "活跃" ? "dark" : "muted"}>
                  {draft.identity.status}
                </Badge>
                <Button
                  variant="outline"
                  onClick={handleDelete}
                  disabled={!selectedId || saving}
                >
                  <Trash2 className="h-4 w-4" />
                  删除
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4" />
                  保存
                </Button>
              </div>
            </div>

            <Tabs defaultValue="identity" className="w-full">
              <div className="overflow-x-auto">
                <TabsList>
                  <TabsTrigger value="identity">
                    <FileText className="mr-2 h-4 w-4" />
                    身份
                  </TabsTrigger>
                  <TabsTrigger value="ability">
                    <Activity className="mr-2 h-4 w-4" />
                    能力
                  </TabsTrigger>
                  <TabsTrigger value="status">
                    <ClipboardList className="mr-2 h-4 w-4" />
                    状态
                  </TabsTrigger>
                  <TabsTrigger value="notes">
                    <UserRound className="mr-2 h-4 w-4" />
                    注释
                  </TabsTrigger>
                  <TabsTrigger value="export">
                    <Eye className="mr-2 h-4 w-4" />
                    导出
                  </TabsTrigger>
                  {me.role === "admin" ? (
                    <TabsTrigger value="admin">
                      <UserCog className="mr-2 h-4 w-4" />
                      管理
                    </TabsTrigger>
                  ) : null}
                </TabsList>
              </div>

              <TabsContent value="identity">
                <IdentityPanel
                  draft={draft}
                  selectedId={selectedId}
                  uploading={uploading}
                  updateIdentity={updateIdentity}
                  updateBackground={updateBackground}
                  onPhotoUpload={handlePhotoUpload}
                />
              </TabsContent>

              <TabsContent value="ability">
                <div className="space-y-4">
                  <Panel>
                    <SectionHeader
                      title="基础属性"
                      meta={[
                        `初始合计 ${attributeInitialTotal}`,
                        `总值合计 ${attributeTotal}`,
                      ]}
                    />
                    <RatingTable
                      fields={attributeFields}
                      values={draft.attributes}
                      max={20}
                      onChange={updateAttribute}
                    />
                  </Panel>
                  <Panel>
                    <SectionHeader title="专业能力" meta={[`总值合计 ${skillTotal}`]} />
                    <RatingTable
                      fields={skillFields}
                      values={draft.skills}
                      max={6}
                      onChange={updateSkill}
                    />
                  </Panel>
                  <Panel>
                    <SectionHeader
                      title="异常抗性"
                      meta={[
                        `抗性基准 ${resistanceBase}`,
                        `总值合计 ${resistanceTotal}`,
                      ]}
                    />
                    <RatingTable
                      fields={resistanceFields}
                      values={draft.resistances}
                      max={10}
                      onChange={updateResistance}
                    />
                  </Panel>
                </div>
              </TabsContent>

              <TabsContent value="status">
                <StatusPanel
                  draft={draft}
                  equippedCount={equippedCount}
                  updateCondition={updateCondition}
                  updateEquipment={updateEquipment}
                  updateCustomEquipment={updateCustomEquipment}
                />
              </TabsContent>

              <TabsContent value="notes">
                <Panel>
                  <div className="grid gap-4 md:grid-cols-2">
                    <AreaField
                      label="记忆强化药物使用"
                      value={draft.aftermath.drugUse}
                      onChange={(value) => updateAftermath("drugUse", value)}
                    />
                    <AreaField
                      label="记忆删除史"
                      value={draft.aftermath.amnesticHistory}
                      onChange={(value) => updateAftermath("amnesticHistory", value)}
                    />
                    <AreaField
                      label="现实稳定锚记录"
                      value={draft.aftermath.sraDependency}
                      onChange={(value) => updateAftermath("sraDependency", value)}
                    />
                    <AreaField
                      label="认知屏蔽装备耐受"
                      value={draft.aftermath.shieldingTolerance}
                      onChange={(value) =>
                        updateAftermath("shieldingTolerance", value)
                      }
                    />
                    <div className="md:col-span-2">
                      <AreaField
                        label="主管注释"
                        value={draft.aftermath.supervisorNotes}
                        onChange={(value) =>
                          updateAftermath("supervisorNotes", value)
                        }
                      />
                    </div>
                  </div>
                </Panel>
              </TabsContent>

              <TabsContent value="export">
                <ExportPanel
                  draft={draft}
                  card={selectedCard}
                  profile={profile}
                  command={exportCommand}
                  shareHours={shareHours}
                  setShareHours={setShareHours}
                  onShare={handleShare}
                  onRevokeShare={handleRevokeShare}
                  onCopy={copyText}
                  saving={saving}
                />
              </TabsContent>

              {me.role === "admin" ? (
                <TabsContent value="admin">
                  <AdminPanel
                    users={users}
                    cards={cards}
                    onUserUpdate={updateUser}
                    onCardUpdate={upsertCard}
                  />
                </TabsContent>
              ) : null}
            </Tabs>
          </div>
        </section>
      </div>
    </main>
  );
}

function AuthScreen({
  authMode,
  setAuthMode,
  authForm,
  setAuthForm,
  error,
  message,
  saving,
  onSubmit,
}: {
  authMode: AuthMode;
  setAuthMode: (mode: AuthMode) => void;
  authForm: { username: string; displayName: string; password: string };
  setAuthForm: React.Dispatch<
    React.SetStateAction<{ username: string; displayName: string; password: string }>
  >;
  error: string;
  message: string;
  saving: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <section className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_430px]">
        <div className="hidden border-r border-zinc-800 bg-zinc-900 p-8 lg:flex lg:flex-col lg:justify-between">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200">
              <Shield className="h-4 w-4" />
              风险部外勤档案
            </div>
            <div className="max-w-xl space-y-4">
              <h1 className="text-4xl font-semibold tracking-normal text-zinc-200">
                车卡登记台
              </h1>
              <p className="text-sm leading-7 text-zinc-400">
                黑灰夜间界面，集中管理外勤档案、状态评估、装备和导出展示。
              </p>
            </div>
          </div>

          <div className="max-w-xl rounded-md border border-zinc-800 bg-zinc-950 p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-500">档案样张</p>
                <p className="text-lg font-semibold text-zinc-200">ARD-000-2026</p>
              </div>
              <Badge tone="dark">D级</Badge>
            </div>
            <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-4">
              <div className="grid aspect-square place-items-center rounded-md border border-zinc-700 bg-zinc-900">
                <UserRound className="h-9 w-9 text-zinc-500" />
              </div>
              <div className="space-y-3">
                {["身份", "能力评估", "异常抗性", "导出展示"].map((item) => (
                  <div
                    key={item}
                    className="h-8 rounded border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center p-6">
          <form
            onSubmit={onSubmit}
            className="w-full max-w-sm rounded-md border border-zinc-800 bg-zinc-900 p-5 shadow-2xl shadow-black/40"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-500">账户</p>
                <h2 className="text-xl font-semibold text-zinc-200">
                  {authMode === "register" ? "注册" : "登录"}
                </h2>
              </div>
              <LockKeyhole className="h-5 w-5 text-zinc-500" />
            </div>

            <div className="space-y-4">
              <Field label="账号">
                <Input
                  autoComplete="username"
                  value={authForm.username}
                  onChange={(event) =>
                    setAuthForm((current) => ({
                      ...current,
                      username: event.target.value,
                    }))
                  }
                />
              </Field>
              {authMode === "register" ? (
                <Field label="显示名">
                  <Input
                    value={authForm.displayName}
                    onChange={(event) =>
                      setAuthForm((current) => ({
                        ...current,
                        displayName: event.target.value,
                      }))
                    }
                  />
                </Field>
              ) : null}
              <Field label="密码">
                <Input
                  type="password"
                  autoComplete={
                    authMode === "register" ? "new-password" : "current-password"
                  }
                  value={authForm.password}
                  onChange={(event) =>
                    setAuthForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                />
              </Field>
            </div>

            {error ? <Notice tone="error">{error}</Notice> : null}
            {message ? <Notice>{message}</Notice> : null}

            <Button className="mt-5 w-full" type="submit" disabled={saving}>
              {authMode === "register" ? "注册并进入" : "登录"}
            </Button>

            <button
              type="button"
              className="mt-4 w-full text-center text-sm text-zinc-500 hover:text-zinc-200"
              onClick={() =>
                setAuthMode(authMode === "register" ? "login" : "register")
              }
            >
              {authMode === "register" ? "已有账号，去登录" : "没有账号，去注册"}
            </button>

            <p className="mt-4 border-t border-zinc-800 pt-4 text-xs leading-6 text-zinc-500">
              首位注册者自动成为 admin，之后注册者为普通用户。
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}

function IdentityPanel({
  draft,
  selectedId,
  uploading,
  updateIdentity,
  updateBackground,
  onPhotoUpload,
}: {
  draft: CardContent;
  selectedId: string | null;
  uploading: boolean;
  updateIdentity: <K extends keyof CardContent["identity"]>(
    key: K,
    value: CardContent["identity"][K]
  ) => void;
  updateBackground: <K extends keyof CardContent["background"]>(
    key: K,
    value: CardContent["background"][K]
  ) => void;
  onPhotoUpload: (file: File | null) => void;
}) {
  return (
    <Panel>
      <div className="grid gap-5 lg:grid-cols-[210px_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="overflow-hidden rounded-md border border-zinc-800 bg-zinc-950">
            <div className="grid aspect-[3/4] place-items-center">
              {draft.identity.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={draft.identity.photoUrl}
                  alt={draft.identity.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="text-center text-zinc-500">
                  <UserRound className="mx-auto h-10 w-10" />
                  <p className="mt-2 text-xs">人物肖像</p>
                </div>
              )}
            </div>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-zinc-400">
              上传照片
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={!selectedId || uploading}
              className="block w-full text-xs text-zinc-400 file:mr-3 file:h-8 file:rounded-md file:border file:border-zinc-700 file:bg-zinc-800 file:px-3 file:text-sm file:font-medium file:text-zinc-100 disabled:opacity-50"
              onChange={(event) => {
                void onPhotoUpload(event.target.files?.[0] ?? null);
                event.currentTarget.value = "";
              }}
            />
          </label>
          <Field label="肖像标注">
            <Input
              value={draft.identity.portraitNote}
              onChange={(event) => updateIdentity("portraitNote", event.target.value)}
            />
          </Field>
          {!selectedId ? (
            <p className="text-xs leading-5 text-zinc-500">请先保存或点击加号创建卡，再上传照片。</p>
          ) : null}
        </div>

        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="姓名">
              <Input
                value={draft.identity.name}
                onChange={(event) => updateIdentity("name", event.target.value)}
              />
            </Field>
            <Field label="部门">
              <Input
                value={draft.identity.department}
                onChange={(event) => updateIdentity("department", event.target.value)}
              />
            </Field>
            <Field label="人员编号">
              <Input
                value={draft.identity.personnelCode}
                onChange={(event) =>
                  updateIdentity("personnelCode", event.target.value)
                }
              />
            </Field>
            <SelectField
              label="等级"
              value={draft.identity.rank}
              onChange={(value) =>
                updateIdentity("rank", value as CardContent["identity"]["rank"])
              }
              options={["D级", "C级", "B级"].map((value) => ({ label: value, value }))}
            />
            <SelectField
              label="安全权限"
              value={draft.identity.clearanceLevel}
              onChange={(value) =>
                updateIdentity(
                  "clearanceLevel",
                  value as CardContent["identity"]["clearanceLevel"]
                )
              }
              options={["1级", "2级", "3级", "4级"].map((value) => ({
                label: value,
                value,
              }))}
            />
            <SelectField
              label="状态"
              value={draft.identity.status}
              onChange={(value) =>
                updateIdentity("status", value as CardContent["identity"]["status"])
              }
              options={["活跃", "休养", "失联", "KIA"].map((value) => ({
                label: value,
                value,
              }))}
            />
            <Field label="精神评估日期">
              <Input
                type="date"
                value={draft.identity.lastAssessmentDate}
                onChange={(event) =>
                  updateIdentity("lastAssessmentDate", event.target.value)
                }
              />
            </Field>
            <SelectField
              label="精神评估结果"
              value={draft.identity.lastAssessmentResult}
              onChange={(value) =>
                updateIdentity(
                  "lastAssessmentResult",
                  value as CardContent["identity"]["lastAssessmentResult"]
                )
              }
              options={["合格", "边缘", "需复检", "暂时停职"].map((value) => ({
                label: value,
                value,
              }))}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="加入基金会前的职业">
              <Input
                value={draft.background.previousProfession}
                onChange={(event) =>
                  updateBackground("previousProfession", event.target.value)
                }
              />
            </Field>
            <Field label="爱好">
              <Input
                value={draft.background.hobbies}
                onChange={(event) => updateBackground("hobbies", event.target.value)}
              />
            </Field>
            <AreaField
              label="因什么入狱"
              value={draft.background.incarcerationReason}
              onChange={(value) => updateBackground("incarcerationReason", value)}
            />
            <AreaField
              label="为什么这么做"
              value={draft.background.motive}
              onChange={(value) => updateBackground("motive", value)}
            />
            <AreaField
              label="你认为你有罪吗"
              value={draft.background.guiltView}
              onChange={(value) => updateBackground("guiltView", value)}
            />
            <AreaField
              label="对周围人的态度"
              value={draft.background.peopleAttitude}
              onChange={(value) => updateBackground("peopleAttitude", value)}
            />
            <AreaField
              label="对收容物的态度"
              value={draft.background.anomalyAttitude}
              onChange={(value) => updateBackground("anomalyAttitude", value)}
            />
            <AreaField
              label="对工作的态度"
              value={draft.background.workAttitude}
              onChange={(value) => updateBackground("workAttitude", value)}
            />
            <AreaField
              label="对队友的态度"
              value={draft.background.teammateAttitude}
              onChange={(value) => updateBackground("teammateAttitude", value)}
            />
            <AreaField
              label="目击者与网络内容处置"
              value={draft.background.civilianProtocol}
              onChange={(value) => updateBackground("civilianProtocol", value)}
            />
            <Field label="喜欢什么动物">
              <Input
                value={draft.background.favoriteAnimal}
                onChange={(event) =>
                  updateBackground("favoriteAnimal", event.target.value)
                }
              />
            </Field>
            <Field label="喜欢什么食物">
              <Input
                value={draft.background.favoriteFood}
                onChange={(event) =>
                  updateBackground("favoriteFood", event.target.value)
                }
              />
            </Field>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function StatusPanel({
  draft,
  equippedCount,
  updateCondition,
  updateEquipment,
  updateCustomEquipment,
}: {
  draft: CardContent;
  equippedCount: number;
  updateCondition: (key: ConditionKey, value: number) => void;
  updateEquipment: (key: EquipmentKey, value: boolean) => void;
  updateCustomEquipment: (items: CustomEquipment[]) => void;
}) {
  function updateCustom(id: string, patch: Partial<CustomEquipment>) {
    updateCustomEquipment(
      draft.customEquipment.map((item) =>
        item.id === id ? { ...item, ...patch } : item
      )
    );
  }

  function addCustom() {
    updateCustomEquipment([
      ...draft.customEquipment,
      {
        id: `custom-${Date.now()}`,
        name: "",
        carried: true,
        effect: "",
      },
    ]);
  }

  function removeCustom(id: string) {
    updateCustomEquipment(draft.customEquipment.filter((item) => item.id !== id));
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <Panel>
        <SectionHeader title="状态评估" meta={["当前值 / 临界值"]} />
        <div className="space-y-4">
          {conditionFields.map((condition) => (
            <ConditionSlider
              key={condition.key}
              label={condition.label}
              code={condition.code}
              thresholds={condition.thresholds}
              value={draft.conditions[condition.key]}
              onChange={(value) => updateCondition(condition.key, value)}
            />
          ))}
        </div>
      </Panel>

      <Panel>
        <SectionHeader title="物品申请" meta={[`已携带 ${equippedCount}`]} />
        <div className="space-y-2">
          {equipmentFields.map((equipment) => (
            <label
              key={equipment.key}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-zinc-800 bg-zinc-950 p-3 transition-colors hover:bg-zinc-900"
            >
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-zinc-700 accent-zinc-500"
                checked={draft.equipment[equipment.key]}
                onChange={(event) =>
                  updateEquipment(equipment.key, event.target.checked)
                }
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-zinc-100">
                  {equipment.label}
                </span>
                <span className="mt-1 block text-xs leading-5 text-zinc-500">
                  {equipment.effect}
                </span>
              </span>
            </label>
          ))}
        </div>

        <div className="mt-5 border-t border-zinc-800 pt-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-200">自定义携带物</h3>
            <Button size="sm" variant="secondary" onClick={addCustom}>
              <Plus className="h-4 w-4" />
              添加
            </Button>
          </div>
          <div className="space-y-3">
            {draft.customEquipment.map((item) => (
              <div
                key={item.id}
                className="rounded-md border border-zinc-800 bg-zinc-950 p-3"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-zinc-700 accent-zinc-500"
                    checked={item.carried}
                    onChange={(event) =>
                      updateCustom(item.id, { carried: event.target.checked })
                    }
                  />
                  <Input
                    placeholder="物品名称"
                    value={item.name}
                    onChange={(event) =>
                      updateCustom(item.id, { name: event.target.value })
                    }
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    title="移除"
                    onClick={() => removeCustom(item.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <Input
                  className="mt-2"
                  placeholder="加成或备注"
                  value={item.effect}
                  onChange={(event) =>
                    updateCustom(item.id, { effect: event.target.value })
                  }
                />
              </div>
            ))}
            {!draft.customEquipment.length ? (
              <p className="rounded-md border border-dashed border-zinc-800 px-3 py-6 text-center text-xs text-zinc-500">
                暂无自定义携带物
              </p>
            ) : null}
          </div>
        </div>
      </Panel>
    </div>
  );
}

function ExportPanel({
  draft,
  card,
  profile,
  command,
  shareHours,
  setShareHours,
  onShare,
  onRevokeShare,
  onCopy,
  saving,
}: {
  draft: CardContent;
  card: AgentCard | null;
  profile: ReturnType<typeof createProfileSummary>;
  command: string;
  shareHours: number;
  setShareHours: (value: number) => void;
  onShare: () => void;
  onRevokeShare: () => void;
  onCopy: (text: string) => void;
  saving: boolean;
}) {
  const shareUrl = absoluteShareUrl(card?.shareUrl ?? null);

  return (
    <div className="space-y-4">
      <Panel>
        <div className="grid gap-5 lg:grid-cols-[190px_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-md border border-zinc-800 bg-zinc-950">
            <div className="grid aspect-[3/4] place-items-center">
              {draft.identity.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={draft.identity.photoUrl}
                  alt={draft.identity.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="text-center text-zinc-500">
                  <Camera className="mx-auto h-9 w-9" />
                  <p className="mt-2 text-xs">无照片</p>
                </div>
              )}
            </div>
          </div>
          <div className="min-w-0">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs text-zinc-500">{draft.identity.personnelCode}</p>
                <h2 className="mt-1 text-2xl font-semibold text-zinc-200">
                  {draft.identity.name}
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {[draft.identity.rank, draft.identity.clearanceLevel, draft.identity.status].map(
                  (item) => (
                    <Badge key={item} tone={item === "活跃" ? "dark" : "default"}>
                      {item}
                    </Badge>
                  )
                )}
              </div>
            </div>
            <p className="text-sm leading-7 text-zinc-400">{profile.brief}</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <MiniList title="身份" lines={profile.identity} />
              <MiniList title="状态" lines={profile.conditions} />
              <MiniList title="携带物" lines={profile.equipment} />
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel>
          <SectionHeader title="导出指令" meta={["单行 .st", "公开链接隐藏"]} />
          <pre className="overflow-x-auto rounded-md border border-zinc-800 bg-black p-4 text-xs leading-6 text-zinc-300">
            <code className="whitespace-nowrap">{command}</code>
          </pre>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => onCopy(command)}>
              <Copy className="h-4 w-4" />
              复制 .st 指令
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                onCopy(
                  [
                    profile.title,
                    ...profile.identity,
                    ...profile.attributes,
                    ...profile.skills,
                    ...profile.resistances,
                    ...profile.conditions,
                    `携带物：${profile.equipment.join("、")}`,
                    `简介：${profile.brief}`,
                  ].join("\n")
                )
              }
            >
              <Copy className="h-4 w-4" />
              复制简介
            </Button>
          </div>
        </Panel>

        <Panel>
          <SectionHeader title="临时访问链接" meta={["公开展示页"]} />
          <Field label="有效期（小时）">
            <Input
              type="number"
              min={1}
              max={168}
              value={shareHours}
              onChange={(event) =>
                setShareHours(clampNumber(Number(event.target.value), 1, 168))
              }
            />
          </Field>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={onShare} disabled={!card || saving}>
              <Link className="h-4 w-4" />
              生成链接
            </Button>
            <Button
              variant="outline"
              onClick={onRevokeShare}
              disabled={!card?.shareUrl || saving}
            >
              撤销
            </Button>
          </div>
          {shareUrl ? (
            <div className="mt-4 space-y-2">
              <Input readOnly value={shareUrl} />
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => onCopy(shareUrl)}>
                  <Copy className="h-4 w-4" />
                  复制链接
                </Button>
                <Button variant="ghost" asChild>
                  <a href={shareUrl} target="_blank" rel="noreferrer">
                    <Eye className="h-4 w-4" />
                    打开
                  </a>
                </Button>
              </div>
              <p className="text-xs text-zinc-500">
                过期时间：{card?.shareExpiresAt ?? "未记录"}
              </p>
            </div>
          ) : (
            <p className="mt-4 rounded-md border border-dashed border-zinc-800 px-3 py-6 text-center text-xs text-zinc-500">
              保存卡后可生成临时访问链接。
            </p>
          )}
        </Panel>
      </div>

      <Panel>
        <SectionHeader title="一页展示数据" meta={["属性", "技能", "抗性"]} />
        <div className="grid gap-3 md:grid-cols-3">
          <MiniList title="基础属性" lines={profile.attributes} />
          <MiniList title="专业能力" lines={profile.skills} />
          <MiniList title="异常抗性" lines={profile.resistances} />
        </div>
      </Panel>
    </div>
  );
}

function AdminPanel({
  users,
  cards,
  onUserUpdate,
}: {
  users: SessionUser[];
  cards: AgentCard[];
  onUserUpdate: (user: SessionUser) => void;
  onCardUpdate: (card: AgentCard) => void;
}) {
  return (
    <div className="space-y-4">
      <Panel>
        <SectionHeader
          title="admin 面板"
          meta={[`用户 ${users.length}`, `车卡 ${cards.length}`]}
        />
        <div className="grid gap-3">
          {users.map((user) => (
            <AdminUserRow key={user.id} user={user} onUserUpdate={onUserUpdate} />
          ))}
        </div>
      </Panel>
      <Panel>
        <SectionHeader title="车卡归属概览" meta={["只读"]} />
        <div className="grid gap-2 text-sm">
          {cards.map((card) => (
            <div
              key={card.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2"
            >
              <span className="font-medium text-zinc-200">{card.name}</span>
              <span className="text-xs text-zinc-500">
                {card.personnelCode} / {card.ownerDisplayName}
              </span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function AdminUserRow({
  user,
  onUserUpdate,
}: {
  user: SessionUser;
  onUserUpdate: (user: SessionUser) => void;
}) {
  const [username, setUsername] = useState(user.username);
  const [displayName, setDisplayName] = useState(user.displayName);
  const [role, setRole] = useState<"admin" | "user">(user.role);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  async function saveUser() {
    setBusy(true);
    setNote("");
    try {
      const data = await requestJson<{ user: SessionUser }>(`/api/users/${user.id}`, {
        method: "PUT",
        body: JSON.stringify({
          username,
          displayName,
          role,
          password: password || undefined,
        }),
      });
      onUserUpdate(data.user);
      setPassword("");
      setNote("已保存");
    } catch (adminError) {
      setNote(adminError instanceof Error ? adminError.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3">
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_120px_1fr_auto]">
        <Field label="账号">
          <Input value={username} onChange={(event) => setUsername(event.target.value)} />
        </Field>
        <Field label="显示名">
          <Input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </Field>
        <SelectField
          label="角色"
          value={role}
          onChange={(value) => setRole(value as "admin" | "user")}
          options={[
            { label: "admin", value: "admin" },
            { label: "user", value: "user" },
          ]}
        />
        <Field label="新密码">
          <Input
            type="password"
            placeholder="留空不修改"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        <div className="flex items-end">
          <Button onClick={saveUser} disabled={busy}>
            保存
          </Button>
        </div>
      </div>
      {note ? <p className="mt-2 text-xs text-zinc-500">{note}</p> : null}
    </div>
  );
}

function MiniList({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3">
      <h3 className="mb-2 text-xs font-semibold text-zinc-300">{title}</h3>
      <div className="space-y-1 text-xs leading-5 text-zinc-500">
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900 p-4 shadow-2xl shadow-black/20 lg:p-5">
      {children}
    </div>
  );
}

function Notice({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "error";
}) {
  return (
    <div
      className={cn(
        "mt-4 rounded-md border px-3 py-2 text-sm",
        tone === "error"
          ? "border-zinc-700 bg-zinc-950 text-zinc-200"
          : "border-zinc-800 bg-zinc-950 text-zinc-400"
      )}
    >
      {children}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className={fieldShell}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function AreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <Textarea value={value} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <select
        className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

function SectionHeader({ title, meta }: { title: string; meta: string[] }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-base font-semibold text-zinc-200">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {meta.map((item) => (
          <Badge key={item} tone="muted">
            {item}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function RatingTable<T extends string>({
  fields,
  values,
  max,
  onChange,
}: {
  fields: ReadonlyArray<{ key: T; label: string; code?: string; hint?: string }>;
  values: Record<T, RatingLine>;
  max: number;
  onChange: (key: T, field: keyof RatingLine, value: number) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-zinc-800">
      <table className="w-full min-w-[620px] border-collapse text-sm">
        <thead className="bg-zinc-950 text-left text-xs text-zinc-500">
          <tr>
            <th className="w-[34%] px-3 py-2 font-medium">项目</th>
            <th className="px-3 py-2 font-medium">初始</th>
            <th className="px-3 py-2 font-medium">成长</th>
            <th className="px-3 py-2 font-medium">总值</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => (
            <tr key={field.key} className="border-t border-zinc-800">
              <td className="px-3 py-2">
                <div className="font-medium text-zinc-200">{field.label}</div>
                <div className="mt-1 text-xs text-zinc-500">
                  {[field.code, field.hint].filter(Boolean).join(" / ")}
                </div>
              </td>
              {(["initial", "growth", "total"] as const).map((lineKey) => (
                <td key={lineKey} className="px-3 py-2">
                  <Input
                    type="number"
                    min={0}
                    max={max}
                    className="h-8 w-20"
                    value={values[field.key][lineKey]}
                    onChange={(event) =>
                      onChange(
                        field.key,
                        lineKey,
                        clampNumber(Number(event.target.value), 0, max)
                      )
                    }
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConditionSlider({
  label,
  code,
  thresholds,
  value,
  onChange,
}: {
  label: string;
  code: string;
  thresholds: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-zinc-100">{label}</p>
          <p className="mt-1 text-xs text-zinc-500">
            {code} / {thresholds}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            max={100}
            className="h-8 w-20"
            value={value}
            onChange={(event) => onChange(Number(event.target.value))}
          />
          <span className="text-sm text-zinc-500">%</span>
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full accent-zinc-500"
      />
    </div>
  );
}
