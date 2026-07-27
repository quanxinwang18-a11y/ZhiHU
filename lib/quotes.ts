export type QuoteThemeId =
  | "accountability"
  | "ambition"
  | "career"
  | "craft"
  | "curiosity"
  | "decision"
  | "deliberation"
  | "equanimity"
  | "execution"
  | "fit"
  | "focus"
  | "freedom"
  | "governance"
  | "informed_choice"
  | "integrity"
  | "learning"
  | "long_termism"
  | "mortality"
  | "open_mindedness"
  | "resilience"
  | "risk"
  | "self_knowledge"
  | "self_management"
  | "survival"
  | "talent"
  | "time"
  | "trust"
  | "wealth";

export type QuoteTensionId =
  | "advice_vs_effect"
  | "age_vs_aspiration"
  | "brevity_vs_ambition"
  | "certainty_vs_uncertainty"
  | "closure_vs_openness"
  | "constraint_vs_agency"
  | "curiosity_vs_trend"
  | "desire_vs_deserving"
  | "design_vs_delivery"
  | "external_voice_vs_inner_voice"
  | "fragility_vs_antifragility"
  | "freedom_vs_status"
  | "impulse_vs_information"
  | "knowledge_vs_complacency"
  | "love_vs_obligation"
  | "ordinary_mind_vs_extraordinary_work"
  | "planning_vs_action"
  | "prestige_vs_fit"
  | "short_term_vs_long_term"
  | "silence_vs_integrity"
  | "summary_vs_tail_risk"
  | "trust_vs_procedure"
  | "volatility_vs_calm";

export type QuoteCatalogEntry = {
  readonly id: string;
  readonly advisorId: string;
  readonly quote: string;
  readonly author: string;
  readonly source: string;
  readonly themeIds: readonly QuoteThemeId[];
  readonly tensionIds: readonly QuoteTensionId[];
};

export const quoteCatalog = [
  {
    id: "zhang-yiming-equanimity",
    advisorId: "zhang-yiming",
    quote: "保持平常心，是听起来容易但重要的事情。",
    author: "张一鸣",
    source:
      "字节跳动九周年演讲《平常心做非常事》（2021）· https://www.bytedance.com/zh/news/606bf1ac053cc102d640c051",
    themeIds: ["equanimity", "self_management"],
    tensionIds: ["volatility_vs_calm"],
  },
  {
    id: "zhang-yiming-no-rush",
    advisorId: "zhang-yiming",
    quote: "不要匆忙下结论。",
    author: "张一鸣",
    source:
      "字节跳动九周年演讲《平常心做非常事》（2021）· https://www.bytedance.com/zh/news/606bf1ac053cc102d640c051",
    themeIds: ["decision", "open_mindedness"],
    tensionIds: ["certainty_vs_uncertainty"],
  },
  {
    id: "zhang-yiming-extraordinary",
    advisorId: "zhang-yiming",
    quote: "以平常心做非常事。",
    author: "张一鸣",
    source:
      "字节跳动九周年演讲《平常心做非常事》（2021）· https://www.bytedance.com/zh/news/606bf1ac053cc102d640c051",
    themeIds: ["ambition", "equanimity"],
    tensionIds: ["ordinary_mind_vs_extraordinary_work"],
  },
  {
    id: "steve-jobs-limited-time",
    advisorId: "steve-jobs",
    quote: "你的时间有限，不要把它浪费在过别人的生活上。",
    author: "乔布斯",
    source:
      "斯坦福大学毕业演讲（2005，中文意译）· https://news.stanford.edu/stories/2005/06/youve-got-find-love-jobs-says",
    themeIds: ["mortality", "self_knowledge", "time"],
    tensionIds: ["external_voice_vs_inner_voice"],
  },
  {
    id: "steve-jobs-inner-voice",
    advisorId: "steve-jobs",
    quote: "不要让他人的意见淹没你内心的声音。",
    author: "乔布斯",
    source:
      "斯坦福大学毕业演讲（2005，中文意译）· https://news.stanford.edu/stories/2005/06/youve-got-find-love-jobs-says",
    themeIds: ["decision", "self_knowledge"],
    tensionIds: ["external_voice_vs_inner_voice"],
  },
  {
    id: "steve-jobs-love-work",
    advisorId: "steve-jobs",
    quote: "做出伟大工作的唯一方式，是热爱你所做的事。",
    author: "乔布斯",
    source:
      "斯坦福大学毕业演讲（2005，中文意译）· https://news.stanford.edu/stories/2005/06/youve-got-find-love-jobs-says",
    themeIds: ["ambition", "craft", "focus"],
    tensionIds: ["love_vs_obligation"],
  },
  {
    id: "naval-wealth",
    advisorId: "naval",
    quote: "追求财富，而不是金钱或地位。",
    author: "Naval",
    source:
      "《How to Get Rich》访谈之《Seek Wealth, Not Money or Status》（2019，中文意译）· https://nav.al/seek-wealth",
    themeIds: ["freedom", "wealth"],
    tensionIds: ["freedom_vs_status"],
  },
  {
    id: "naval-long-term",
    advisorId: "naval",
    quote: "与长期的人，玩长期的游戏。",
    author: "Naval",
    source:
      "《How to Get Rich》访谈之《Play Long-term Games With Long-term People》（2019，中文意译）· https://nav.al/long-term",
    themeIds: ["long_termism", "trust"],
    tensionIds: ["short_term_vs_long_term"],
  },
  {
    id: "naval-specific-knowledge",
    advisorId: "naval",
    quote: "专长来自追随自己的好奇心。",
    author: "Naval",
    source:
      "《How to Get Rich》访谈之《Arm Yourself With Specific Knowledge》（2019，中文意译）· https://nav.al/specific-knowledge",
    themeIds: ["curiosity", "learning"],
    tensionIds: ["curiosity_vs_trend"],
  },
  {
    id: "zhang-xuefeng-informed-choice",
    advisorId: "zhang-xuefeng",
    quote: "盲目去做选择，大概率是错的。",
    author: "张雪峰",
    source:
      "《中国新闻周刊》对话张雪峰（2023）· https://news.inewsweek.cn/people/2023-06-15/18840.shtml",
    themeIds: ["decision", "informed_choice"],
    tensionIds: ["impulse_vs_information"],
  },
  {
    id: "zhang-xuefeng-fit",
    advisorId: "zhang-xuefeng",
    quote: "适合自己的就是最好。",
    author: "张雪峰",
    source:
      "《中国新闻周刊》对话张雪峰（2023）· https://news.inewsweek.cn/people/2023-06-15/18840.shtml",
    themeIds: ["fit", "self_knowledge"],
    tensionIds: ["prestige_vs_fit"],
  },
  {
    id: "zhang-xuefeng-profession",
    advisorId: "zhang-xuefeng",
    quote: "好的专业，是可以为行业赋能的。",
    author: "张雪峰",
    source:
      "《中国新闻周刊》对话张雪峰（2023）· https://news.inewsweek.cn/people/2023-06-15/18840.shtml",
    themeIds: ["career", "craft"],
    tensionIds: ["prestige_vs_fit"],
  },
  {
    id: "charlie-munger-deserve",
    advisorId: "charlie-munger",
    quote: "想得到某样东西，最稳妥的办法是先让自己配得上它。",
    author: "芒格",
    source:
      "南加州大学法学院毕业演讲（2007，中文意译）· https://jamesclear.com/great-speeches/2007-usc-law-school-commencement-address-by-charlie-munger",
    themeIds: ["accountability", "integrity"],
    tensionIds: ["desire_vs_deserving"],
  },
  {
    id: "charlie-munger-wisdom-duty",
    advisorId: "charlie-munger",
    quote: "获得智慧是一种道德责任。",
    author: "芒格",
    source:
      "南加州大学法学院毕业演讲（2007，中文意译）· https://jamesclear.com/great-speeches/2007-usc-law-school-commencement-address-by-charlie-munger",
    themeIds: ["integrity", "learning"],
    tensionIds: ["knowledge_vs_complacency"],
  },
  {
    id: "charlie-munger-lifelong-learning",
    advisorId: "charlie-munger",
    quote: "没有终身学习，你们不会走得很远。",
    author: "芒格",
    source:
      "南加州大学法学院毕业演讲（2007，中文意译）· https://jamesclear.com/great-speeches/2007-usc-law-school-commencement-address-by-charlie-munger",
    themeIds: ["learning", "long_termism"],
    tensionIds: ["knowledge_vs_complacency"],
  },
  {
    id: "nassim-taleb-candle-fire",
    advisorId: "nassim-taleb",
    quote: "风能熄灭蜡烛，也能助长烈火。",
    author: "塔勒布",
    source: "《反脆弱》（Antifragile，2012，中文意译）",
    themeIds: ["resilience", "risk"],
    tensionIds: ["fragility_vs_antifragility"],
  },
  {
    id: "nassim-taleb-average-river",
    advisorId: "nassim-taleb",
    quote: "不要过一条平均四英尺深的河。",
    author: "塔勒布",
    source: "《非对称风险》（Skin in the Game，2018，中文意译）",
    themeIds: ["decision", "risk"],
    tensionIds: ["summary_vs_tail_risk"],
  },
  {
    id: "nassim-taleb-name-fraud",
    advisorId: "nassim-taleb",
    quote: "看见欺诈却不说破，你也成了欺诈的一部分。",
    author: "塔勒布",
    source: "《智慧与魔咒》（The Bed of Procrustes，2010，中文意译）",
    themeIds: ["integrity", "risk"],
    tensionIds: ["silence_vs_integrity"],
  },
  {
    id: "cao-cao-life",
    advisorId: "cao-cao",
    quote: "对酒当歌，人生几何？",
    author: "曹操",
    source: "《短歌行》",
    themeIds: ["mortality", "time"],
    tensionIds: ["brevity_vs_ambition"],
  },
  {
    id: "cao-cao-talent",
    advisorId: "cao-cao",
    quote: "山不厌高，海不厌深。",
    author: "曹操",
    source: "《短歌行》",
    themeIds: ["ambition", "talent"],
    tensionIds: ["closure_vs_openness"],
  },
  {
    id: "cao-cao-old-steed",
    advisorId: "cao-cao",
    quote: "老骥伏枥，志在千里。",
    author: "曹操",
    source: "《龟虽寿》",
    themeIds: ["ambition", "resilience"],
    tensionIds: ["age_vs_aspiration"],
  },
  {
    id: "ren-zhengfei-survive",
    advisorId: "ren-zhengfei",
    quote: "我们只想自己多努力，努力寻找能生存下来的机会。",
    author: "任正非",
    source:
      "智能矿山创新实验室揭牌后媒体采访（新华社，2021）· https://www.xinhuanet.com/politics/2021-02/09/c_1127085265.htm",
    themeIds: ["resilience", "survival"],
    tensionIds: ["constraint_vs_agency"],
  },
  {
    id: "ren-zhengfei-do-the-work",
    advisorId: "ren-zhengfei",
    quote: "踏踏实实把能做的产品与服务做好。",
    author: "任正非",
    source:
      "智能矿山创新实验室揭牌后媒体采访（新华社，2021）· https://www.xinhuanet.com/politics/2021-02/09/c_1127085265.htm",
    themeIds: ["craft", "execution", "focus"],
    tensionIds: ["certainty_vs_uncertainty"],
  },
  {
    id: "ren-zhengfei-globalization",
    advisorId: "ren-zhengfei",
    quote: "不管怎样制裁和封锁，我们坚持全球化不动摇。",
    author: "任正非",
    source:
      "智能矿山创新实验室揭牌后媒体采访（新华社，2021）· https://www.xinhuanet.com/politics/2021-02/09/c_1127085265.htm",
    themeIds: ["resilience", "trust"],
    tensionIds: ["closure_vs_openness"],
  },
  {
    id: "zhang-juzheng-enforce-law",
    advisorId: "zhang-juzheng",
    quote: "天下之事，不难于立法，而难于法之必行。",
    author: "张居正",
    source: "《请稽查章奏随事考成以修实政疏》",
    themeIds: ["execution", "governance"],
    tensionIds: ["design_vs_delivery"],
  },
  {
    id: "zhang-juzheng-effect",
    advisorId: "zhang-juzheng",
    quote: "不难于听言，而难于言之必效。",
    author: "张居正",
    source: "《请稽查章奏随事考成以修实政疏》",
    themeIds: ["accountability", "execution"],
    tensionIds: ["advice_vs_effect"],
  },
  {
    id: "zhang-juzheng-plan-act",
    advisorId: "zhang-juzheng",
    quote: "天下之事，虑之贵详，行之贵力。",
    author: "张居正",
    source: "《陈六事疏》",
    themeIds: ["deliberation", "execution"],
    tensionIds: ["planning_vs_action"],
  },
] as const satisfies readonly QuoteCatalogEntry[];

export const quoteMap: ReadonlyMap<string, QuoteCatalogEntry> = new Map(
  quoteCatalog.map((entry) => [entry.id, entry]),
);
