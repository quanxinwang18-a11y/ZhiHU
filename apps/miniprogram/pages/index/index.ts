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

type SpectrumId = "obsidian" | "lunar" | "ziwei" | "calamity" | "jade";
type CardTone = "lunar" | "ziwei" | "jade";
type OracleSkyPhase =
  | "idle"
  | "ingesting"
  | "planning"
  | "revealing"
  | "ready"
  | "stopped"
  | "error";

type SkyPalette = {
  void: string;
  atmosphere: [number, number, number];
  primary: [number, number, number];
  secondary: [number, number, number];
};

type ImmersiveCardViewModel = CardViewModel & {
  ordinal: string;
  isRevealed: boolean;
  monogram: string;
  imageSrc: string;
  tone: CardTone;
  sealGlyph: string;
  constellation: string;
};

type OracleReading = {
  invocation: string;
  verdict: string;
  exegesis: string[];
};

let activeController: AdviceRunController | null = null;
let ingestionTimer: ReturnType<typeof setTimeout> | null = null;
let questionHoldTimer: ReturnType<typeof setTimeout> | null = null;
let questionChargeTimer: ReturnType<typeof setTimeout> | null = null;
let oracleEntryTimer: ReturnType<typeof setTimeout> | null = null;
let readingMotionTimer: ReturnType<typeof setTimeout> | null = null;
let readingTouchStart: { x: number; y: number } | null = null;
let oracleSkyCanvas: WechatMiniprogram.Canvas | null = null;
let oracleSkyContext:
  | WechatMiniprogram.CanvasRenderingContext.CanvasRenderingContext2D
  | null = null;
let oracleSkyFrameId: number | null = null;
let oracleSkyWidth = 0;
let oracleSkyHeight = 0;
let oracleHorizonCenterX = 0;
let oracleHorizonCenterY = 0;
let oracleSkyLastPaint = 0;
let oracleSkySpectrum: SpectrumId = "obsidian";
let oracleSkyEnergy = 0.18;
let oracleSkyPhase: OracleSkyPhase = "idle";
let oracleSkyRenderedPhase: OracleSkyPhase | null = null;
let oracleSkyPhaseStartedAt = 0;
let oracleSkyReading = false;

const spectrumIds: SpectrumId[] = [
  "obsidian",
  "lunar",
  "ziwei",
  "calamity",
  "jade",
];

const skyPalettes: Record<SpectrumId, SkyPalette> = {
  obsidian: {
    void: "#050403",
    atmosphere: [28, 22, 14],
    primary: [201, 166, 91],
    secondary: [241, 234, 220],
  },
  lunar: {
    void: "#03070b",
    atmosphere: [13, 29, 42],
    primary: [111, 159, 189],
    secondary: [226, 237, 241],
  },
  ziwei: {
    void: "#070309",
    atmosphere: [35, 17, 42],
    primary: [173, 120, 158],
    secondary: [234, 221, 232],
  },
  calamity: {
    void: "#090302",
    atmosphere: [43, 16, 9],
    primary: [198, 106, 66],
    secondary: [240, 223, 213],
  },
  jade: {
    void: "#020806",
    atmosphere: [10, 34, 28],
    primary: [96, 153, 137],
    secondary: [220, 232, 226],
  },
};

const cardVisuals: Record<
  CardViewModel["slot"],
  { tone: CardTone; sealGlyph: string; constellation: string }
> = {
  challenge_assumptions: {
    tone: "lunar",
    sealGlyph: "辨",
    constellation: "north",
  },
  path_and_risk: {
    tone: "ziwei",
    sealGlyph: "衡",
    constellation: "eclipse",
  },
  communication_and_action: {
    tone: "jade",
    sealGlyph: "行",
    constellation: "bridge",
  },
};

const personaPortraits: Record<string, string> = {
  "zhang-yiming-method": "/assets/cards/zhang-yiming.webp",
  "munger-method": "/assets/cards/charlie-munger.webp",
  "taleb-method": "/assets/cards/nassim-taleb.webp",
  "zhang-xuefeng-method": "/assets/cards/zhang-xuefeng.webp",
  "ren-zhengfei-method": "/assets/cards/ren-zhengfei.webp",
  "alibaba-method": "/assets/cards/alibaba.webp",
};

function spectrumFromSeed(seed: string): SpectrumId {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return spectrumIds[(hash >>> 0) % spectrumIds.length];
}

const oracleStars = Array.from({ length: 56 }, (_, index) => ({
  x: ((index * 47 + 13) % 101) / 101,
  y: ((index * 71 + 29) % 103) / 103,
  size: 0.42 + ((index * 19) % 13) / 11,
  phase: ((index * 31) % 17) / 17,
}));

function colorWithAlpha(
  color: [number, number, number],
  alpha: number,
) {
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
}

function setOracleSkyState(
  spectrum: SpectrumId,
  energy: number,
  phase: OracleSkyPhase,
) {
  oracleSkySpectrum = spectrum;
  oracleSkyEnergy = Math.max(0.08, Math.min(1, energy));
  if (oracleSkyPhase !== phase) {
    oracleSkyRenderedPhase = null;
  }
  oracleSkyPhase = phase;
}

function paintCloud(
  context: WechatMiniprogram.CanvasRenderingContext.CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: [number, number, number],
  opacity: number,
) {
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, colorWithAlpha(color, opacity));
  gradient.addColorStop(0.34, colorWithAlpha(color, opacity * 0.46));
  gradient.addColorStop(1, colorWithAlpha(color, 0));
  context.fillStyle = gradient;
  context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function paintEventHorizon(
  context: WechatMiniprogram.CanvasRenderingContext.CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  palette: SkyPalette,
  time: number,
  energy: number,
  phase: OracleSkyPhase,
  phaseProgress: number,
) {
  const isIngesting = phase === "ingesting";
  const isSummoning = isIngesting || phase === "planning";
  const vortexDrive = isIngesting
    ? Math.sin(Math.min(1, phaseProgress) * Math.PI)
    : phase === "planning"
      ? 0.72
      : 0;
  const activeRadius = radius * (1 + vortexDrive * 0.025);
  const orbit =
    time * (0.000035 + energy * 0.000025 + vortexDrive * 0.00018);

  if (isSummoning) {
    const rayAngles = [1.36, 1.82, -1.17, -2.44];
    const rayStrengths = [0.11, 0.07, 0.042, 0.025];
    context.save();
    context.translate(centerX, centerY);
    for (let index = 0; index < rayAngles.length; index += 1) {
      const rayLength = activeRadius * (3.4 + index * 0.52);
      const ray = context.createLinearGradient(
        activeRadius * 0.9,
        0,
        rayLength,
        0,
      );
      ray.addColorStop(0, colorWithAlpha(palette.secondary, 0));
      ray.addColorStop(
        0.18,
        colorWithAlpha(
          palette.secondary,
          rayStrengths[index] * vortexDrive,
        ),
      );
      ray.addColorStop(1, colorWithAlpha(palette.primary, 0));
      context.save();
      context.rotate(rayAngles[index] + Math.sin(orbit) * 0.018);
      context.fillStyle = ray;
      context.fillRect(activeRadius * 0.9, -0.45, rayLength, 0.9);
      context.restore();
    }
    context.restore();
  }

  // The Web shader uses a dusty, broken accretion band rather than a UI ring.
  context.save();
  context.translate(centerX, centerY);
  context.rotate(-0.44);
  context.scale(1, 0.29);
  context.lineCap = "round";

  context.beginPath();
  context.arc(0, 0, activeRadius * 1.72, orbit + 0.48, orbit + 4.62);
  context.lineWidth = 14 + vortexDrive * 3;
  context.strokeStyle = colorWithAlpha(
    palette.primary,
    0.025 + energy * 0.045 + vortexDrive * 0.025,
  );
  context.shadowBlur = 24;
  context.shadowColor = colorWithAlpha(palette.primary, 0.24);
  context.stroke();

  context.beginPath();
  context.arc(0, 0, activeRadius * 1.52, orbit - 0.18, orbit + 2.18);
  context.lineWidth = 2.8;
  context.strokeStyle = colorWithAlpha(
    palette.secondary,
    0.12 + energy * 0.2 + vortexDrive * 0.08,
  );
  context.shadowBlur = 14;
  context.shadowColor = colorWithAlpha(palette.secondary, 0.32);
  context.stroke();

  context.beginPath();
  context.arc(0, 0, activeRadius * 1.34, orbit + 2.82, orbit + 5.76);
  context.lineWidth = 1.3;
  context.strokeStyle = colorWithAlpha(
    palette.primary,
    0.22 + energy * 0.22 + vortexDrive * 0.08,
  );
  context.shadowBlur = 12;
  context.shadowColor = colorWithAlpha(palette.primary, 0.46);
  context.stroke();
  context.restore();

  // The Web core is not a solid black disc: it absorbs the atmosphere
  // progressively, so its silhouette is discovered through the photon edge.
  context.save();
  context.globalCompositeOperation = "source-over";
  const absorption = context.createRadialGradient(
    centerX,
    centerY,
    0,
    centerX,
    centerY,
    activeRadius * 1.08,
  );
  absorption.addColorStop(0, "rgba(0, 0, 0, 0.88)");
  absorption.addColorStop(0.48, "rgba(0, 0, 0, 0.84)");
  absorption.addColorStop(0.72, "rgba(0, 0, 0, 0.48)");
  absorption.addColorStop(0.9, "rgba(0, 0, 0, 0.12)");
  absorption.addColorStop(1, "rgba(0, 0, 0, 0)");
  context.beginPath();
  context.arc(centerX, centerY, activeRadius * 1.08, 0, Math.PI * 2);
  context.fillStyle = absorption;
  context.fill();

  context.globalCompositeOperation = "lighter";
  context.lineCap = "round";
  context.beginPath();
  context.arc(centerX, centerY, activeRadius, 0, Math.PI * 2);
  context.lineWidth = 3.8;
  context.strokeStyle = colorWithAlpha(
    palette.primary,
    0.025 + energy * 0.025 + vortexDrive * 0.012,
  );
  context.shadowBlur = 24;
  context.shadowColor = colorWithAlpha(palette.primary, 0.22);
  context.stroke();

  // Split the photon edge into spectral fragments. The side-facing crest is
  // brighter and whiter, matching the Web shader's directional spectral rim.
  const segmentCount = 48;
  const segmentArc = (Math.PI * 2) / segmentCount;
  for (let index = 0; index < segmentCount; index += 1) {
    const angle = index * segmentArc + orbit * 0.06;
    const crest = Math.pow(Math.max(0, Math.cos(angle + 0.78)), 6);
    const shimmer =
      0.62 + 0.38 * Math.sin(angle * 5 - orbit * 1.7 + index * 0.31);
    const alpha =
      (0.075 + energy * 0.075 + crest * (0.42 + vortexDrive * 0.08)) *
      shimmer;
    const edgeRadius =
      activeRadius *
      (0.997 + Math.sin(angle * 2 + orbit * 0.8) * 0.007);

    context.beginPath();
    context.arc(
      centerX,
      centerY,
      edgeRadius,
      angle,
      angle + segmentArc * (0.78 + crest * 0.16),
    );
    context.lineWidth = 0.55 + crest * 1.65;
    context.strokeStyle = colorWithAlpha(
      crest > 0.16 ? palette.secondary : palette.primary,
      alpha,
    );
    context.shadowBlur = 3 + crest * 14;
    context.shadowColor = colorWithAlpha(
      crest > 0.16 ? palette.secondary : palette.primary,
      0.18 + crest * 0.34,
    );
    context.stroke();
  }
  context.restore();
}

function paintOracleSky(time: number) {
  const canvas = oracleSkyCanvas;
  const context = oracleSkyContext;
  if (!canvas || !context || oracleSkyWidth <= 0 || oracleSkyHeight <= 0) {
    return;
  }

  oracleSkyFrameId = canvas.requestAnimationFrame(paintOracleSky);
  if (time - oracleSkyLastPaint < 34) return;
  oracleSkyLastPaint = time;

  const width = oracleSkyWidth;
  const height = oracleSkyHeight;
  const palette = skyPalettes[oracleSkySpectrum];
  if (oracleSkyRenderedPhase !== oracleSkyPhase) {
    oracleSkyRenderedPhase = oracleSkyPhase;
    oracleSkyPhaseStartedAt = time;
  }
  const phaseProgress =
    oracleSkyPhase === "ingesting"
      ? Math.max(0, Math.min(1, (time - oracleSkyPhaseStartedAt) / 720))
      : 0;
  const timeSlow = time * 0.00012;
  const energy = oracleSkyEnergy;
  const isIdle = oracleSkyPhase === "idle";
  const centerY =
    isIdle || oracleSkyPhase === "ingesting" || oracleSkyPhase === "planning"
      ? oracleHorizonCenterY || height * 0.56
      : height * 0.25;
  const centerX =
    isIdle && oracleHorizonCenterX ? oracleHorizonCenterX : width * 0.5;
  const horizonRadius = Math.min(width * 0.25, 92) * (0.88 + energy * 0.14);

  context.clearRect(0, 0, width, height);
  context.fillStyle = colorWithAlpha(
    oracleSkyPhase === "idle" ? palette.atmosphere : palette.primary,
    oracleSkyPhase === "idle" ? 0.2 : 0.13,
  );
  context.fillRect(0, 0, width, height);
  context.globalCompositeOperation = "lighter";

  paintCloud(
    context,
    width * (0.12 + Math.sin(timeSlow) * 0.09),
    height * 0.2,
    width * 0.72,
    palette.primary,
    0.12 + energy * 0.13,
  );
  paintCloud(
    context,
    width * (0.92 + Math.cos(timeSlow * 0.78) * 0.08),
    height * 0.42,
    width * 0.78,
    palette.atmosphere,
    0.18 + energy * 0.12,
  );
  paintCloud(
    context,
    width * (0.22 + Math.cos(timeSlow * 0.66) * 0.11),
    height * 0.7,
    width * 0.66,
    [94, 54, 130],
    0.075 + energy * 0.075,
  );
  paintCloud(
    context,
    width * (0.82 + Math.sin(timeSlow * 0.58) * 0.1),
    height * 0.8,
    width * 0.62,
    [40, 121, 107],
    0.055 + energy * 0.065,
  );

  for (let index = 0; index < oracleStars.length; index += 1) {
    const star = oracleStars[index];
    const twinkle =
      0.35 + 0.65 * Math.abs(Math.sin(time * 0.0007 + star.phase * 8));
    const starRadius = star.size * (0.52 + energy * 0.2);
    context.beginPath();
    context.arc(star.x * width, star.y * height, starRadius, 0, Math.PI * 2);
    context.fillStyle = colorWithAlpha(
      index % 4 === 0 ? palette.secondary : palette.primary,
      (0.12 + energy * 0.17) * twinkle,
    );
    context.fill();
  }

  if (!oracleSkyReading) {
    paintEventHorizon(
      context,
      centerX,
      centerY,
      horizonRadius,
      palette,
      time,
      energy,
      oracleSkyPhase,
      phaseProgress,
    );
  }

  context.globalCompositeOperation = "source-over";
  const vignette = context.createRadialGradient(
    centerX,
    height * 0.48,
    width * 0.18,
    centerX,
    height * 0.48,
    Math.max(width, height) * 0.68,
  );
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(0.58, "rgba(0, 0, 0, 0.14)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.78)");
  context.fillStyle = vignette;
  context.fillRect(0, 0, width, height);
}

function stopOracleSky() {
  if (oracleSkyCanvas && oracleSkyFrameId !== null) {
    oracleSkyCanvas.cancelAnimationFrame(oracleSkyFrameId);
  }
  oracleSkyFrameId = null;
}

function startOracleSky() {
  if (!oracleSkyCanvas || oracleSkyFrameId !== null) return;
  oracleSkyLastPaint = 0;
  oracleSkyFrameId = oracleSkyCanvas.requestAnimationFrame(paintOracleSky);
}

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

function stripMarkdown(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[.)、]\s+/gm, "")
    .replace(/[*_~`]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function splitSentences(value: string) {
  return (
    stripMarkdown(value)
      .match(/[^。！？!?；;\n]+(?:[。！？!?；;]+|$)/g)
      ?.map((sentence) => sentence.trim())
      .filter(Boolean) ?? []
  );
}

function sentenceScore(sentence: string, index: number, total: number) {
  const length = sentence.replace(/[，。！？!?；;：:\s]/g, "").length;
  let score = (index / Math.max(total - 1, 1)) * 4;

  if (length >= 10 && length <= 34) score += 6;
  else if (length <= 48) score += 3;
  else if (length > 72) score -= 4;

  if (/你|自己|真正|感受|选择|判断|边界|代价/.test(sentence)) score += 2;
  if (/不是.+而是|与其.+不如|先.+再|越.+越/.test(sentence)) score += 4;
  if (/不要|必须|值得|应该|可以|无法|无需|只/.test(sentence)) score += 1.5;
  if (/[？?]$/.test(sentence)) score -= 3;
  else if (index === total - 1) score += 5;

  return score;
}

function buildOracleReading(content: string): OracleReading {
  const sentences = splitSentences(content);
  if (sentences.length === 0) {
    return { invocation: "", verdict: "答案仍在深处。", exegesis: [] };
  }

  const verdictIndex = sentences.reduce((bestIndex, sentence, index) => {
    const score = sentenceScore(sentence, index, sentences.length);
    const bestScore = sentenceScore(
      sentences[bestIndex],
      bestIndex,
      sentences.length,
    );
    return score > bestScore ? index : bestIndex;
  }, 0);
  const canExtractInvocation =
    sentences.length >= 3 &&
    verdictIndex !== 0 &&
    sentences[0].replace(/\s/g, "").length <= 72;
  const remaining = sentences.filter(
    (_, index) =>
      index !== verdictIndex && (!canExtractInvocation || index !== 0),
  );
  const exegesis: string[] = [];

  for (const sentence of remaining) {
    const current = exegesis[exegesis.length - 1];
    if (!current || current.length + sentence.length > 76) {
      exegesis.push(sentence);
    } else {
      exegesis[exegesis.length - 1] = `${current}${sentence}`;
    }
  }

  return {
    invocation: canExtractInvocation ? sentences[0] : "",
    verdict: sentences[verdictIndex],
    exegesis,
  };
}

Page({
  data: {
    statusBarHeight: 20,
    question: "",
    charCount: 0,
    questionEnergy: 0,
    canSubmit: false,
    isRunning: false,
    phase: "idle",
    spectrumId: "obsidian" as SpectrumId,
    runId: "",
    plan: null as StoredAdviceRun["plan"] | null,
    cards: [] as ImmersiveCardViewModel[],
    completedCardCount: 0,
    revealedCount: 0,
    allCardsRevealed: false,
    isHoldingQuestion: false,
    featuredCard: null as ImmersiveCardViewModel | null,
    featuredCardEntering: false,
    enteringCardId: "",
    focusedCard: null as ImmersiveCardViewModel | null,
    focusedReading: {
      invocation: "",
      verdict: "",
      exegesis: [],
    } as OracleReading,
    focusedCardPosition: "",
    canReadPrevious: false,
    canReadNext: false,
    readingMotion: "",
    error: "",
    synthesisTitle: "",
    synthesisBody: "",
  },

  onLoad() {
    try {
      this.setData({ statusBarHeight: wx.getWindowInfo().statusBarHeight });
    } catch {
      this.setData({ statusBarHeight: 20 });
    }
    wx.pageScrollTo({ scrollTop: 0, duration: 0 });
  },

  onReady() {
    const query = wx.createSelectorQuery();
    query.select("#oracle-sky").fields(
        { node: true, size: true },
        (result: WechatMiniprogram.IAnyObject) => {
          const canvas = result.node as WechatMiniprogram.Canvas | undefined;
          const width = Number(result.width);
          const height = Number(result.height);
          if (!canvas || !width || !height) return;

          stopOracleSky();
          const context = canvas.getContext("2d");
          let pixelRatio = 1;
          try {
            pixelRatio = Math.min(wx.getWindowInfo().pixelRatio, 1.5);
          } catch {
            pixelRatio = 1;
          }
          canvas.width = Math.round(width * pixelRatio);
          canvas.height = Math.round(height * pixelRatio);
          context.scale(pixelRatio, pixelRatio);
          oracleSkyCanvas = canvas;
          oracleSkyContext = context;
          oracleSkyWidth = width;
          oracleSkyHeight = height;
          startOracleSky();
        },
      );
    query
      .select(".horizon-trigger")
      .boundingClientRect(
        (rect: WechatMiniprogram.BoundingClientRectCallbackResult) => {
          oracleHorizonCenterX = rect.left + rect.width / 2;
          oracleHorizonCenterY = rect.top + rect.height / 2;
        },
      );
    query.exec();
  },

  onShow() {
    startOracleSky();
  },

  onHide() {
    stopOracleSky();
  },

  onUnload() {
    stopOracleSky();
    oracleSkyCanvas = null;
    oracleSkyContext = null;
    oracleSkyWidth = 0;
    oracleSkyHeight = 0;
    oracleHorizonCenterX = 0;
    oracleHorizonCenterY = 0;
    activeController?.cancel();
    activeController = null;
    if (ingestionTimer) clearTimeout(ingestionTimer);
    if (questionHoldTimer) clearTimeout(questionHoldTimer);
    if (questionChargeTimer) clearTimeout(questionChargeTimer);
    if (oracleEntryTimer) clearTimeout(oracleEntryTimer);
    if (readingMotionTimer) clearTimeout(readingMotionTimer);
    ingestionTimer = null;
    questionHoldTimer = null;
    questionChargeTimer = null;
    oracleEntryTimer = null;
    readingMotionTimer = null;
    readingTouchStart = null;
    oracleSkyReading = false;
  },

  onQuestionInput(event: InputEvent) {
    const question = event.detail.value.slice(0, 1000);
    const length = question.trim().length;
    const canSubmit = length >= 10 && length <= 1000;
    const spectrumId =
      canSubmit && !this.data.canSubmit
        ? spectrumFromSeed(question)
        : !canSubmit
          ? "obsidian"
          : this.data.spectrumId;
    const questionEnergy = length === 0 ? 0 : canSubmit ? 2 : 1;
    setOracleSkyState(
      spectrumId,
      questionEnergy === 0 ? 0.18 : questionEnergy === 1 ? 0.38 : 0.7,
      "idle",
    );
    this.setData({
      question,
      charCount: question.length,
      questionEnergy,
      canSubmit,
      spectrumId,
      error: "",
    });
  },

  onQuestionHoldStart() {
    if (!this.data.canSubmit || this.data.isRunning || questionHoldTimer) return;
    vibrate();
    setOracleSkyState(this.data.spectrumId, 1, "idle");
    this.setData({ isHoldingQuestion: true, error: "" });
    questionChargeTimer = setTimeout(() => {
      questionChargeTimer = null;
      if (this.data.isHoldingQuestion) vibrate();
    }, 610);
    questionHoldTimer = setTimeout(() => {
      questionHoldTimer = null;
      this.onSubmit();
    }, 900);
  },

  onQuestionHoldEnd() {
    if (questionHoldTimer) clearTimeout(questionHoldTimer);
    if (questionChargeTimer) clearTimeout(questionChargeTimer);
    questionHoldTimer = null;
    questionChargeTimer = null;
    if (this.data.isHoldingQuestion) {
      setOracleSkyState(this.data.spectrumId, 0.7, "idle");
      this.setData({ isHoldingQuestion: false });
    }
  },

  onSubmit() {
    const question = this.data.question.trim();
    if (question.length < 10 || question.length > 1000) {
      this.setData({ error: "请用 10–1000 字描述你的处境" });
      return;
    }

    activeController?.cancel();
    if (ingestionTimer) clearTimeout(ingestionTimer);
    if (questionHoldTimer) clearTimeout(questionHoldTimer);
    if (questionChargeTimer) clearTimeout(questionChargeTimer);
    questionHoldTimer = null;
    questionChargeTimer = null;
    vibrate("medium");
    const spectrumId = spectrumFromSeed(question);
    setOracleSkyState(spectrumId, 1, "ingesting");
    this.setData({
      isRunning: true,
      phase: "ingesting",
      spectrumId,
      isHoldingQuestion: false,
      runId: "",
      plan: null,
      cards: [],
      completedCardCount: 0,
      revealedCount: 0,
      allCardsRevealed: false,
      featuredCard: null,
      featuredCardEntering: false,
      enteringCardId: "",
      focusedCard: null,
      readingMotion: "",
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
    setOracleSkyState(this.data.spectrumId, 0.84, "planning");
    this.setData({ phase: "planning" });
    activeController = startAdviceRun(question, {
      onEvent: (event) => this.handleRunEvent(event),
      onTransportError: (message) => {
        activeController = null;
        vibrate("heavy");
        setOracleSkyState(this.data.spectrumId, 0.2, "error");
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
          const visual = cardVisuals[card.slot];
          return {
            ...card,
            ordinal: String(index + 1).padStart(2, "0"),
            isRevealed: false,
            monogram: card.persona.displayName.slice(0, 1),
            imageSrc: personaPortraits[card.persona.id] ?? "",
            tone: visual.tone,
            sealGlyph: visual.sealGlyph,
            constellation: visual.constellation,
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
      setOracleSkyState(this.data.spectrumId, 0.62, "revealing");
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
      setOracleSkyState(this.data.spectrumId, 0.46, "ready");
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
    if (questionHoldTimer) clearTimeout(questionHoldTimer);
    if (questionChargeTimer) clearTimeout(questionChargeTimer);
    ingestionTimer = null;
    questionHoldTimer = null;
    questionChargeTimer = null;
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
      isHoldingQuestion: false,
      phase: "stopped",
      cards,
      ...cardMetrics(cards),
    });
    setOracleSkyState(this.data.spectrumId, 0.26, "stopped");
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

    if (oracleEntryTimer) return;
    vibrate();
    this.setData({ enteringCardId: card.id });
    oracleEntryTimer = setTimeout(() => {
      oracleEntryTimer = null;
      this.setData({ enteringCardId: "" }, () => this.openReading(index));
    }, 420);
  },

  onDismissFeatured() {
    if (this.data.featuredCardEntering) return;
    this.setData({ featuredCard: null, featuredCardEntering: false });
  },

  onEnterFeatured() {
    const featuredCard = this.data.featuredCard;
    if (!featuredCard) return;
    const index = this.data.cards.findIndex(
      (card) => card.id === featuredCard.id,
    );
    if (index < 0 || oracleEntryTimer) return;
    vibrate("medium");
    this.setData({ featuredCardEntering: true });
    oracleEntryTimer = setTimeout(() => {
      oracleEntryTimer = null;
      this.setData(
        { featuredCard: null, featuredCardEntering: false },
        () => this.openReading(index),
      );
    }, 560);
  },

  openReading(index: number, readingMotion = "") {
    const card = this.data.cards[index];
    if (!card || card.status !== "ready" || !card.isRevealed) return;
    const readable = this.data.cards.filter(
      (item) => item.status === "ready" && item.isRevealed,
    );
    const position = readable.findIndex((item) => item.id === card.id);
    oracleSkyReading = true;
    vibrate();
    this.setData({
      focusedCard: card,
      focusedReading: buildOracleReading(card.body),
      focusedCardPosition: `${position + 1} / ${readable.length}`,
      canReadPrevious: position > 0,
      canReadNext: position >= 0 && position < readable.length - 1,
      readingMotion,
    });
    if (readingMotion) {
      if (readingMotionTimer) clearTimeout(readingMotionTimer);
      readingMotionTimer = setTimeout(() => {
        readingMotionTimer = null;
        this.setData({ readingMotion: "" });
      }, 320);
    }
  },

  onCloseReading() {
    if (readingMotionTimer) clearTimeout(readingMotionTimer);
    readingMotionTimer = null;
    readingTouchStart = null;
    oracleSkyReading = false;
    this.setData({ focusedCard: null, readingMotion: "" });
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
    this.openReading(
      nextIndex,
      direction === 1 ? "reading-next" : "reading-previous",
    );
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
    if (questionHoldTimer) clearTimeout(questionHoldTimer);
    if (questionChargeTimer) clearTimeout(questionChargeTimer);
    if (oracleEntryTimer) clearTimeout(oracleEntryTimer);
    if (readingMotionTimer) clearTimeout(readingMotionTimer);
    ingestionTimer = null;
    questionHoldTimer = null;
    questionChargeTimer = null;
    oracleEntryTimer = null;
    readingMotionTimer = null;
    activeController?.cancel();
    activeController = null;
    readingTouchStart = null;
    oracleSkyReading = false;
    this.setData({
      question: "",
      charCount: 0,
      questionEnergy: 0,
      canSubmit: false,
      isRunning: false,
      phase: "idle",
      spectrumId: "obsidian",
      runId: "",
      plan: null,
      cards: [],
      completedCardCount: 0,
      revealedCount: 0,
      allCardsRevealed: false,
      isHoldingQuestion: false,
      featuredCard: null,
      featuredCardEntering: false,
      enteringCardId: "",
      focusedCard: null,
      focusedReading: {
        invocation: "",
        verdict: "",
        exegesis: [],
      },
      focusedCardPosition: "",
      canReadPrevious: false,
      canReadNext: false,
      readingMotion: "",
      error: "",
      synthesisTitle: "",
      synthesisBody: "",
    });
    setOracleSkyState("obsidian", 0.18, "idle");
    wx.pageScrollTo({ scrollTop: 0, duration: 220 });
  },

  onOpenHistory() {
    wx.navigateTo({ url: "/pages/history/history" });
  },
});
