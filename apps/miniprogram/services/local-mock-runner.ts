import type {
  AdvicePlan,
  AdvicePlanItem,
  AdviceRunCard,
  AdviceRunEvent,
  AdviceSlotId,
  PersonaSummary,
} from "../domain/advice";

type PrototypePersona = PersonaSummary & {
  slot: AdviceSlotId;
  tags: string[];
  opinion: string;
};

const personas: PrototypePersona[] = [
  {
    id: "zhang-yiming-method",
    displayName: "张一鸣式校准",
    perspectiveLabel: "事实与假设",
    kind: "public_method",
    summary: "从事实、假设、反馈和长期回报切开混杂的叙述。",
    slot: "challenge_assumptions",
    tags: ["目标", "成长", "焦虑", "方向", "数据"],
    opinion:
      "先别急着回答“该不该”，把你已经确认的事实、自己的解释和真正害怕的结果分开。现在最危险的不是选错，而是用一段未经验证的叙述替你做决定。找一个七天内能获得反馈的小实验，再根据新事实调整。",
  },
  {
    id: "munger-method",
    displayName: "芒格式反向思考",
    perspectiveLabel: "激励与偏误",
    kind: "public_method",
    summary: "从激励机制、机会成本和反向思考寻找盲点。",
    slot: "challenge_assumptions",
    tags: ["利益", "激励", "决策", "纠结", "机会", "管理"],
    opinion:
      "反过来看：什么做法最容易让你一年后后悔？把各方从现状中得到的好处写出来，再写清你的机会成本。先停止一个确定无效的动作，比增加三条建议更有用。",
  },
  {
    id: "steve-jobs-method",
    displayName: "乔布斯式聚焦",
    perspectiveLabel: "取舍与体验",
    kind: "public_method",
    summary: "从决定性体验、极致取舍和个人责任审视平庸妥协。",
    slot: "challenge_assumptions",
    tags: ["产品", "创意", "设计", "体验", "功能", "作品", "标准", "取舍"],
    opinion:
      "先问这件事真正决定体验的部分是什么。如果所有要求都同等重要，你实际上没有做选择。删掉不能证明核心价值的动作，把时间押在最能让结果产生质变的一处；然后亲自定义完成标准，不要用流程或多数意见掩盖对品质的责任。",
  },
  {
    id: "bytedance-method",
    displayName: "字节式务实校准",
    perspectiveLabel: "上下文与密度",
    kind: "organization_method",
    summary: "用充分上下文、坦诚反馈和快速试错检验组织叙事。",
    slot: "challenge_assumptions",
    tags: ["信息", "反馈", "协作", "效率", "复盘", "试错", "透明", "人才"],
    opinion:
      "先检查你们是否共享了足够上下文：目标、约束、评价标准和最新事实。如果信息只掌握在少数人手里，争论很容易退化成立场。把关键判断写清楚，主动暴露反例，设计一个短周期试验，让新信息而不是职位高低推动下一次决定。",
  },
  {
    id: "taleb-method",
    displayName: "塔勒布式风险审视",
    perspectiveLabel: "风险与选择权",
    kind: "public_method",
    summary: "优先检查尾部风险、脆弱性、可逆性和选择权。",
    slot: "path_and_risk",
    tags: ["裁员", "创业", "转行", "离职", "风险", "不确定"],
    opinion:
      "不要先比较哪条路看起来收益最高，先看哪种错误会让你失去继续选择的资格。现金流、健康、声誉和可逆性是底线。把大决定拆成有上限损失的小下注，保留回撤空间。",
  },
  {
    id: "zhang-xuefeng-method",
    displayName: "张雪峰式现实路径",
    perspectiveLabel: "现实路径",
    kind: "public_method",
    summary: "把资源、门槛、地区、时间和回报摆到台面上。",
    slot: "path_and_risk",
    tags: ["求职", "学历", "考试", "专业", "城市", "薪资", "offer"],
    opinion:
      "把问题落到现实条件：你有多少时间、现金、可迁移能力，以及目标岗位真正看什么。找三个真实样本，核对门槛、薪资和进入方式，然后选一条两周内能完成第一步的路线。",
  },
  {
    id: "naval-method",
    displayName: "Naval 式杠杆判断",
    perspectiveLabel: "自由与复利",
    kind: "public_method",
    summary: "从选择权、长期博弈、专长和杠杆判断一条路径是否值得投入。",
    slot: "path_and_risk",
    tags: ["自由", "副业", "创业", "长期", "复利", "杠杆", "专长", "时间"],
    opinion:
      "不要只比较下一份工作的工资，看看哪条路会积累真正属于你的专长、信誉和选择权。长期价值来自可以反复复用的能力，而不是更高强度地出售时间。先找一个小规模方式验证市场是否愿意为你的独特能力付费，再决定是否扩大投入。",
  },
  {
    id: "iflytek-method",
    displayName: "科大讯飞式产业判断",
    perspectiveLabel: "刚需与产业化",
    kind: "organization_method",
    summary: "同时检查源头能力、真实刚需、关键依赖和产业化里程碑。",
    slot: "path_and_risk",
    tags: ["技术", "AI", "研发", "落地", "产业", "客户", "自主", "项目"],
    opinion:
      "同时问两个问题：这件事是否触及真正需要长期积累的核心能力，客户是否愿意为它解决的刚需买单。只有技术高度没有落地路径会变成展示，只有短期订单没有源头能力也难以复利。定义一个可量化里程碑和停止条件，用事实决定继续投入还是转向。",
  },
  {
    id: "ren-zhengfei-method",
    displayName: "任正非式组织判断",
    perspectiveLabel: "组织与责任",
    kind: "public_method",
    summary: "从客户价值、责任边界和组织协同判断如何推进。",
    slot: "communication_and_action",
    tags: ["老板", "团队", "领导", "管理", "组织", "汇报", "资源"],
    opinion:
      "这件事要从组织需要的结果谈，而不是从谁理解谁开始。先说清目标、当前阻塞和你能承担的部分，再明确需要对方给出的资源或决定。把争议放到具体任务和时间点上。",
  },
  {
    id: "alibaba-method",
    displayName: "阿里式协同沟通",
    perspectiveLabel: "结果与协同",
    kind: "organization_method",
    summary: "把目标、角色、冲突和下一步动作说清楚。",
    slot: "communication_and_action",
    tags: ["沟通", "同事", "冲突", "绩效", "协作", "推进", "拒绝"],
    opinion:
      "沟通前先对齐共同目标，否则每句话都会被听成立场对抗。用“事实—影响—建议动作—复盘时间”来表达，少评价人，多描述协作接口，让下一步由谁做、做到什么程度变得清楚。",
  },
  {
    id: "cao-cao-method",
    displayName: "曹操式权变判断",
    perspectiveLabel: "人物与时机",
    kind: "public_method",
    summary: "先抓核心矛盾、关键人物、资源和时机，再形成果断行动。",
    slot: "communication_and_action",
    tags: ["竞争", "资源", "人才", "机会", "权责", "谈判", "局势", "时机"],
    opinion:
      "先别被表面的输赢牵着走，找出真正决定局势的那个人、那项资源和那个时间窗口。能争取的人才就争取，必须集中投入的战场就不要平均用力。行动要快，但先写清不能跨越的伦理边界和失败后的退路，权变不是没有原则。",
  },
  {
    id: "zhang-juzheng-method",
    displayName: "张居正式考成",
    perspectiveLabel: "责任与闭环",
    kind: "public_method",
    summary: "区分制度和执行问题，用责任人、期限与验收形成改革闭环。",
    slot: "communication_and_action",
    tags: ["改革", "执行", "制度", "流程", "责任", "期限", "考核", "推动"],
    opinion:
      "先分清这是制度设计有问题，还是已有制度无人执行。把目标改写成可以验收的结果，明确唯一责任人、期限、所需资源和复核节点。不要一开始推动全面改革，先在阻力可控的范围形成一个闭环，用结果争取下一步的授权。",
  },
];

const slotLabels: Record<AdviceSlotId, string> = {
  challenge_assumptions: "挑战假设",
  path_and_risk: "路径与风险",
  communication_and_action: "沟通与行动",
};

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function selectPersona(question: string, slot: AdviceSlotId) {
  const candidates = personas.filter((persona) => persona.slot === slot);
  return (
    candidates
      .map((persona) => ({
        persona,
        score: persona.tags.filter((tag) => question.includes(tag)).length,
      }))
      .sort((left, right) => right.score - left.score)[0]?.persona ?? candidates[0]
  );
}

function buildPlan(question: string) {
  const slots: AdviceSlotId[] = [
    "challenge_assumptions",
    "path_and_risk",
    "communication_and_action",
  ];
  const items: AdvicePlanItem[] = slots.map((slot) => {
    const persona = selectPersona(question, slot);
    const matched = persona.tags.filter((tag) => question.includes(tag)).slice(0, 2);
    return {
      slot,
      slotLabel: slotLabels[slot],
      reason:
        matched.length > 0
          ? `问题涉及“${matched.join("、")}”，适合用${persona.perspectiveLabel}拆解。`
          : `用${persona.perspectiveLabel}补足${slotLabels[slot]}维度。`,
      persona: {
        id: persona.id,
        displayName: persona.displayName,
        perspectiveLabel: persona.perspectiveLabel,
        kind: persona.kind,
        summary: persona.summary,
      },
    };
  });
  const plan: AdvicePlan = { items };
  const cards: AdviceRunCard[] = items.map((item) => ({
    id: id("card"),
    slot: item.slot,
    persona: item.persona,
  }));
  return { plan, cards };
}

function splitOpinion(opinion: string) {
  return (opinion.match(/[^。！？；]+[。！？；]?/g) ?? [opinion]).filter(Boolean);
}

export type AdviceRunCallbacks = {
  onEvent: (event: AdviceRunEvent) => void;
  onTransportError: (message: string) => void;
};

export type AdviceRunController = {
  cancel: () => void;
};

export function startLocalMockRun(
  question: string,
  callbacks: AdviceRunCallbacks,
): AdviceRunController {
  const runId = id("run");
  const { plan, cards } = buildPlan(question);
  const timers: number[] = [];
  let cancelled = false;
  let finished = 0;

  const schedule = (callback: () => void, delay: number) => {
    const timer = setTimeout(() => {
      if (!cancelled) callback();
    }, delay);
    timers.push(timer);
  };
  const finishCard = () => {
    finished += 1;
    if (finished === cards.length) {
      callbacks.onEvent({ type: "run.done", runId });
    }
  };

  schedule(
    () => callbacks.onEvent({ type: "plan", runId, plan, cards }),
    180,
  );
  cards.forEach((card, cardIndex) => {
    const persona = personas.find((item) => item.id === card.persona.id);
    if (!persona) return;
    const segments = splitOpinion(persona.opinion);
    let segmentIndex = 0;
    const emitNext = () => {
      const segment = segments[segmentIndex];
      if (segment) {
        callbacks.onEvent({
          type: "card.delta",
          runId,
          cardId: card.id,
          delta: segment,
        });
        segmentIndex += 1;
        schedule(emitNext, 260 + cardIndex * 90);
        return;
      }
      callbacks.onEvent({ type: "card.done", runId, cardId: card.id });
      finishCard();
    };
    schedule(emitNext, 520 + cardIndex * 220);
  });

  return {
    cancel() {
      cancelled = true;
      timers.forEach((timer) => clearTimeout(timer));
    },
  };
}

export function startLocalMockCardRetry(
  card: AdviceRunCard,
  callbacks: AdviceRunCallbacks,
): AdviceRunController {
  const runId = id("retry");
  const timers: number[] = [];
  let cancelled = false;
  const schedule = (callback: () => void, delay: number) => {
    const timer = setTimeout(() => {
      if (!cancelled) callback();
    }, delay);
    timers.push(timer);
  };
  const persona = personas.find((item) => item.id === card.persona.id);

  if (!persona) {
    schedule(() => {
      callbacks.onEvent({
        type: "card.failed",
        runId,
        cardId: card.id,
        error: "视角配置暂不可用",
      });
      callbacks.onEvent({ type: "run.done", runId });
    }, 180);
  } else {
    const segments = splitOpinion(persona.opinion);
    let segmentIndex = 0;
    const emitNext = () => {
      const delta = segments[segmentIndex];
      if (!delta) {
        callbacks.onEvent({
          type: "card.done",
          runId,
          cardId: card.id,
        });
        callbacks.onEvent({ type: "run.done", runId });
        return;
      }
      callbacks.onEvent({
        type: "card.delta",
        runId,
        cardId: card.id,
        delta,
      });
      segmentIndex += 1;
      schedule(emitNext, 210);
    };
    schedule(emitNext, 260);
  }

  return {
    cancel() {
      cancelled = true;
      timers.forEach((timer) => clearTimeout(timer));
    },
  };
}
