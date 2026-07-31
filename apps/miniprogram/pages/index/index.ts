import { usesRemoteApi } from "../../config/runtime";
import type {
  AdviceRunEvent,
  CardViewModel,
  StoredAdviceRun,
} from "../../domain/advice";
import {
  startAdviceRun,
  type AdviceRunController,
} from "../../services/advice-runner";
import { saveAdviceRun } from "../../services/history-store";

type InputEvent = {
  detail: {
    value: string;
  };
};

type CardTapEvent = {
  currentTarget: {
    dataset: {
      index?: number | string;
    };
  };
};

type SynthesisTapEvent = {
  currentTarget: {
    dataset: {
      mode?: "decision" | "communication";
    };
  };
};

type TouchEvent = {
  changedTouches?: Array<{
    clientX: number;
    clientY: number;
  }>;
  touches?: Array<{
    clientX: number;
    clientY: number;
  }>;
};

type ImmersiveCardViewModel = CardViewModel & {
  ordinal: string;
  isRevealed: boolean;
  monogram: string;
};

let activeController: AdviceRunController | null = null;
let ingestionTimer: ReturnType<typeof setTimeout> | null = null;
let readingTouchStart: { x: number; y: number } | null = null;

function vibrate(type: "light" | "medium" | "heavy" = "light") {
  try {
    wx.vibrateShort({ type });
  } catch {
    // Haptics are enhancement only and may be unavailable in the simulator.
  }
}

function cardMetrics(cards: ImmersiveCardViewModel[]) {
  const readyCards = cards.filter((card) => card.status === "ready");
  const revealedCards = readyCards.filter((card) => card.isRevealed);
  return {
    completedCardCount: readyCards.length,
    revealedCount: revealedCards.length,
    allCardsRevealed:
      readyCards.length > 0 &&
      revealedCards.length === readyCards.length &&
      cards.every(
        (card) => card.status === "ready" || card.status === "failed",
      ),
  };
}

function toStoredCard(card: ImmersiveCardViewModel): CardViewModel {
  return {
    id: card.id,
    slot: card.slot,
    persona: card.persona,
    slotLabel: card.slotLabel,
    selectionReason: card.selectionReason,
    status: card.status,
    body: card.body,
    error: card.error,
  };
}

Page({
  data: {
    statusBarHeight: 20,
    question: "",
    charCount: 0,
    canSubmit: false,
    isRunning: false,
    phase: "idle",
    runId: "",
    plan: null as StoredAdviceRun["plan"] | null,
    cards: [] as ImmersiveCardViewModel[],
    completedCardCount: 0,
    revealedCount: 0,
    allCardsRevealed: false,
    featuredCard: null as ImmersiveCardViewModel | null,
    focusedCard: null as ImmersiveCardViewModel | null,
    focusedCardPosition: "",
    canReadPrevious: false,
    canReadNext: false,
    error: "",
    synthesisTitle: "",
    synthesisBody: "",
    transportLabel: usesRemoteApi ? "API 联调" : "本地演示",
    sampleQuestions: [
      "我拿到外地 offer，但担心换城市后失去现在的积累，该怎么判断？",
      "领导不断增加需求，我应该怎么沟通边界又不显得在推卸责任？",
    ],
  },

  onLoad() {
    try {
      this.setData({ statusBarHeight: wx.getWindowInfo().statusBarHeight });
    } catch {
      this.setData({ statusBarHeight: 20 });
    }
    wx.pageScrollTo({ scrollTop: 0, duration: 0 });
  },

  onUnload() {
    activeController?.cancel();
    activeController = null;
    if (ingestionTimer) clearTimeout(ingestionTimer);
    ingestionTimer = null;
    readingTouchStart = null;
  },

  onQuestionInput(event: InputEvent) {
    const question = event.detail.value.slice(0, 1000);
    const length = question.trim().length;
    this.setData({
      question,
      charCount: question.length,
      canSubmit: length >= 10 && length <= 1000,
      error: "",
    });
  },

  onUseSample(event: {
    currentTarget: { dataset: { question?: string } };
  }) {
    const question = event.currentTarget.dataset.question ?? "";
    this.setData({
      question,
      charCount: question.length,
      canSubmit: question.trim().length >= 10,
      error: "",
    });
    vibrate();
  },

  onSubmit() {
    const question = this.data.question.trim();
    if (question.length < 10 || question.length > 1000) {
      this.setData({ error: "请用 10–1000 字描述你的处境" });
      return;
    }

    activeController?.cancel();
    if (ingestionTimer) clearTimeout(ingestionTimer);
    vibrate("medium");
    this.setData({
      isRunning: true,
      phase: "ingesting",
      runId: "",
      plan: null,
      cards: [],
      completedCardCount: 0,
      revealedCount: 0,
      allCardsRevealed: false,
      featuredCard: null,
      focusedCard: null,
      error: "",
      synthesisTitle: "",
      synthesisBody: "",
    });
    wx.pageScrollTo({ scrollTop: 0, duration: 180 });

    ingestionTimer = setTimeout(() => {
      ingestionTimer = null;
      this.beginAdviceRun(question);
    }, 720);
  },

  beginAdviceRun(question: string) {
    this.setData({ phase: "planning" });
    activeController = startAdviceRun(question, {
      onEvent: (event) => this.handleRunEvent(event),
      onTransportError: (message) => {
        activeController = null;
        vibrate("heavy");
        this.setData({
          isRunning: false,
          phase: "error",
          error: message,
        });
      },
    });
  },

  handleRunEvent(event: AdviceRunEvent) {
    if (event.type === "plan") {
      const cards: ImmersiveCardViewModel[] = event.cards.map(
        (card, index) => {
          const planItem = event.plan.items.find(
            (item) => item.slot === card.slot,
          );
          return {
            ...card,
            ordinal: String(index + 1).padStart(2, "0"),
            isRevealed: false,
            monogram: card.persona.displayName.slice(0, 1),
            slotLabel: planItem?.slotLabel ?? "",
            selectionReason: planItem?.reason ?? "",
            status: "waiting",
            body: "",
            error: "",
          };
        },
      );
      this.setData({
        runId: event.runId,
        plan: event.plan,
        cards,
        phase: "revealing",
        ...cardMetrics(cards),
      });
      return;
    }

    if (event.type === "card.delta") {
      const cards = this.data.cards.map((card) =>
        card.id === event.cardId
          ? {
              ...card,
              status: "streaming" as const,
              body: card.body + event.delta,
            }
          : card,
      );
      this.setData({ cards, ...cardMetrics(cards) });
      return;
    }

    if (event.type === "card.done") {
      const cards = this.data.cards.map((card) =>
        card.id === event.cardId
          ? { ...card, status: "ready" as const }
          : card,
      );
      vibrate();
      this.setData({ cards, ...cardMetrics(cards) });
      return;
    }

    if (event.type === "card.failed") {
      const cards = this.data.cards.map((card) =>
        card.id === event.cardId
          ? {
              ...card,
              status: "failed" as const,
              error: event.error,
            }
          : card,
      );
      this.setData({ cards, ...cardMetrics(cards) });
      return;
    }

    if (event.type === "run.done") {
      activeController = null;
      this.setData(
        {
          isRunning: false,
          phase: "ready",
          ...cardMetrics(this.data.cards),
        },
        () => this.persistCurrentRun(),
      );
    }
  },

  onStop() {
    if (ingestionTimer) clearTimeout(ingestionTimer);
    ingestionTimer = null;
    activeController?.cancel();
    activeController = null;
    const cards = this.data.cards.map((card) =>
      card.status === "waiting" || card.status === "streaming"
        ? {
            ...card,
            status: "failed" as const,
            error: "本轮显影已停止",
          }
        : card,
    );
    this.setData({
      isRunning: false,
      phase: "stopped",
      cards,
      ...cardMetrics(cards),
    });
  },

  onCardTap(event: CardTapEvent) {
    const index = Number(event.currentTarget.dataset.index);
    const card = this.data.cards[index];
    if (!card) return;

    if (card.status !== "ready") {
      wx.showToast({
        title: card.status === "failed" ? "这枚封印未能形成" : "这枚封印仍在凝结",
        icon: "none",
      });
      return;
    }

    if (!card.isRevealed) {
      const cards = this.data.cards.map((item, cardIndex) =>
        cardIndex === index ? { ...item, isRevealed: true } : item,
      );
      const revealedCard = cards[index];
      vibrate("medium");
      this.setData({
        cards,
        featuredCard: revealedCard,
        ...cardMetrics(cards),
      });
      return;
    }

    this.openReading(index);
  },

  onDismissFeatured() {
    this.setData({ featuredCard: null });
  },

  onEnterFeatured() {
    const featuredCard = this.data.featuredCard;
    if (!featuredCard) return;
    const index = this.data.cards.findIndex(
      (card) => card.id === featuredCard.id,
    );
    if (index < 0) return;
    this.setData({ featuredCard: null }, () => this.openReading(index));
  },

  openReading(index: number) {
    const card = this.data.cards[index];
    if (!card || card.status !== "ready" || !card.isRevealed) return;
    const readable = this.data.cards.filter(
      (item) => item.status === "ready" && item.isRevealed,
    );
    const position = readable.findIndex((item) => item.id === card.id);
    vibrate();
    this.setData({
      focusedCard: card,
      focusedCardPosition: `${position + 1} / ${readable.length}`,
      canReadPrevious: position > 0,
      canReadNext: position >= 0 && position < readable.length - 1,
    });
  },

  onCloseReading() {
    readingTouchStart = null;
    this.setData({ focusedCard: null });
  },

  onReadingTouchStart(event: TouchEvent) {
    const touch = event.touches?.[0];
    readingTouchStart = touch
      ? { x: touch.clientX, y: touch.clientY }
      : null;
  },

  onReadingTouchEnd(event: TouchEvent) {
    const touch = event.changedTouches?.[0];
    const start = readingTouchStart;
    readingTouchStart = null;
    if (!touch || !start) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 54 || Math.abs(deltaX) < Math.abs(deltaY)) return;
    this.moveReading(deltaX < 0 ? 1 : -1);
  },

  onReadPrevious() {
    this.moveReading(-1);
  },

  onReadNext() {
    this.moveReading(1);
  },

  moveReading(direction: -1 | 1) {
    const current = this.data.focusedCard;
    if (!current) return;
    const readable = this.data.cards.filter(
      (card) => card.status === "ready" && card.isRevealed,
    );
    const position = readable.findIndex((card) => card.id === current.id);
    const next = readable[position + direction];
    if (!next) return;
    const nextIndex = this.data.cards.findIndex((card) => card.id === next.id);
    this.openReading(nextIndex);
  },

  onSynthesize(event: SynthesisTapEvent) {
    const mode = event.currentTarget.dataset.mode;
    if (!mode) return;
    const hasReadyCard = this.data.cards.some((card) => card.status === "ready");
    if (!hasReadyCard) {
      wx.showToast({ title: "至少等待一张卡完成", icon: "none" });
      return;
    }
    vibrate();
    if (mode === "decision") {
      this.setData(
        {
          synthesisTitle: "先形成一个可逆判断",
          synthesisBody:
            "把已经确认的事实和担忧分开，先守住不可承受的风险，再选择一个七天内能获得外部反馈的小行动。到复盘点时只根据新增事实调整，不要求今天一次决定永久答案。",
        },
        () => this.persistCurrentRun(),
      );
      return;
    }
    this.setData(
      {
        synthesisTitle: "可以这样开口",
        synthesisBody:
          "我想先和你对齐这件事要达成的结果。我目前观察到的事实是……它已经造成……我可以承担……同时需要你确认或提供……我们是否可以先按这个方案推进，并在约定时间看一次结果？",
      },
      () => this.persistCurrentRun(),
    );
  },

  persistCurrentRun() {
    if (!this.data.runId || !this.data.plan) return;
    saveAdviceRun({
      schemaVersion: 1,
      id: this.data.runId,
      question: this.data.question.trim(),
      plan: this.data.plan,
      cards: this.data.cards.map(toStoredCard),
      synthesisTitle: this.data.synthesisTitle,
      synthesisBody: this.data.synthesisBody,
      createdAt: Date.now(),
    });
  },

  onReset() {
    if (ingestionTimer) clearTimeout(ingestionTimer);
    ingestionTimer = null;
    activeController?.cancel();
    activeController = null;
    readingTouchStart = null;
    this.setData({
      question: "",
      charCount: 0,
      canSubmit: false,
      isRunning: false,
      phase: "idle",
      runId: "",
      plan: null,
      cards: [],
      completedCardCount: 0,
      revealedCount: 0,
      allCardsRevealed: false,
      featuredCard: null,
      focusedCard: null,
      focusedCardPosition: "",
      canReadPrevious: false,
      canReadNext: false,
      error: "",
      synthesisTitle: "",
      synthesisBody: "",
    });
    wx.pageScrollTo({ scrollTop: 0, duration: 220 });
  },

  onOpenHistory() {
    wx.navigateTo({ url: "/pages/history/history" });
  },
});
