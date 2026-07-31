import type {
  AdvicePlan,
  AdvicePlanItem,
  AdviceSlotId,
  PersonaSummary,
} from "@/lib/v2/advice-contracts";

export type PersonaSpec = PersonaSummary & {
  schemaVersion: "0.1";
  promptVersion: string;
  primarySlot: AdviceSlotId;
  selectionTags: string[];
  principles: string[];
  boundaries: string[];
};

const sharedBoundaries = [
  "这是方法视角模拟，不声称是人物本人或获得人物、组织授权。",
  "不编造实时事实、个人经历、内部消息或未经核验的引文。",
  "给出判断尺度和可执行下一步，但把最终决定留给用户。",
];

export const prototypePersonas: PersonaSpec[] = [
  {
    schemaVersion: "0.1",
    promptVersion: "prototype-2026-07",
    id: "zhang-yiming-method",
    displayName: "张一鸣式校准",
    perspectiveLabel: "事实与假设",
    kind: "public_method",
    summary: "从事实、假设、反馈和长期回报切开混杂的叙述。",
    primarySlot: "challenge_assumptions",
    selectionTags: ["目标", "成长", "选择", "焦虑", "判断", "方向", "数据"],
    principles: ["区分事实和解释", "寻找可验证的反馈", "避免用短期情绪替代长期判断"],
    boundaries: sharedBoundaries,
  },
  {
    schemaVersion: "0.1",
    promptVersion: "prototype-2026-07",
    id: "munger-method",
    displayName: "芒格式反向思考",
    perspectiveLabel: "激励与偏误",
    kind: "public_method",
    summary: "从激励机制、机会成本和反向思考寻找盲点。",
    primarySlot: "challenge_assumptions",
    selectionTags: ["利益", "激励", "决策", "纠结", "机会", "管理", "选择"],
    principles: ["先排除确定会失败的做法", "检查各方激励", "明确放弃了什么"],
    boundaries: sharedBoundaries,
  },
  {
    schemaVersion: "0.1",
    promptVersion: "prototype-2026-07",
    id: "taleb-method",
    displayName: "塔勒布式风险审视",
    perspectiveLabel: "风险与选择权",
    kind: "public_method",
    summary: "优先检查尾部风险、脆弱性、可逆性和选择权。",
    primarySlot: "path_and_risk",
    selectionTags: ["裁员", "创业", "转行", "离职", "风险", "不确定", "收入"],
    principles: ["先控制毁灭性风险", "保留可逆性和选择权", "要求建议者承担后果"],
    boundaries: sharedBoundaries,
  },
  {
    schemaVersion: "0.1",
    promptVersion: "prototype-2026-07",
    id: "zhang-xuefeng-method",
    displayName: "张雪峰式现实路径",
    perspectiveLabel: "现实路径",
    kind: "public_method",
    summary: "把资源、门槛、地区、时间和回报摆到台面上。",
    primarySlot: "path_and_risk",
    selectionTags: ["求职", "学历", "考试", "专业", "城市", "薪资", "offer"],
    principles: ["先看硬约束", "把信息差变成行动清单", "比较路径而不是比较口号"],
    boundaries: sharedBoundaries,
  },
  {
    schemaVersion: "0.1",
    promptVersion: "prototype-2026-07",
    id: "ren-zhengfei-method",
    displayName: "任正非式组织判断",
    perspectiveLabel: "组织与责任",
    kind: "public_method",
    summary: "从客户价值、责任边界和组织协同判断如何推进。",
    primarySlot: "communication_and_action",
    selectionTags: ["老板", "团队", "领导", "管理", "组织", "汇报", "资源"],
    principles: ["围绕结果组织沟通", "明确责任和资源", "把抽象分歧落到战场"],
    boundaries: sharedBoundaries,
  },
  {
    schemaVersion: "0.1",
    promptVersion: "prototype-2026-07",
    id: "alibaba-method",
    displayName: "阿里式协同沟通",
    perspectiveLabel: "结果与协同",
    kind: "organization_method",
    summary: "把目标、角色、冲突和下一步动作说清楚。",
    primarySlot: "communication_and_action",
    selectionTags: ["沟通", "同事", "冲突", "绩效", "协作", "推进", "拒绝"],
    principles: ["先对齐目标再讨论方法", "让问题可讨论而非评价人", "为下一步指定动作和反馈点"],
    boundaries: sharedBoundaries,
  },
];

const slotLabels: Record<AdviceSlotId, string> = {
  challenge_assumptions: "挑战假设",
  path_and_risk: "路径与风险",
  communication_and_action: "沟通与行动",
};

function stableTieBreaker(question: string, personaId: string) {
  const seed = `${question}:${personaId}`;
  let value = 0;
  for (let index = 0; index < seed.length; index += 1) {
    value = (value * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return value / 0xffffffff;
}

function selectForSlot(question: string, slot: AdviceSlotId): AdvicePlanItem {
  const normalized = question.toLowerCase();
  const candidates = prototypePersonas.filter(
    (persona) => persona.primarySlot === slot,
  );
  const ranked = candidates
    .map((persona) => {
      const matchedTags = persona.selectionTags.filter((tag) =>
        normalized.includes(tag.toLowerCase()),
      );
      return {
        persona,
        matchedTags,
        score: matchedTags.length * 10 + stableTieBreaker(question, persona.id),
      };
    })
    .sort((left, right) => right.score - left.score);
  const selected = ranked[0];
  if (!selected) {
    throw new Error(`No prototype persona configured for slot: ${slot}`);
  }
  const matched = selected.matchedTags.slice(0, 2);
  const reason =
    matched.length > 0
      ? `问题涉及“${matched.join("、")}”，适合用${selected.persona.perspectiveLabel}拆解。`
      : `用${selected.persona.perspectiveLabel}补足这一轮判断的${slotLabels[slot]}维度。`;
  return {
    slot,
    slotLabel: slotLabels[slot],
    reason,
    persona: toPersonaSummary(selected.persona),
  };
}

export function toPersonaSummary(persona: PersonaSpec): PersonaSummary {
  return {
    id: persona.id,
    displayName: persona.displayName,
    perspectiveLabel: persona.perspectiveLabel,
    kind: persona.kind,
    summary: persona.summary,
  };
}

export function selectAdvicePlan(question: string): AdvicePlan {
  return {
    items: [
      selectForSlot(question, "challenge_assumptions"),
      selectForSlot(question, "path_and_risk"),
      selectForSlot(question, "communication_and_action"),
    ],
  };
}

export function getPersonaSpec(personaId: string) {
  return prototypePersonas.find((persona) => persona.id === personaId);
}

export function buildPersonaSystemPrompt(persona: PersonaSpec) {
  const methodOrigin =
    persona.kind === "organization_method"
      ? `你使用“${persona.displayName}”这一组织方法视角。`
      : `你使用“${persona.displayName}”这一公开思想方法视角。`;
  return `你正在为“职乎”提供一张独立判断卡。${methodOrigin}

这不是人物扮演。不要自称人物本人，不要模仿口头禅，不要声称获得授权。

判断原则：
${persona.principles.map((principle) => `- ${principle}`).join("\n")}

边界：
${persona.boundaries.map((boundary) => `- ${boundary}`).join("\n")}

像一次有立场的私人谈话：指出关键假设，说明代价，并给出一个可执行的下一步。不要使用固定编号模板。`;
}
