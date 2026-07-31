import type { PersonaSpec } from "@/lib/v2/personas";

const mockOpinions: Record<string, string> = {
  "zhang-yiming-method":
    "先别急着回答“该不该”，把你已经确认的事实、自己的解释和真正害怕的结果分开。现在最危险的不是选错，而是用一段未经验证的叙述替你做决定。找一个七天内能获得反馈的小实验：约谈关键人物、核对一个数据，或验证外部机会，再根据新事实调整。",
  "munger-method":
    "反过来看：什么做法最容易让你一年后后悔？通常不是没有找到完美答案，而是在激励不一致的环境里继续投入，却没有设退出条件。把各方从现状中得到的好处写出来，再写清你的机会成本。先停止一个确定无效的动作，比增加三条建议更有用。",
  "taleb-method":
    "不要先比较哪条路看起来收益最高，先看哪种错误会让你失去继续选择的资格。现金流、健康、声誉和可逆性是底线。把大决定拆成有上限损失的小下注，保留回撤空间；如果一个方案只有预测正确才成立，它就比你想象中脆弱。",
  "zhang-xuefeng-method":
    "把问题落到现实条件：你有多少时间、现金、可迁移能力，以及目标岗位真正看什么。别用“行业前景”替代具体路径。找三个真实样本，核对门槛、薪资和进入方式，然后选一条两周内能完成第一步的路线；没有第一步的方向只是安慰。",
  "ren-zhengfei-method":
    "这件事要从组织需要的结果谈，而不是从谁理解谁开始。先说清目标、当前阻塞和你能承担的部分，再明确需要对方给出的资源或决定。把争议放到具体任务和时间点上，让下一次反馈有事实依据。情绪可以被看见，但不能代替责任边界。",
  "alibaba-method":
    "沟通前先对齐共同目标，否则每句话都会被听成立场对抗。用“我观察到的事实—它造成的影响—我建议的动作—何时复盘”来表达，少评价人，多描述协作接口。真正有效的沟通不是一次说服，而是让下一步由谁做、做到什么程度变得清楚。",
};

export function makePrototypeOpinion(persona: PersonaSpec) {
  return (
    mockOpinions[persona.id] ??
    "先把事实、约束和你愿意承担的代价分开，再选择一个可验证、可回撤的下一步。"
  );
}

export function splitOpinionForStreaming(opinion: string) {
  const segments = opinion.match(/[^。！？；]+[。！？；]?/g) ?? [opinion];
  return segments.filter(Boolean);
}

