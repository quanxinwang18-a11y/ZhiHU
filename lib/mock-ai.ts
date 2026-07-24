const openings: Record<string, string> = {
  "zhang-yiming": "我先把情绪和事实分开。",
  "steve-jobs": "你真正要决定的，不是怎样让所有人满意。",
  naval: "这件事里最昂贵的，可能不是冲突，而是你持续出租自己的判断力。",
  "zhang-xuefeng": "咱别先谈漂亮话，先看你手里到底有什么牌。",
  "charlie-munger": "反过来想：怎样做最容易让局面变得更糟？",
  "nassim-taleb": "不要把职业命运押在一段听起来很确定的叙事上。",
  alibaba: "这不是一句“沟通不到位”就能带过的事。",
  bytedance: "先补足 Context：目标、事实、分歧点和决策人分别是什么？",
};

const middles: Record<string, string> = {
  "zhang-yiming": "你描述的是一次关系压力，但决策对象其实是长期成长率。列出可验证事实：对方明确说过什么、资源是否改变、三个月后能力是否复利。若信息不足，先用一次低成本沟通校准，而不是在脑中完成整个故事。",
  "steve-jobs": "如果这份工作要求你长期降低标准来换取表面和平，那不是协作，是消耗。把你认为不可妥协的一件事讲清楚，其他噪音全部删掉。真正好的合作会让作品更清晰，而不是让每个人都舒服。",
  naval: "先问自己：这段关系是长期博弈，还是一次性权力游戏？长期博弈值得建设信誉，一次性游戏则要限制下行。把注意力投向能够积累专长、信誉与选择权的动作，而不是赢下今天的口舌。",
  "zhang-xuefeng": "谁决定你的绩效，谁掌握资源，谁只是在表达态度，这三类人要分开。你可以有价值观，但不能没有路径。先留证据、问清标准，再决定是争取、换组还是离开；别拿情绪去撞组织流程。",
  "charlie-munger": "常见错误是同时误判激励和高估表达效果。对方的行为若由考核决定，你再真诚也改变不了激励。减少永久性损失：别在气头上发长消息，别让单一关系控制全部机会，先构造几个可选方案。",
  "nassim-taleb": "区分可逆动作与不可逆动作。一次澄清、小范围试验、悄悄了解外部机会都可逆；裸辞、公开决裂则暴露巨大下行。先用小赌注获取真实反馈，让自己从波动中获得信息，而非被波动摧毁。",
  alibaba: "先对齐共同目标，再把分歧落到结果和责任。向上沟通不要只报困难，要带事实、判断和两个方案；同事冲突不要争态度，要明确接口与截止时间。能复盘成方法的委屈，才没有白受。",
  bytedance: "高质量沟通不是更委婉，而是更高信息密度。把“我觉得”改成观察，把抱怨改成影响，把诉求改成可执行选择。直接同步关键相关方，记录结论；如果 Context 透明后仍无改善，再快速调整。",
};

export function makeMockOpinion(advisorId: string, question: string, followup?: string) {
  const opening = openings[advisorId] || "我换一个角度看。";
  const middle = middles[advisorId] || "先把事实、代价和选择权分开。";
  const questionEcho = question.length > 46 ? `${question.slice(0, 46)}……` : question;
  if (followup) {
    return `${opening} 你追问“${followup.slice(0, 54)}${followup.length > 54 ? "……" : ""}”，说明你卡住的不是是否知道道理，而是承担哪一种代价。${middle} 现在不要追求一个让你完全安心的答案：写下你最怕失去的东西，再写下最小可验证动作。用一次真实反馈替代十次想象。我的判断可能与你所在组织的实际权力结构不完全一致，所以把它当作一面镜子，而不是命令。`;
  }
  return `${opening} 你问的是“${questionEcho}”。${middle} 我会建议你先做一个不伤害选择权的小动作，在四十八小时内拿到新事实，再决定是否升级行动。别急着证明谁对；先确认什么结果值得你承担代价。`;
}

export function streamText(text: string, onDone: () => void) {
  const encoder = new TextEncoder();
  let cursor = 0;
  return new ReadableStream({
    async pull(controller) {
      if (cursor >= text.length) {
        onDone();
        controller.close();
        return;
      }
      const size = Math.floor(Math.random() * 5) + 2;
      controller.enqueue(encoder.encode(text.slice(cursor, cursor + size)));
      cursor += size;
      await new Promise((resolve) => setTimeout(resolve, 12));
    },
  });
}
