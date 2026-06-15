import { notFound } from "next/navigation";
import { getD1 } from "@/db";
import { ensureDatabase } from "@/db/migrate";
import {
  attributeFields,
  conditionFields,
  createProfileSummary,
  equipmentFields,
  resistanceFields,
  skillFields,
} from "@/lib/card-model";
import { cardSelect, type CardRow, readCard } from "@/lib/server/cards";

type SharePageProps = {
  params: Promise<{
    token: string;
  }>;
};

type ReviewItem = {
  label: string;
  value: string;
  wide?: boolean;
};

function fallback(value: string | null | undefined) {
  const text = value?.trim();
  return text ? text : "未填写";
}

export default async function SharePage({ params }: SharePageProps) {
  await ensureDatabase();
  const { token } = await params;
  const row = await getD1()
    .prepare(
      `SELECT ${cardSelect}
      FROM cards
      INNER JOIN users ON users.id = cards.owner_id
      WHERE cards.share_token = ?
        AND cards.share_expires_at > ?`
    )
    .bind(token, new Date().toISOString())
    .first<CardRow>();

  if (!row) {
    notFound();
  }

  const card = readCard(row);
  const content = card.content;
  const profile = createProfileSummary(content);
  const photoUrl = card.photoUrl ? `/api/cards/${card.id}/photo?token=${token}` : "";
  const identityItems: ReviewItem[] = [
    { label: "姓名", value: fallback(content.identity.name) },
    { label: "人员编号", value: fallback(content.identity.personnelCode) },
    { label: "档案持有人", value: fallback(card.ownerDisplayName) },
    { label: "部门", value: fallback(content.identity.department) },
    { label: "等级", value: content.identity.rank },
    { label: "安全权限", value: content.identity.clearanceLevel },
    { label: "状态", value: content.identity.status },
    { label: "精神评估日期", value: fallback(content.identity.lastAssessmentDate) },
    { label: "精神评估结果", value: content.identity.lastAssessmentResult },
    { label: "肖像标注", value: fallback(content.identity.portraitNote), wide: true },
  ];
  const backgroundItems: ReviewItem[] = [
    { label: "加入基金会前的职业", value: fallback(content.background.previousProfession) },
    { label: "爱好", value: fallback(content.background.hobbies) },
    { label: "喜欢什么食物", value: fallback(content.background.favoriteFood) },
    { label: "喜欢什么动物", value: fallback(content.background.favoriteAnimal) },
    { label: "因什么入狱", value: fallback(content.background.incarcerationReason), wide: true },
    { label: "为什么这么做", value: fallback(content.background.motive), wide: true },
    { label: "你认为你有罪吗", value: fallback(content.background.guiltView), wide: true },
  ];
  const attitudeItems: ReviewItem[] = [
    { label: "对周围人的态度", value: fallback(content.background.peopleAttitude) },
    { label: "对收容物的态度", value: fallback(content.background.anomalyAttitude) },
    { label: "对工作的态度", value: fallback(content.background.workAttitude) },
    { label: "对队友的态度", value: fallback(content.background.teammateAttitude) },
    { label: "目击者与网络内容处置", value: fallback(content.background.civilianProtocol), wide: true },
  ];
  const aftermathItems: ReviewItem[] = [
    { label: "记忆强化药物使用", value: fallback(content.aftermath.drugUse) },
    { label: "记忆删除史", value: fallback(content.aftermath.amnesticHistory) },
    { label: "现实稳定锚记录", value: fallback(content.aftermath.sraDependency) },
    { label: "认知屏蔽装备耐受", value: fallback(content.aftermath.shieldingTolerance) },
    { label: "主管注释", value: fallback(content.aftermath.supervisorNotes), wide: true },
  ];
  const attributeLines = attributeFields.map((field) => {
    const line = content.attributes[field.key];
    return `${field.label} (${field.code})：初始 ${line.initial} / 成长 ${line.growth} / 总值 ${line.total}`;
  });
  const skillLines = skillFields.map((field) => {
    const line = content.skills[field.key];
    return `${field.label}：初始 ${line.initial} / 成长 ${line.growth} / 总值 ${line.total}`;
  });
  const resistanceLines = resistanceFields.map((field) => {
    const line = content.resistances[field.key];
    return `${field.label} (${field.code})：初始 ${line.initial} / 成长 ${line.growth} / 总值 ${line.total}`;
  });
  const conditionLines = conditionFields.map(
    (field) =>
      `${field.label} (${field.code})：${content.conditions[field.key]}% / 临界 ${field.thresholds}`
  );
  const equipmentLines = [
    ...equipmentFields.map(
      (field) =>
        `${field.label}：${content.equipment[field.key] ? "已携带" : "未携带"} / ${field.effect}`
    ),
    ...(content.customEquipment.length
      ? content.customEquipment.map(
          (item) =>
            `${fallback(item.name)}：${item.carried ? "已携带" : "未携带"} / ${fallback(
              item.effect
            )}`
        )
      : ["自定义携带物：未填写"]),
  ];

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-6 text-zinc-300">
      <article className="mx-auto max-w-6xl rounded-md border border-zinc-800 bg-zinc-900 p-4 shadow-2xl shadow-black/40 md:p-6">
        <header className="flex flex-col gap-5 border-b border-zinc-800 pb-5 md:flex-row">
          <div className="h-56 w-full overflow-hidden rounded-md border border-zinc-800 bg-zinc-950 md:w-44">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl}
                alt={card.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="grid h-full place-items-center text-sm text-zinc-500">
                无照片
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-normal text-zinc-500">
              KP 审核视图 / {card.personnelCode}
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal text-zinc-200">
              {card.name}
            </h1>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              {[card.rank, content.identity.clearanceLevel, card.status].map((item) => (
                <span
                  key={item}
                  className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-300"
                >
                  {item}
                </span>
              ))}
            </div>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-400">
              {profile.brief}
            </p>
            <div className="mt-4 grid gap-2 text-xs text-zinc-500 sm:grid-cols-2">
              <div>档案创建：{card.createdAt}</div>
              <div>最近更新：{card.updatedAt}</div>
            </div>
          </div>
        </header>

        <div className="grid gap-4 py-5">
          <ReviewGrid title="身份与审核基础" items={identityItems} />
          <ReviewGrid title="背景履历" items={backgroundItems} />
          <ReviewGrid title="态度与处置原则" items={attitudeItems} />
          <section className="grid gap-4 lg:grid-cols-2">
            <ReviewList title="基础属性" lines={attributeLines} />
            <ReviewList title="专业能力" lines={skillLines} />
            <ReviewList title="异常抗性" lines={resistanceLines} />
            <ReviewList title="状态风险" lines={conditionLines} />
          </section>
          <ReviewList title="携带物与装备效果" lines={equipmentLines} />
          <ReviewGrid title="后续记录" items={aftermathItems} />
        </div>
      </article>
    </main>
  );
}

function ReviewGrid({ title, items }: { title: string; items: ReviewItem[] }) {
  return (
    <section className="rounded-md border border-zinc-800 bg-zinc-950 p-4">
      <h2 className="mb-3 text-sm font-semibold text-zinc-200">{title}</h2>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <div
            key={`${item.label}-${item.value}`}
            className={`rounded border border-zinc-900 bg-zinc-950 px-3 py-2 ${
              item.wide ? "md:col-span-2 xl:col-span-3" : ""
            }`}
          >
            <div className="text-xs text-zinc-500">{item.label}</div>
            <div className="mt-1 whitespace-pre-wrap text-sm leading-6 text-zinc-300">
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReviewList({ title, lines }: { title: string; lines: string[] }) {
  return (
    <section className="rounded-md border border-zinc-800 bg-zinc-950 p-4">
      <h2 className="mb-3 text-sm font-semibold text-zinc-200">{title}</h2>
      <div className="grid gap-2 text-sm text-zinc-400">
        {lines.map((line) => (
          <div key={line} className="rounded border border-zinc-900 px-3 py-2">
            {line}
          </div>
        ))}
      </div>
    </section>
  );
}
