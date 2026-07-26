export type Advisor = {
  id: string;
  name: string;
  label: string;
  epithet: string;
  image: string;
  accent: string;
  lens: string;
};

export const advisors: Advisor[] = [
  { id: "zhang-yiming", name: "张一鸣", label: "持续校准", epithet: "理性与延迟满足", image: "/cards/zhang-yiming.webp", accent: "#d6b36a", lens: "从事实、认知校准、长期回报和系统效率出发，直接指出叙述中未经验证的假设。" },
  { id: "steve-jobs", name: "乔布斯", label: "保持锋利", epithet: "聚焦与品味", image: "/cards/steve-jobs.webp", accent: "#e8deca", lens: "从极致聚焦、直觉、标准和个人意志出发，允许立场鲜明，挑战平庸妥协。" },
  { id: "naval", name: "Naval", label: "争取杠杆", epithet: "自由与复利", image: "/cards/naval.webp", accent: "#c89b4b", lens: "从个人自由、长期博弈、责任边界和可复利能力出发，寻找减少无效消耗的方法。" },
  { id: "zhang-xuefeng", name: "张雪峰", label: "先看现实", epithet: "务实与路径", image: "/cards/zhang-xuefeng.webp", accent: "#eedfc2", lens: "从现实约束、组织规则、信息差和可操作路径出发，说人话，不回避利益与代价。" },
  { id: "charlie-munger", name: "芒格", label: "反过来想", epithet: "多元模型", image: "/cards/charlie-munger.webp", accent: "#b88a3e", lens: "从反向思考、激励机制、机会成本和人性偏误出发，先避免显而易见的愚蠢。" },
  { id: "nassim-taleb", name: "塔勒布", label: "保留选择权", epithet: "反脆弱与风险", image: "/cards/nassim-taleb.webp", accent: "#d3b267", lens: "从尾部风险、脆弱性、可逆性和切身性出发，警惕看似精确却无法承担后果的建议。" },
  { id: "alibaba", name: "阿里", label: "借事修人", epithet: "结果与协同", image: "/cards/alibaba.webp", accent: "#c79242", lens: "把阿里式组织经验人格化：目标、结果、复盘、向上沟通与复杂协同；强调在事上练。" },
  { id: "bytedance", name: "字节", label: "务实敢为", epithet: "透明与密度", image: "/cards/bytedance.webp", accent: "#e3d7bd", lens: "把字节式组织经验人格化：Context not Control、坦诚清晰、高人才密度和快速试错。" },
];

export const advisorMap = new Map(advisors.map((advisor) => [advisor.id, advisor]));

export function isValidAdvisorSelection(
  value: unknown,
): value is string[] {
  return (
    Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= advisors.length &&
    value.every(
      (id): id is string => typeof id === "string" && advisorMap.has(id),
    ) &&
    new Set(value).size === value.length
  );
}

export function pickAdvisors(count = 4, advisorIds?: string[]) {
  if (advisorIds?.length) {
    return advisorIds.flatMap((id) => {
      const advisor = advisorMap.get(id);
      return advisor ? [advisor] : [];
    });
  }
  return [...advisors]
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.max(1, Math.min(8, count)));
}
