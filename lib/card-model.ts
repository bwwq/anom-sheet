export type Role = "admin" | "user";

export type SessionUser = {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  createdAt: string;
};

export type RatingLine = {
  initial: number;
  growth: number;
  total: number;
};

export type CustomEquipment = {
  id: string;
  name: string;
  carried: boolean;
  effect: string;
};

export type AttributeKey = "str" | "con" | "dex" | "int" | "cha" | "wil";
export type SkillKey =
  | "anomalyRecognition"
  | "intelAnalysis"
  | "socialEngineering"
  | "fieldAid"
  | "psychology"
  | "foundationProtocol"
  | "networkTracking"
  | "covertAction";
export type ResistanceKey = "mem" | "rt" | "am" | "mc" | "bio";
export type ConditionKey = "mcp" | "rtr" | "col" | "inj" | "stress";
export type EquipmentKey =
  | "sra"
  | "memeticMonitor"
  | "amnesticSpray"
  | "cognitiveHalo"
  | "encryptedRadio"
  | "fieldSuit"
  | "memoryBooster";

export type CardContent = {
  identity: {
    name: string;
    department: string;
    rank: "D级" | "C级" | "B级";
    clearanceLevel: "1级" | "2级" | "3级" | "4级";
    status: "活跃" | "休养" | "失联" | "KIA";
    portraitNote: string;
    photoUrl: string;
    personnelCode: string;
    lastAssessmentDate: string;
    lastAssessmentResult: "合格" | "边缘" | "需复检" | "暂时停职";
  };
  background: {
    previousProfession: string;
    incarcerationReason: string;
    motive: string;
    guiltView: string;
    hobbies: string;
    peopleAttitude: string;
    anomalyAttitude: string;
    workAttitude: string;
    teammateAttitude: string;
    civilianProtocol: string;
    favoriteAnimal: string;
    favoriteFood: string;
  };
  attributes: Record<AttributeKey, RatingLine>;
  skills: Record<SkillKey, RatingLine>;
  resistances: Record<ResistanceKey, RatingLine>;
  conditions: Record<ConditionKey, number>;
  equipment: Record<EquipmentKey, boolean>;
  customEquipment: CustomEquipment[];
  aftermath: {
    drugUse: string;
    amnesticHistory: string;
    sraDependency: string;
    shieldingTolerance: string;
    supervisorNotes: string;
  };
};

export type AgentCard = {
  id: string;
  ownerId: string;
  ownerUsername: string;
  ownerDisplayName: string;
  name: string;
  personnelCode: string;
  rank: string;
  status: string;
  photoUrl: string | null;
  shareUrl: string | null;
  shareToken: string | null;
  shareExpiresAt: string | null;
  content: CardContent;
  createdAt: string;
  updatedAt: string;
};

export const attributeFields = [
  { key: "str", label: "力量", code: "STR", hint: "负重、近战、击破障碍物" },
  { key: "con", label: "体质", code: "CON", hint: "抵抗伤害、疲劳、生理异常" },
  { key: "dex", label: "敏捷", code: "DEX", hint: "闪避、快速反应、精细操作" },
  { key: "int", label: "智力", code: "INT", hint: "信息整合、逻辑推理、异常解析" },
  { key: "cha", label: "魅力", code: "CHA", hint: "伪装诱导、安抚目击者、协作" },
  { key: "wil", label: "意志", code: "WIL", hint: "抵抗精神/模因攻击、保持理智" },
] as const satisfies ReadonlyArray<{
  key: AttributeKey;
  label: string;
  code: string;
  hint: string;
}>;

export const skillFields = [
  { key: "anomalyRecognition", label: "异常识别" },
  { key: "intelAnalysis", label: "情报分析" },
  { key: "socialEngineering", label: "伪装/社交工程" },
  { key: "fieldAid", label: "现场急救" },
  { key: "psychology", label: "心理学" },
  { key: "foundationProtocol", label: "基金会规程" },
  { key: "networkTracking", label: "电子/网络追踪" },
  { key: "covertAction", label: "隐秘行动" },
] as const satisfies ReadonlyArray<{ key: SkillKey; label: string }>;

export const resistanceFields = [
  { key: "mem", label: "模因抗性", code: "MEM-R" },
  { key: "rt", label: "现实扭曲抗性", code: "RT-R" },
  { key: "am", label: "逆模因抗性", code: "AM-R" },
  { key: "mc", label: "精神控制抗性", code: "MC-R" },
  { key: "bio", label: "生物/化学抗性", code: "BIO-R" },
] as const satisfies ReadonlyArray<{
  key: ResistanceKey;
  label: string;
  code: string;
}>;

export const conditionFields = [
  { key: "mcp", label: "模因污染度", code: "MCP", thresholds: "30/60/90" },
  { key: "rtr", label: "现实扭曲残留", code: "RTR", thresholds: "20/50/80" },
  { key: "col", label: "认知负荷", code: "COL", thresholds: "40/70/95" },
  { key: "inj", label: "生理损伤", code: "INJ", thresholds: "30/60/90" },
  { key: "stress", label: "精神压力", code: "STRESS", thresholds: "40/70/90" },
] as const satisfies ReadonlyArray<{
  key: ConditionKey;
  label: string;
  code: string;
  thresholds: string;
}>;

export const equipmentFields = [
  { key: "sra", label: "便携式 SRA-Mk3", effect: "+6RT-R，持续 4 小时" },
  { key: "memeticMonitor", label: "模因危害监测仪", effect: "显示 MCP 与周围 MCG 等级" },
  { key: "amnesticSpray", label: "SD-II 记忆删除喷雾 2 发", effect: "消除最近 15 分钟记忆" },
  { key: "cognitiveHalo", label: "个人认知屏蔽头环", effect: "+4MEM-R，-2WIL" },
  { key: "encryptedRadio", label: "加密全频通信器", effect: "无视常规信号屏蔽" },
  { key: "fieldSuit", label: "高风险外勤作战服", effect: "+20%BIO-R，+10%RT-R" },
  { key: "memoryBooster", label: "记忆强化剂 W-7", effect: "临时 -20%COL，反冲 +30%COL" },
] as const satisfies ReadonlyArray<{
  key: EquipmentKey;
  label: string;
  effect: string;
}>;

const defaultLine: RatingLine = { initial: 0, growth: 0, total: 0 };

function makeRatingMap<T extends string>(
  keys: ReadonlyArray<T>,
  value: RatingLine = defaultLine
) {
  return Object.fromEntries(
    keys.map((key) => [key, { ...value }])
  ) as Record<T, RatingLine>;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createDefaultCardContent(): CardContent {
  return {
    identity: {
      name: "未命名外勤人员",
      department: "风险部",
      rank: "D级",
      clearanceLevel: "1级",
      status: "活跃",
      portraitNote: "待上传",
      photoUrl: "",
      personnelCode: `ARD-000-${new Date().getFullYear()}`,
      lastAssessmentDate: "",
      lastAssessmentResult: "合格",
    },
    background: {
      previousProfession: "",
      incarcerationReason: "",
      motive: "",
      guiltView: "",
      hobbies: "",
      peopleAttitude: "",
      anomalyAttitude: "",
      workAttitude: "",
      teammateAttitude: "",
      civilianProtocol: "",
      favoriteAnimal: "",
      favoriteFood: "",
    },
    attributes: {
      ...makeRatingMap(attributeFields.map((field) => field.key), {
        initial: 10,
        growth: 0,
        total: 10,
      }),
    },
    skills: makeRatingMap(skillFields.map((field) => field.key)),
    resistances: makeRatingMap(resistanceFields.map((field) => field.key)),
    conditions: {
      mcp: 0,
      rtr: 0,
      col: 0,
      inj: 0,
      stress: 0,
    },
    equipment: {
      sra: false,
      memeticMonitor: false,
      amnesticSpray: false,
      cognitiveHalo: false,
      encryptedRadio: false,
      fieldSuit: false,
      memoryBooster: false,
    },
    customEquipment: [],
    aftermath: {
      drugUse: "",
      amnesticHistory: "",
      sraDependency: "",
      shieldingTolerance: "",
      supervisorNotes: "",
    },
  };
}

function mergeObject<T extends Record<string, unknown>>(base: T, input: unknown): T {
  if (!input || typeof input !== "object") {
    return base;
  }

  return { ...base, ...(input as Partial<T>) };
}

function normalizeNumber(value: unknown, min: number, max: number) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.round(number)));
}

function normalizeString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function mergeRatingMap<T extends string>(
  keys: ReadonlyArray<T>,
  base: Record<T, RatingLine>,
  input: unknown,
  max: number
) {
  const incoming = input && typeof input === "object" ? input : {};

  return Object.fromEntries(
    keys.map((key) => {
      const line =
        key in (incoming as Record<string, unknown>) &&
        typeof (incoming as Record<string, unknown>)[key] === "object"
          ? ((incoming as Record<string, unknown>)[key] as Partial<RatingLine>)
          : {};

      return [
        key,
        {
          initial: normalizeNumber(line.initial ?? base[key].initial, 0, max),
          growth: normalizeNumber(line.growth ?? base[key].growth, 0, max),
          total: normalizeNumber(line.total ?? base[key].total, 0, max),
        },
      ];
    })
  ) as Record<T, RatingLine>;
}

export function normalizeCardContent(input: unknown): CardContent {
  const base = createDefaultCardContent();
  const source = input && typeof input === "object" ? input : {};
  const record = source as Partial<CardContent>;

  return {
    identity: mergeObject(base.identity, record.identity),
    background: mergeObject(base.background, record.background),
    attributes: mergeRatingMap(
      attributeFields.map((field) => field.key),
      base.attributes,
      record.attributes,
      20
    ),
    skills: mergeRatingMap(
      skillFields.map((field) => field.key),
      base.skills,
      record.skills,
      6
    ),
    resistances: mergeRatingMap(
      resistanceFields.map((field) => field.key),
      base.resistances,
      record.resistances,
      10
    ),
    conditions: {
      mcp: normalizeNumber(record.conditions?.mcp ?? base.conditions.mcp, 0, 100),
      rtr: normalizeNumber(record.conditions?.rtr ?? base.conditions.rtr, 0, 100),
      col: normalizeNumber(record.conditions?.col ?? base.conditions.col, 0, 100),
      inj: normalizeNumber(record.conditions?.inj ?? base.conditions.inj, 0, 100),
      stress: normalizeNumber(
        record.conditions?.stress ?? base.conditions.stress,
        0,
        100
      ),
    },
    equipment: {
      ...base.equipment,
      ...(record.equipment ?? {}),
    },
    customEquipment: Array.isArray(record.customEquipment)
      ? record.customEquipment
          .map((item, index) => ({
            id:
              typeof item?.id === "string" && item.id
                ? item.id
                : `custom-${index + 1}`,
            name: normalizeString(item?.name, "自定义物品"),
            carried: Boolean(item?.carried),
            effect: normalizeString(item?.effect),
          }))
          .filter((item) => item.name.trim())
      : [],
    aftermath: mergeObject(base.aftermath, record.aftermath),
  };
}

export function duplicateCardContent(content: CardContent) {
  return clone(content);
}

export function createExportCommand(content: CardContent) {
  const entries = [
    ...attributeFields.map(
      (field) => [field.label, content.attributes[field.key].total] as const
    ),
    ...skillFields.map(
      (field) => [field.label, content.skills[field.key].total] as const
    ),
    ...resistanceFields.map(
      (field) => [field.label, content.resistances[field.key].total] as const
    ),
    ...conditionFields.map(
      (field) => [field.label, content.conditions[field.key]] as const
    ),
  ];

  return [".st", ...entries.flatMap(([label, value]) => [label, String(value)])].join(
    " "
  );
}

export function createProfileSummary(content: CardContent) {
  const carried = [
    ...equipmentFields
      .filter((field) => content.equipment[field.key])
      .map((field) => field.label),
    ...content.customEquipment
      .filter((item) => item.carried)
      .map((item) => item.name),
  ];

  return {
    title: `${content.identity.name || "未命名外勤人员"} / ${
      content.identity.personnelCode || "ARD-000-0000"
    }`,
    identity: [
      `部门：${content.identity.department || "风险部"}`,
      `等级：${content.identity.rank}`,
      `权限：${content.identity.clearanceLevel}`,
      `状态：${content.identity.status}`,
      `精神评估：${content.identity.lastAssessmentDate || "未记录"} / ${
        content.identity.lastAssessmentResult
      }`,
    ],
    attributes: attributeFields.map(
      (field) => `${field.label} ${content.attributes[field.key].total}`
    ),
    skills: skillFields.map(
      (field) => `${field.label} ${content.skills[field.key].total}`
    ),
    resistances: resistanceFields.map(
      (field) => `${field.label} ${content.resistances[field.key].total}`
    ),
    conditions: conditionFields.map(
      (field) =>
        `${field.label} ${content.conditions[field.key]}% / ${field.thresholds}`
    ),
    equipment: carried.length ? carried : ["未携带"],
    brief:
      content.background.previousProfession ||
      content.background.workAttitude ||
      content.aftermath.supervisorNotes ||
      "暂无简介",
  };
}
