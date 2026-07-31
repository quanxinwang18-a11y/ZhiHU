import type {
  AdviceRunEvent,
  CardViewModel,
  StoredAdviceRun,
} from "../../domain/advice";
import {
  retryAdviceCard,
  startAdviceRun,
  type AdviceRunController,
} from "../../services/advice-runner";
import {
  synthesizeAdvice,
  type AdviceSynthesisMode,
} from "../../services/advice-synthesis";
import {
  loadAdviceRuns,
  saveAdviceRun,
} from "../../services/history-store";
import {
  cardSpectrumStyle,
  colorWithAlpha,
  interpolatePalette,
  mixColor,
  randomSpectrum,
  skyPalettes,
  spectrumStyleFromPalette,
  type SkyPalette,
  type SpectrumId,
} from "../../domain/visual-spectrum";

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

type CardRailScrollEvent = {
  detail: {
    scrollLeft: number;
  };
};

type OracleSkyPhase =
  | "idle"
  | "ingesting"
  | "planning"
  | "revealing"
  | "ready"
  | "stopped"
  | "error";

type ImmersiveCardViewModel = CardViewModel & {
  ordinal: string;
  isRevealed: boolean;
  monogram: string;
  imageSrc: string;
  cardStyle: string;
  sealGlyph: string;
  constellation: string;
  summoningLine: string;
};

type OracleReading = {
  invocation: string;
  verdict: string;
  exegesis: Array<{
    text: string;
    revealDelayMs: number;
  }>;
};

let activeController: AdviceRunController | null = null;
let ingestionTimer: ReturnType<typeof setTimeout> | null = null;
let questionHoldTimer: ReturnType<typeof setTimeout> | null = null;
let questionChargeTimer: ReturnType<typeof setTimeout> | null = null;
let holdInterruptedTimer: ReturnType<typeof setTimeout> | null = null;
let cardSignalTimer: ReturnType<typeof setTimeout> | null = null;
let sceneNoticeTimer: ReturnType<typeof setTimeout> | null = null;
let synthesisRequestId = 0;
let cardStageRevealTimer: ReturnType<typeof setTimeout> | null = null;
let cardStageSettleTimer: ReturnType<typeof setTimeout> | null = null;
let cardStageMinimumElapsed = false;
let oracleEntryTimer: ReturnType<typeof setTimeout> | null = null;
let readingMotionTimer: ReturnType<typeof setTimeout> | null = null;
let spectrumStyleTimer: ReturnType<typeof setTimeout> | null = null;
let readingTouchStart: { x: number; y: number } | null = null;
let featuredMeasurePending = false;
let oracleSkyCanvas: WechatMiniprogram.Canvas | null = null;
let oracleSkyContext:
  | WechatMiniprogram.CanvasRenderingContext.CanvasRenderingContext2D
  | null = null;
let oracleBloomCanvas: WechatMiniprogram.OffscreenCanvas | null = null;
let oracleBloomContext:
  | WechatMiniprogram.CanvasRenderingContext.CanvasRenderingContext2D
  | null = null;
let oracleSkyFrameId: number | null = null;
let oracleSkyWidth = 0;
let oracleSkyHeight = 0;
let oracleHorizonCenterX = 0;
let oracleHorizonCenterY = 0;
let oracleSkyLastPaint = 0;
let oracleSkySpectrum: SpectrumId = "obsidian";
let oracleSkyPaletteFrom: SkyPalette;
let oracleSkyPaletteTo: SkyPalette;
let oracleSkyPaletteStartedAt = 0;
let oracleSkyEnergy = 0.18;
let oracleSkyPhase: OracleSkyPhase = "idle";
let oracleSkyRenderedPhase: OracleSkyPhase | null = null;
let oracleSkyPhaseStartedAt = 0;
let oracleSkyReading = false;
let oracleSkyGenerationProgress = 0;
let oracleSkyGenerationTarget = 0;
let oracleCameraDrift = 0;
let oracleCameraDriftTarget = 0;
let oracleRailDrift = 0;

const HOLD_HINT_STORAGE_KEY = "zhihu:hold-hint-seen";
const QUESTION_HOLD_DURATION_MS = 860;
const QUESTION_HOLD_MIDPOINT_MS = 380;
const FEATURED_CARD_WIDTH_RPX = 650;
const FEATURED_CARD_HEIGHT_RPX = 975;
const SPECTRUM_TRANSITION_DURATION_MS = 1600;
const SPECTRUM_STYLE_FRAME_MS = 50;

oracleSkyPaletteFrom = skyPalettes.obsidian;
oracleSkyPaletteTo = skyPalettes.obsidian;

const cardVisuals: Record<
  CardViewModel["slot"],
  { sealGlyph: string; constellation: string }
> = {
  challenge_assumptions: {
    sealGlyph: "辨",
    constellation: "north",
  },
  path_and_risk: {
    sealGlyph: "衡",
    constellation: "eclipse",
  },
  communication_and_action: {
    sealGlyph: "行",
    constellation: "bridge",
  },
};

const personaPortraits: Record<string, string> = {
  "zhang-yiming-method": "/assets/cards/zhang-yiming.webp",
  "munger-method": "/assets/cards/charlie-munger.webp",
  "steve-jobs-method": "/assets/cards/steve-jobs.webp",
  "bytedance-method": "/assets/cards/bytedance.webp",
  "taleb-method": "/assets/cards/nassim-taleb.webp",
  "zhang-xuefeng-method": "/assets/cards/zhang-xuefeng.webp",
  "naval-method": "/assets/cards/naval.webp",
  "iflytek-method": "/assets/cards/iflytek.webp",
  "ren-zhengfei-method": "/assets/cards/ren-zhengfei.webp",
  "alibaba-method": "/assets/cards/alibaba.webp",
  "cao-cao-method": "/assets/cards/cao-cao.webp",
  "zhang-juzheng-method": "/assets/cards/zhang-juzheng.webp",
};

function deterministicUnit(seed: number) {
  const value = Math.sin(seed * 91.731 + 17.173) * 43758.5453;
  return value - Math.floor(value);
}

const oracleStarClusters = [
  { x: 0.16, y: 0.22, radiusX: 0.27, radiusY: 0.18 },
  { x: 0.76, y: 0.4, radiusX: 0.2, radiusY: 0.28 },
  { x: 0.32, y: 0.78, radiusX: 0.25, radiusY: 0.16 },
];

// Most stars gather into three loose clouds while a smaller field remains
// sparse. The stable distribution creates dark lanes without per-frame noise.
const oracleStars = Array.from({ length: 88 }, (_, index) => {
  const angle = deterministicUnit(index + 3) * Math.PI * 2;
  const reach = Math.pow(deterministicUnit(index + 47), 1.65);
  const isFieldStar = index % 4 === 0;
  const cluster = oracleStarClusters[index % oracleStarClusters.length];
  const x = isFieldStar
    ? deterministicUnit(index + 89)
    : cluster.x + Math.cos(angle) * cluster.radiusX * reach;
  const y = isFieldStar
    ? deterministicUnit(index + 131)
    : cluster.y + Math.sin(angle) * cluster.radiusY * reach;
  return {
    x: Math.max(0.02, Math.min(0.98, x)),
    y: Math.max(0.03, Math.min(0.97, y)),
    size: 0.38 + deterministicUnit(index + 173) * 1.18,
    phase: deterministicUnit(index + 211),
  };
});

const accretionFilaments = Array.from({ length: 21 }, (_, index) => ({
  radius: 1.24 + deterministicUnit(index + 281) * 0.54,
  start: deterministicUnit(index + 307) * Math.PI * 2,
  sweep: 0.14 + deterministicUnit(index + 331) * 0.62,
  width: 0.55 + deterministicUnit(index + 367) * 3.5,
  phase: deterministicUnit(index + 401) * Math.PI * 2,
  speed: 0.48 + deterministicUnit(index + 433) * 1.14,
  nearSide: deterministicUnit(index + 457) > 0.46,
}));

function currentSkyPalette(now = Date.now()) {
  if (oracleSkyPaletteStartedAt === 0) return oracleSkyPaletteTo;
  const progress = Math.max(
    0,
    Math.min(
      1,
      (now - oracleSkyPaletteStartedAt) / SPECTRUM_TRANSITION_DURATION_MS,
    ),
  );
  return interpolatePalette(oracleSkyPaletteFrom, oracleSkyPaletteTo, progress);
}

function setOracleSkyState(
  spectrum: SpectrumId,
  energy: number,
  phase: OracleSkyPhase,
) {
  if (oracleSkySpectrum !== spectrum) {
    const now = Date.now();
    oracleSkyPaletteFrom = currentSkyPalette(now);
    oracleSkyPaletteTo = skyPalettes[spectrum];
    oracleSkyPaletteStartedAt = now;
    oracleSkySpectrum = spectrum;
  }
  oracleSkyEnergy = Math.max(0.08, Math.min(1, energy));
  if (oracleSkyPhase !== phase) {
    oracleSkyRenderedPhase = null;
  }
  oracleSkyPhase = phase;
}

function updateOracleGenerationTarget(cards: ImmersiveCardViewModel[]) {
  if (cards.length === 0) return;
  const formationUnits = cards.reduce((total, card) => {
    if (
      card.status === "ready" ||
      card.status === "failed" ||
      card.status === "cancelled"
    ) {
      return total + 1;
    }
    if (card.status === "streaming") return total + 0.28;
    return total;
  }, 0);
  oracleSkyGenerationTarget = Math.max(
    oracleSkyGenerationTarget,
    formationUnits / cards.length,
  );
  if (oracleSkyPhase === "planning") {
    oracleSkyEnergy = 0.38 + oracleSkyGenerationTarget * 0.58;
  }
}

function buildSummoningLine(
  reason: string,
  slotLabel: string,
  perspectiveLabel: string,
) {
  const matched = reason.match(/“([^”]+)”/)?.[1];
  if (matched) {
    return `此问牵动「${matched.replace(/、/g, " · ")}」，${perspectiveLabel}之声因而回应。`;
  }
  return `此问在「${slotLabel}」处尚有未明，${perspectiveLabel}之声因而回应。`;
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

function paintOccludingDust(
  context: WechatMiniprogram.CanvasRenderingContext.CanvasRenderingContext2D,
  width: number,
  height: number,
  timeSlow: number,
  energy: number,
) {
  const bands = [
    {
      x: width * (0.43 + Math.sin(timeSlow * 0.31) * 0.035),
      y: height * (0.49 + Math.cos(timeSlow * 0.27) * 0.018),
      radius: width * 0.86,
      ratio: 0.16,
      rotation: -0.19,
      alpha: 0.13 + energy * 0.035,
    },
    {
      x: width * (0.64 + Math.cos(timeSlow * 0.23) * 0.028),
      y: height * (0.7 + Math.sin(timeSlow * 0.19) * 0.02),
      radius: width * 0.58,
      ratio: 0.22,
      rotation: 0.13,
      alpha: 0.08 + energy * 0.025,
    },
  ];

  context.save();
  context.globalCompositeOperation = "source-over";
  for (const band of bands) {
    context.save();
    context.translate(band.x, band.y);
    context.rotate(band.rotation);
    context.scale(1, band.ratio);
    const dust = context.createRadialGradient(
      0,
      0,
      band.radius * 0.03,
      0,
      0,
      band.radius,
    );
    dust.addColorStop(0, `rgba(0, 0, 0, ${band.alpha})`);
    dust.addColorStop(0.38, `rgba(0, 0, 0, ${band.alpha * 0.82})`);
    dust.addColorStop(0.72, `rgba(0, 0, 0, ${band.alpha * 0.28})`);
    dust.addColorStop(1, "rgba(0, 0, 0, 0)");
    context.beginPath();
    context.arc(0, 0, band.radius, 0, Math.PI * 2);
    context.fillStyle = dust;
    context.fill();
    context.restore();
  }
  context.restore();
}

function setupOracleBloom(width: number, height: number) {
  oracleBloomCanvas = null;
  oracleBloomContext = null;
  try {
    if (typeof wx.createOffscreenCanvas !== "function") return;
    const canvas = wx.createOffscreenCanvas({
      type: "2d",
      width: Math.max(1, Math.ceil(width / 4)),
      height: Math.max(1, Math.ceil(height / 4)),
    });
    const context = canvas.getContext("2d") as
      | WechatMiniprogram.CanvasRenderingContext.CanvasRenderingContext2D
      | null;
    if (!context) return;
    oracleBloomCanvas = canvas;
    oracleBloomContext = context;
  } catch {
    // The sharp core field remains the compatibility fallback.
  }
}

function paintCoreBloom(
  context: WechatMiniprogram.CanvasRenderingContext.CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  palette: SkyPalette,
  fieldTime: number,
  formation: number,
) {
  const canvas = oracleBloomCanvas;
  const bloom = oracleBloomContext;
  if (
    !canvas ||
    !bloom ||
    oracleSkyWidth <= 0 ||
    oracleSkyHeight <= 0
  ) {
    return;
  }

  const scaleX = canvas.width / oracleSkyWidth;
  const scaleY = canvas.height / oracleSkyHeight;
  const x = centerX * scaleX;
  const y = centerY * scaleY;
  const bloomRadius = radius * scaleX * (0.56 + formation * 0.12);
  const driftX = Math.sin(fieldTime * 0.83) * bloomRadius * 0.13;
  const driftY = Math.cos(fieldTime * 0.61) * bloomRadius * 0.09;
  const deepColor = mixColor(
    palette.atmosphere,
    palette.primary,
    0.48 + formation * 0.18,
  );
  const hotColor = mixColor(
    palette.primary,
    palette.secondary,
    0.1 + formation * 0.3,
  );

  try {
    bloom.clearRect(0, 0, canvas.width, canvas.height);
    bloom.globalCompositeOperation = "lighter";

    const primaryGlow = bloom.createRadialGradient(
      x + driftX,
      y + driftY,
      0,
      x + driftX,
      y + driftY,
      bloomRadius,
    );
    primaryGlow.addColorStop(
      0,
      colorWithAlpha(hotColor, 0.18 + formation * 0.18),
    );
    primaryGlow.addColorStop(
      0.34 + Math.sin(fieldTime * 0.7) * 0.06,
      colorWithAlpha(deepColor, 0.13 + formation * 0.14),
    );
    primaryGlow.addColorStop(1, colorWithAlpha(palette.primary, 0));
    bloom.fillStyle = primaryGlow;
    bloom.fillRect(
      x - bloomRadius * 1.3,
      y - bloomRadius * 1.3,
      bloomRadius * 2.6,
      bloomRadius * 2.6,
    );

    const secondaryGlow = bloom.createRadialGradient(
      x - driftX * 0.72,
      y - driftY * 1.1,
      0,
      x - driftX * 0.72,
      y - driftY * 1.1,
      bloomRadius * 0.74,
    );
    secondaryGlow.addColorStop(
      0,
      colorWithAlpha(palette.secondary, 0.045 + formation * 0.07),
    );
    secondaryGlow.addColorStop(1, colorWithAlpha(palette.secondary, 0));
    bloom.fillStyle = secondaryGlow;
    bloom.fillRect(
      x - bloomRadius,
      y - bloomRadius,
      bloomRadius * 2,
      bloomRadius * 2,
    );

    context.save();
    context.globalCompositeOperation = "lighter";
    context.globalAlpha = 0.25 + formation * 0.16;
    context.drawImage(
      canvas,
      0,
      0,
      canvas.width,
      canvas.height,
      0,
      0,
      oracleSkyWidth,
      oracleSkyHeight,
    );
    context.globalAlpha = 0.08 + formation * 0.07;
    context.drawImage(
      canvas,
      0,
      0,
      canvas.width,
      canvas.height,
      -6,
      -6,
      oracleSkyWidth + 12,
      oracleSkyHeight + 12,
    );
    context.restore();
  } catch {
    oracleBloomCanvas = null;
    oracleBloomContext = null;
  }
}

function paintEvolvingCore(
  context: WechatMiniprogram.CanvasRenderingContext.CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  palette: SkyPalette,
  fieldTime: number,
  formation: number,
) {
  context.save();
  context.beginPath();
  context.arc(centerX, centerY, radius * 0.74, 0, Math.PI * 2);
  context.clip();
  paintCoreBloom(
    context,
    centerX,
    centerY,
    radius,
    palette,
    fieldTime,
    formation,
  );

  const driftX = Math.sin(fieldTime * 1.13) * radius * 0.14;
  const driftY = Math.cos(fieldTime * 0.79) * radius * 0.1;
  const deepColor = mixColor(
    palette.atmosphere,
    palette.primary,
    0.38 + formation * 0.24,
  );
  const middleColor = mixColor(
    palette.primary,
    palette.secondary,
    0.08 + formation * 0.36,
  );
  const hotColor = mixColor(
    deepColor,
    palette.secondary,
    0.12 + formation * 0.42,
  );
  const innerStop = 0.2 + Math.sin(fieldTime * 0.72) * 0.045;
  const middleStop = 0.48 + Math.cos(fieldTime * 0.57) * 0.06;
  const coreRadius = radius * (0.42 + formation * 0.06);

  context.save();
  context.globalCompositeOperation = "lighter";
  const field = context.createRadialGradient(
    centerX + driftX,
    centerY + driftY,
    radius * 0.015,
    centerX + driftX,
    centerY + driftY,
    coreRadius,
  );
  field.addColorStop(
    0,
    colorWithAlpha(hotColor, 0.14 + formation * 0.22),
  );
  field.addColorStop(
    innerStop,
    colorWithAlpha(middleColor, 0.08 + formation * 0.11),
  );
  field.addColorStop(
    middleStop,
    colorWithAlpha(deepColor, 0.055 + formation * 0.08),
  );
  field.addColorStop(1, colorWithAlpha(palette.atmosphere, 0));
  context.fillStyle = field;
  context.beginPath();
  context.arc(centerX, centerY, coreRadius, 0, Math.PI * 2);
  context.fill();

  const counterField = context.createRadialGradient(
    centerX - driftX * 0.76,
    centerY - driftY * 1.2,
    0,
    centerX - driftX * 0.76,
    centerY - driftY * 1.2,
    coreRadius * 0.72,
  );
  counterField.addColorStop(
    0,
    colorWithAlpha(palette.primary, 0.035 + formation * 0.075),
  );
  counterField.addColorStop(1, colorWithAlpha(palette.secondary, 0));
  context.fillStyle = counterField;
  context.beginPath();
  context.arc(centerX, centerY, coreRadius * 0.76, 0, Math.PI * 2);
  context.fill();
  context.restore();

  context.restore();
}

function traceAccretionHalf(
  context: WechatMiniprogram.CanvasRenderingContext.CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  innerRadius: number,
  outerRadius: number,
  verticalRatio: number,
  tilt: number,
  startAngle: number,
  endAngle: number,
) {
  context.beginPath();
  context.ellipse(
    centerX,
    centerY,
    outerRadius,
    outerRadius * verticalRatio,
    tilt,
    startAngle,
    endAngle,
  );
  context.ellipse(
    centerX,
    centerY,
    innerRadius,
    innerRadius * verticalRatio,
    tilt,
    endAngle,
    startAngle,
    true,
  );
  context.closePath();
}

function paintAccretionHalf(
  context: WechatMiniprogram.CanvasRenderingContext.CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  palette: SkyPalette,
  fieldTime: number,
  energy: number,
  formation: number,
  side: "far" | "near",
) {
  const tilt = -0.28;
  const innerRadius = radius * 1.07;
  const outerRadius = radius * 1.72;
  const verticalRatio = 0.235;
  const startAngle = side === "far" ? Math.PI : 0;
  const endAngle = side === "far" ? Math.PI * 2 : Math.PI;
  const sideStrength = side === "near" ? 1 : 0.38;
  const brightColor = mixColor(
    palette.primary,
    palette.secondary,
    side === "near" ? 0.54 : 0.2,
  );

  context.save();
  context.globalCompositeOperation = "lighter";
  // A transformed radial gradient gives the projected disc genuinely soft
  // inner and outer edges. It is a filled medium, not a stretched stroke.
  context.save();
  context.translate(centerX, centerY);
  context.rotate(tilt);
  context.scale(1, verticalRatio);
  context.beginPath();
  context.arc(0, 0, outerRadius, startAngle, endAngle);
  context.arc(0, 0, innerRadius, endAngle, startAngle, true);
  context.closePath();
  const mediumStrength = side === "near" ? 1 : 0.72;
  const body = context.createRadialGradient(
    0,
    0,
    innerRadius,
    0,
    0,
    outerRadius,
  );
  body.addColorStop(0, colorWithAlpha(palette.atmosphere, 0));
  body.addColorStop(
    0.16,
    colorWithAlpha(palette.primary, 0.035 * mediumStrength),
  );
  body.addColorStop(
    0.44,
    colorWithAlpha(brightColor, (0.16 + energy * 0.05) * mediumStrength),
  );
  body.addColorStop(
    0.66,
    colorWithAlpha(brightColor, (0.2 + formation * 0.05) * mediumStrength),
  );
  body.addColorStop(
    0.86,
    colorWithAlpha(palette.primary, 0.04 * mediumStrength),
  );
  body.addColorStop(1, colorWithAlpha(palette.atmosphere, 0));
  context.fillStyle = body;
  context.fill("evenodd");
  context.restore();

  traceAccretionHalf(
    context,
    centerX,
    centerY,
    innerRadius,
    outerRadius,
    verticalRatio,
    tilt,
    startAngle,
    endAngle,
  );
  context.clip("evenodd");
  context.lineCap = "butt";

  // The visible material is carried by short, independently evolving dust
  // currents distributed across the band. There is no shared orbit and no
  // pair of hard parallel edges to make the disc read as a planetary ring.
  context.lineCap = "round";
  for (let index = 0; index < accretionFilaments.length; index += 1) {
    const filament = accretionFilaments[index];
    const localTime = fieldTime * filament.speed + filament.phase;
    const localStart =
      startAngle +
      (filament.start % Math.PI) +
      Math.sin(localTime * 0.47) * 0.07;
    if (localStart >= endAngle) continue;
    const life = 0.5 + Math.sin(localTime) * 0.5;
    const sweep = Math.min(
      endAngle - localStart,
      filament.sweep * (0.66 + life * 0.54),
    );
    const middle = localStart + sweep / 2;
    const approach = Math.pow(Math.max(0, Math.cos(middle - 2.34)), 3.2);
    const color = mixColor(
      palette.primary,
      palette.secondary,
      0.08 + approach * 0.78,
    );
    const alpha =
      (0.025 + life * 0.045 + approach * (0.14 + formation * 0.06)) *
      sideStrength;
    const strandRadius = Math.min(
      outerRadius * 0.992,
      Math.max(innerRadius * 1.008, radius * filament.radius),
    );
    context.beginPath();
    context.ellipse(
      centerX,
      centerY,
      strandRadius,
      strandRadius * verticalRatio,
      tilt,
      localStart,
      localStart + sweep,
    );
    context.lineWidth = 1.05 + filament.width * (0.28 + life * 0.2);
    context.strokeStyle = colorWithAlpha(color, alpha);
    context.stroke();
  }

  // Dark dust can occlude the bright disc because this pass deliberately
  // returns to source-over. It is clipped to the annulus and cannot darken the
  // surrounding sky.
  context.globalCompositeOperation = "source-over";
  context.lineCap = "round";
  for (let index = 0; index < accretionFilaments.length; index += 3) {
    const filament = accretionFilaments[index];
    const localTime = fieldTime * filament.speed + filament.phase;
    const localStart =
      startAngle +
      (filament.start % Math.PI) +
      Math.sin(localTime * 0.53) * 0.08;
    if (localStart >= endAngle) continue;
    const life = 0.5 + Math.sin(localTime) * 0.5;
    context.beginPath();
    context.ellipse(
      centerX,
      centerY,
      radius * filament.radius,
      radius * filament.radius * verticalRatio,
      tilt,
      localStart,
      Math.min(endAngle, localStart + filament.sweep * (0.7 + life * 0.42)),
    );
    context.lineWidth = 0.55 + filament.width * (0.18 + life * 0.2);
    context.strokeStyle = `rgba(0, 0, 0, ${0.12 + life * 0.22})`;
    context.stroke();
  }
  context.restore();
}

function paintLensedImage(
  context: WechatMiniprogram.CanvasRenderingContext.CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  palette: SkyPalette,
  formation: number,
  side: "upper" | "lower",
) {
  const isUpper = side === "upper";
  const lensCenterY = centerY + radius * (isUpper ? 0.025 : 0.035);
  const lensRadiusX = radius * (isUpper ? 1.14 : 1.1);
  const lensRadiusY = radius * (isUpper ? 1.145 : 1.08);
  const startAngle = isUpper ? Math.PI + 0.06 : 0.06;
  const endAngle = isUpper ? Math.PI * 2 - 0.06 : Math.PI - 0.06;
  const strength = isUpper ? 1 : 0.23;
  const tilt = -0.2;
  context.save();
  context.globalCompositeOperation = "lighter";
  // The sharp lens image is angularly modulated so it feels like bent disc
  // light rather than a second decorative ring.
  const segmentCount = 44;
  const segmentArc = (endAngle - startAngle) / segmentCount;
  context.lineCap = "butt";
  for (let index = 0; index < segmentCount; index += 1) {
    const angle = startAngle + index * segmentArc;
    const middle = angle + segmentArc / 2;
    const approach = Math.pow(Math.max(0, Math.cos(middle - 4.02)), 3.4);
    const fade = Math.sin(((index + 0.5) / segmentCount) * Math.PI);
    const alpha =
      (0.18 + approach * (0.58 + formation * 0.1)) * fade * strength;
    const color = mixColor(
      palette.primary,
      palette.secondary,
      0.16 + approach * 0.76,
    );
    const widths = [16, 7, 0.85 + approach * 0.85];
    for (let layer = 0; layer < widths.length; layer += 1) {
      context.beginPath();
      context.ellipse(
        centerX,
        lensCenterY,
        lensRadiusX,
        lensRadiusY,
        tilt,
        angle,
        angle + segmentArc * 1.04,
      );
      context.lineWidth = widths[layer];
      context.strokeStyle = colorWithAlpha(
        color,
        alpha * (layer === 0 ? 0.11 : layer === 1 ? 0.34 : 1),
      );
      context.stroke();
    }
  }
  context.restore();
}

function paintPhotonRing(
  context: WechatMiniprogram.CanvasRenderingContext.CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  palette: SkyPalette,
  fieldTime: number,
  energy: number,
  formation: number,
) {
  context.save();
  context.globalCompositeOperation = "lighter";
  context.lineCap = "butt";

  const segmentCount = 64;
  const segmentArc = (Math.PI * 2) / segmentCount;
  for (let index = 0; index < segmentCount; index += 1) {
    const angle = index * segmentArc;
    const middle = angle + segmentArc / 2;
    const approach = Math.pow(
      Math.max(0, Math.cos(middle - 2.34)),
      4,
    );
    const shimmer =
      0.88 + Math.sin(fieldTime * 0.9 + index * 0.73) * 0.12;
    const counterCrest = Math.pow(
      Math.max(0, Math.cos(middle + 0.72)),
      8,
    );
    const alpha =
      (0.012 + energy * 0.012 + counterCrest * 0.08 +
        approach * (0.68 + formation * 0.14)) * shimmer;
    const color = mixColor(
      palette.primary,
      palette.secondary,
      0.2 + approach * 0.76,
    );
    context.beginPath();
    const segmentRadius =
      radius * (1 + Math.sin(index * 1.87 + fieldTime * 0.82) * 0.0028);
    context.arc(
      centerX,
      centerY,
      segmentRadius,
      angle,
      angle + segmentArc * 1.035,
    );
    context.lineWidth = 1.05 + approach * 0.38;
    context.strokeStyle = colorWithAlpha(color, Math.min(0.92, alpha));
    context.stroke();
  }
  context.restore();
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
  generationProgress: number,
) {
  const isIngesting = phase === "ingesting";
  const formation =
    phase === "planning"
      ? 0.08 + generationProgress * 0.92
      : isIngesting
        ? 0.12 + phaseProgress * 0.3
        : 0.06 + energy * 0.12;
  const vortexDrive = isIngesting
    ? Math.sin(Math.min(1, phaseProgress) * Math.PI)
    : phase === "planning"
      ? 0.22 + generationProgress * 0.78
      : 0;
  const horizonBreath = 0.5 + Math.sin(time * 0.00105) * 0.5;
  const activeRadius =
    radius * (1 + horizonBreath * 0.008 + vortexDrive * 0.025);
  // Unlike a spinner, fieldTime never maps directly to a shared angle. It
  // drives independent birth, width and drift rhythms across the medium.
  const fieldTime =
    time * (0.00016 + energy * 0.00012 + vortexDrive * 0.0005);

  const shadowX = centerX - activeRadius * 0.025;
  const shadowY = centerY + activeRadius * 0.012;

  // Back-to-front order is the defining silhouette: far disc, lensed images,
  // shadow, near disc, then the photon ring.
  paintAccretionHalf(
    context,
    centerX,
    centerY,
    activeRadius,
    palette,
    fieldTime,
    energy,
    formation,
    "far",
  );
  paintLensedImage(
    context,
    centerX,
    centerY,
    activeRadius,
    palette,
    formation,
    "lower",
  );
  paintLensedImage(
    context,
    centerX,
    centerY,
    activeRadius,
    palette,
    formation,
    "upper",
  );

  // The Web core is not a solid black disc: it absorbs the atmosphere
  // progressively, so its silhouette is discovered through the photon edge.
  context.save();
  context.globalCompositeOperation = "source-over";
  const absorption = context.createRadialGradient(
    shadowX,
    shadowY,
    0,
    shadowX,
    shadowY,
    activeRadius * 1.035,
  );
  absorption.addColorStop(0, "rgba(0, 0, 0, 0.998)");
  absorption.addColorStop(0.72, "rgba(0, 0, 0, 0.992)");
  absorption.addColorStop(0.9, "rgba(0, 0, 0, 0.94)");
  absorption.addColorStop(0.975, "rgba(0, 0, 0, 0.34)");
  absorption.addColorStop(1, "rgba(0, 0, 0, 0)");
  context.beginPath();
  context.arc(shadowX, shadowY, activeRadius * 1.035, 0, Math.PI * 2);
  context.fillStyle = absorption;
  context.fill();

  paintEvolvingCore(
    context,
    shadowX,
    shadowY,
    activeRadius,
    palette,
    fieldTime,
    formation,
  );
  context.restore();

  paintAccretionHalf(
    context,
    centerX,
    centerY,
    activeRadius,
    palette,
    fieldTime,
    energy,
    formation,
    "near",
  );
  paintPhotonRing(
    context,
    shadowX,
    shadowY,
    activeRadius,
    palette,
    fieldTime,
    energy,
    formation,
  );
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
  oracleSkyGenerationProgress +=
    (oracleSkyGenerationTarget - oracleSkyGenerationProgress) * 0.065;
  if (
    Math.abs(oracleSkyGenerationTarget - oracleSkyGenerationProgress) < 0.001
  ) {
    oracleSkyGenerationProgress = oracleSkyGenerationTarget;
  }

  const width = oracleSkyWidth;
  const height = oracleSkyHeight;
  const palette = currentSkyPalette();
  if (oracleSkyRenderedPhase !== oracleSkyPhase) {
    oracleSkyRenderedPhase = oracleSkyPhase;
    oracleSkyPhaseStartedAt = time;
  }
  const phaseElapsed = Math.max(0, time - oracleSkyPhaseStartedAt);
  const phaseProgress =
    oracleSkyPhase === "ingesting"
      ? Math.max(0, Math.min(1, phaseElapsed / 720))
      : 0;
  const revealProgress =
    oracleSkyPhase === "revealing"
      ? Math.max(0, Math.min(1, phaseElapsed / 920))
      : 1;
  const planningProgress =
    oracleSkyPhase === "planning"
      ? Math.max(0, Math.min(1, phaseElapsed / 760))
      : oracleSkyPhase === "ingesting"
        ? 0
        : 1;
  const planningEase =
    planningProgress * planningProgress * (3 - 2 * planningProgress);
  const revealEase = 1 - Math.pow(1 - revealProgress, 3);
  const timeSlow = time * 0.00012;
  const energy = oracleSkyEnergy;
  const isIdle = oracleSkyPhase === "idle";
  const cardSpaceActive =
    oracleSkyPhase === "revealing" ||
    oracleSkyPhase === "ready" ||
    oracleSkyPhase === "stopped" ||
    oracleSkyPhase === "error";
  const cameraTarget = cardSpaceActive ? oracleCameraDriftTarget : 0;
  oracleCameraDrift += (cameraTarget - oracleCameraDrift) * 0.075;
  const horizonEntryX = oracleHorizonCenterX || width * 0.5;
  const horizonEntryY = oracleHorizonCenterY || height * 0.56;
  const centerY =
    oracleSkyPhase === "planning"
      ? horizonEntryY + (height * 0.48 - horizonEntryY) * planningEase
      : oracleSkyPhase === "revealing"
        ? height * (0.48 - 0.23 * revealEase)
        : isIdle || oracleSkyPhase === "ingesting"
          ? horizonEntryY
          : height * 0.25;
  const centerBaseX =
    oracleSkyPhase === "planning"
      ? horizonEntryX + (width * 0.5 - horizonEntryX) * planningEase
      : isIdle || oracleSkyPhase === "ingesting"
        ? horizonEntryX
        : width * 0.5;
  const centerX = centerBaseX + oracleCameraDrift * width * 0.075;
  const settledRadius = Math.min(width * 0.25, 92);
  const planningRadius = Math.min(width * 0.35, 132);
  const horizonRadius =
    oracleSkyPhase === "planning"
      ? settledRadius +
        (planningRadius - settledRadius) * planningEase
      : oracleSkyPhase === "revealing"
        ? planningRadius +
          (settledRadius - planningRadius) * revealEase
        : isIdle || oracleSkyPhase === "ingesting"
          ? settledRadius * (0.97 + energy * 0.03)
          : settledRadius;
  const horizonOpacity =
    oracleSkyPhase === "revealing"
      ? Math.max(0, 1 - revealProgress / 0.42)
      : oracleSkyPhase === "ready" ||
          oracleSkyPhase === "stopped" ||
          oracleSkyPhase === "error"
        ? 0
        : 1;

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
  // Low-frequency parallax washes add depth behind the detailed static nebula
  // texture. They are intentionally not described as Canvas FBM noise.
  paintCloud(
    context,
    width * (0.5 + Math.sin(timeSlow * 0.44) * 0.06),
    height * (0.36 + Math.cos(timeSlow * 0.3) * 0.06),
    width * 0.9,
    palette.atmosphere,
    0.08 + energy * 0.06,
  );
  paintCloud(
    context,
    width * (0.38 + Math.cos(timeSlow * 0.52) * 0.08),
    height * 0.6,
    width * 0.58,
    palette.primary,
    0.04 + energy * 0.05,
  );

  for (let index = 0; index < oracleStars.length; index += 1) {
    const star = oracleStars[index];
    const twinkle =
      0.35 + 0.65 * Math.abs(Math.sin(time * 0.0007 + star.phase * 8));
    const starRadius = star.size * (0.52 + energy * 0.2);
    let starX = star.x * width;
    let starY = star.y * height;
    const offsetX = starX - centerX;
    const offsetY = starY - centerY;
    const distance = Math.hypot(offsetX, offsetY);
    const lensReach = horizonRadius * 2.65;
    const lensStrength =
      !oracleSkyReading &&
      horizonOpacity > 0.01 &&
      distance > horizonRadius * 0.82 &&
      distance < lensReach
        ? Math.pow(1 - distance / lensReach, 1.6) * horizonOpacity
        : 0;
    if (lensStrength > 0) {
      const radialPush =
        ((horizonRadius * horizonRadius) /
          Math.max(distance, horizonRadius * 0.86)) *
        0.16 *
        lensStrength;
      starX += (offsetX / distance) * radialPush;
      starY += (offsetY / distance) * radialPush;
    }
    context.beginPath();
    if (lensStrength > 0.035) {
      context.ellipse(
        starX,
        starY,
        starRadius * (1 + lensStrength * 3.6),
        starRadius * (0.62 + lensStrength * 0.18),
        Math.atan2(offsetY, offsetX) + Math.PI / 2,
        0,
        Math.PI * 2,
      );
    } else {
      context.arc(starX, starY, starRadius, 0, Math.PI * 2);
    }
    context.fillStyle = colorWithAlpha(
      index % 4 === 0 ? palette.secondary : palette.primary,
      (0.12 + energy * 0.17) * twinkle,
    );
    context.fill();
  }

  // A slow source-over pass places opaque dust in front of the additive
  // clouds and stars. Without it, every atmospheric layer can only brighten
  // the frame and the sky loses its foreground/background ordering.
  paintOccludingDust(context, width, height, timeSlow, energy);

  if (!oracleSkyReading && horizonOpacity > 0.01) {
    context.save();
    context.globalAlpha = horizonOpacity;
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
      oracleSkyGenerationProgress,
    );
    context.restore();
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

  if (oracleSkyReading && oracleSkyFrameId !== null) {
    canvas.cancelAnimationFrame(oracleSkyFrameId);
    oracleSkyFrameId = null;
  }
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
        (card) =>
          card.status === "ready" ||
          card.status === "failed" ||
          card.status === "cancelled",
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
    exegesis: exegesis.map((text, index) => ({
      text,
      revealDelayMs: 940 + index * 120,
    })),
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
    isQuestionFocused: false,
    hasHistory: false,
    spectrumId: "obsidian" as SpectrumId,
    spectrumStyle: spectrumStyleFromPalette(skyPalettes.obsidian),
    runId: "",
    plan: null as StoredAdviceRun["plan"] | null,
    cards: [] as ImmersiveCardViewModel[],
    cardsVisible: false,
    completedCardCount: 0,
    revealedCount: 0,
    allCardsRevealed: false,
    isHoldingQuestion: false,
    holdInterrupted: false,
    showHoldHint: true,
    cardSignalId: "",
    cardSignalText: "",
    sceneNotice: "",
    featuredCard: null as ImmersiveCardViewModel | null,
    featuredOriginStyle: "",
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
    synthesisMeta: "",
    isSynthesizing: false,
  },

  onLoad() {
    let showHoldHint = true;
    try {
      showHoldHint = wx.getStorageSync(HOLD_HINT_STORAGE_KEY) !== true;
    } catch {
      // Storage failures should not block the primary interaction.
    }
    try {
      this.setData({
        statusBarHeight: wx.getWindowInfo().statusBarHeight,
        showHoldHint,
      });
    } catch {
      this.setData({ statusBarHeight: 20, showHoldHint });
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
          setupOracleBloom(width, height);
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
    this.setData({ hasHistory: loadAdviceRuns().length > 0 });
    startOracleSky();
  },

  onHide() {
    stopOracleSky();
  },

  onUnload() {
    stopOracleSky();
    oracleSkyCanvas = null;
    oracleSkyContext = null;
    oracleBloomCanvas = null;
    oracleBloomContext = null;
    oracleSkyWidth = 0;
    oracleSkyHeight = 0;
    oracleHorizonCenterX = 0;
    oracleHorizonCenterY = 0;
    activeController?.cancel();
    activeController = null;
    if (ingestionTimer) clearTimeout(ingestionTimer);
    if (questionHoldTimer) clearTimeout(questionHoldTimer);
    if (questionChargeTimer) clearTimeout(questionChargeTimer);
    if (holdInterruptedTimer) clearTimeout(holdInterruptedTimer);
    if (cardSignalTimer) clearTimeout(cardSignalTimer);
    if (sceneNoticeTimer) clearTimeout(sceneNoticeTimer);
    if (cardStageRevealTimer) clearTimeout(cardStageRevealTimer);
    if (cardStageSettleTimer) clearTimeout(cardStageSettleTimer);
    if (oracleEntryTimer) clearTimeout(oracleEntryTimer);
    if (readingMotionTimer) clearTimeout(readingMotionTimer);
    if (spectrumStyleTimer) clearTimeout(spectrumStyleTimer);
    ingestionTimer = null;
    questionHoldTimer = null;
    questionChargeTimer = null;
    holdInterruptedTimer = null;
    cardSignalTimer = null;
    sceneNoticeTimer = null;
    synthesisRequestId += 1;
    cardStageRevealTimer = null;
    cardStageSettleTimer = null;
    oracleEntryTimer = null;
    readingMotionTimer = null;
    spectrumStyleTimer = null;
    readingTouchStart = null;
    oracleSkyReading = false;
    featuredMeasurePending = false;
    oracleCameraDrift = 0;
    oracleCameraDriftTarget = 0;
    oracleRailDrift = 0;
    oracleSkyGenerationProgress = 0;
    oracleSkyGenerationTarget = 0;
    cardStageMinimumElapsed = false;
  },

  onQuestionInput(event: InputEvent) {
    const question = event.detail.value.slice(0, 1000);
    const length = question.trim().length;
    const canSubmit = length >= 10 && length <= 1000;
    const spectrumId =
      canSubmit && !this.data.canSubmit
        ? randomSpectrum(this.data.spectrumId)
        : !canSubmit
          ? "obsidian"
          : this.data.spectrumId;
    const questionEnergy = length === 0 ? 0 : canSubmit ? 2 : 1;
    setOracleSkyState(
      spectrumId,
      questionEnergy === 0 ? 0.18 : questionEnergy === 1 ? 0.38 : 0.7,
      "idle",
    );
    if (spectrumId !== this.data.spectrumId) {
      this.animateSpectrumStyle();
    }
    this.setData({
      question,
      charCount: question.length,
      questionEnergy,
      canSubmit,
      spectrumId,
      error: "",
    });
  },

  onQuestionFocus() {
    this.setData({ isQuestionFocused: true });
  },

  onQuestionBlur() {
    this.setData({ isQuestionFocused: false });
  },

  animateSpectrumStyle() {
    if (spectrumStyleTimer) clearTimeout(spectrumStyleTimer);
    const tick = () => {
      const now = Date.now();
      const elapsed = now - oracleSkyPaletteStartedAt;
      this.setData({
        spectrumStyle: spectrumStyleFromPalette(currentSkyPalette(now)),
      });
      if (elapsed >= SPECTRUM_TRANSITION_DURATION_MS) {
        spectrumStyleTimer = null;
        return;
      }
      spectrumStyleTimer = setTimeout(tick, SPECTRUM_STYLE_FRAME_MS);
    };
    tick();
  },

  showSceneNotice(message: string) {
    if (sceneNoticeTimer) clearTimeout(sceneNoticeTimer);
    this.setData({ sceneNotice: message });
    sceneNoticeTimer = setTimeout(() => {
      sceneNoticeTimer = null;
      this.setData({ sceneNotice: "" });
    }, 1800);
  },

  signalCard(cardId: string, message: string) {
    if (cardSignalTimer) clearTimeout(cardSignalTimer);
    this.setData({ cardSignalId: cardId, cardSignalText: message });
    cardSignalTimer = setTimeout(() => {
      cardSignalTimer = null;
      this.setData({ cardSignalId: "", cardSignalText: "" });
    }, 1280);
  },

  onQuestionHoldStart() {
    if (!this.data.canSubmit || this.data.isRunning || questionHoldTimer) return;
    if (holdInterruptedTimer) clearTimeout(holdInterruptedTimer);
    holdInterruptedTimer = null;
    vibrate("light");
    setOracleSkyState(this.data.spectrumId, 1, "idle");
    this.setData({
      isHoldingQuestion: true,
      holdInterrupted: false,
      sceneNotice: "",
      error: "",
    });
    // Three-stage haptic crescendo: light → light → medium at the crossing.
    questionChargeTimer = setTimeout(() => {
      questionChargeTimer = null;
      if (this.data.isHoldingQuestion) vibrate("light");
    }, QUESTION_HOLD_MIDPOINT_MS);
    questionHoldTimer = setTimeout(() => {
      questionHoldTimer = null;
      this.onSubmit();
    }, QUESTION_HOLD_DURATION_MS);
  },

  onQuestionHoldEnd() {
    const wasInterrupted = Boolean(
      questionHoldTimer && this.data.isHoldingQuestion,
    );
    if (questionHoldTimer) clearTimeout(questionHoldTimer);
    if (questionChargeTimer) clearTimeout(questionChargeTimer);
    questionHoldTimer = null;
    questionChargeTimer = null;
    if (this.data.isHoldingQuestion) {
      setOracleSkyState(this.data.spectrumId, 0.7, "idle");
      this.setData({
        isHoldingQuestion: false,
        holdInterrupted: wasInterrupted,
      });
      if (wasInterrupted) {
        vibrate("light");
        this.showSceneNotice("光环尚未闭合");
        if (holdInterruptedTimer) clearTimeout(holdInterruptedTimer);
        holdInterruptedTimer = setTimeout(() => {
          holdInterruptedTimer = null;
          this.setData({ holdInterrupted: false });
        }, 520);
      }
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
    try {
      wx.setStorageSync(HOLD_HINT_STORAGE_KEY, true);
    } catch {
      // A failed hint preference write must not interrupt a valid submission.
    }
    vibrate("medium");
    const spectrumId = this.data.spectrumId;
    oracleSkyGenerationProgress = 0;
    oracleSkyGenerationTarget = 0;
    cardStageMinimumElapsed = false;
    setOracleSkyState(spectrumId, 1, "ingesting");
    this.setData({
      isRunning: true,
      phase: "ingesting",
      isQuestionFocused: false,
      spectrumId,
      isHoldingQuestion: false,
      holdInterrupted: false,
      showHoldHint: false,
      runId: "",
      plan: null,
      cards: [],
      cardsVisible: false,
      completedCardCount: 0,
      revealedCount: 0,
      allCardsRevealed: false,
      featuredCard: null,
      featuredOriginStyle: "",
      featuredCardEntering: false,
      enteringCardId: "",
      focusedCard: null,
      readingMotion: "",
      error: "",
      synthesisTitle: "",
      synthesisBody: "",
      synthesisMeta: "",
      isSynthesizing: false,
    });
    wx.pageScrollTo({ scrollTop: 0, duration: 180 });

    ingestionTimer = setTimeout(() => {
      ingestionTimer = null;
      this.beginAdviceRun(question);
    }, 720);
  },

  beginAdviceRun(question: string) {
    setOracleSkyState(this.data.spectrumId, 0.38, "planning");
    this.setData({ phase: "planning" });
    activeController = startAdviceRun(question, {
      onEvent: (event) => this.handleRunEvent(event),
      onTransportError: (message) => {
        activeController = null;
        if (cardStageRevealTimer) clearTimeout(cardStageRevealTimer);
        if (cardStageSettleTimer) clearTimeout(cardStageSettleTimer);
        cardStageRevealTimer = null;
        cardStageSettleTimer = null;
        vibrate("heavy");
        setOracleSkyState(this.data.spectrumId, 0.2, "error");
        this.setData({
          isRunning: false,
          phase: "error",
          cardsVisible: this.data.cards.length > 0,
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
            cardStyle: cardSpectrumStyle(this.data.spectrumId, index),
            sealGlyph: visual.sealGlyph,
            constellation: visual.constellation,
            slotLabel: planItem?.slotLabel ?? "",
            selectionReason: planItem?.reason ?? "",
            summoningLine: buildSummoningLine(
              planItem?.reason ?? "",
              planItem?.slotLabel ?? "",
              card.persona.perspectiveLabel,
            ),
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
        ...cardMetrics(cards),
      });
      oracleSkyGenerationTarget = Math.max(
        oracleSkyGenerationTarget,
        0.04,
      );
      if (cardStageRevealTimer) clearTimeout(cardStageRevealTimer);
      cardStageMinimumElapsed = false;
      cardStageRevealTimer = setTimeout(() => {
        cardStageRevealTimer = null;
        cardStageMinimumElapsed = true;
        if (!this.data.isRunning) this.revealCardStage();
      }, 1180);
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
      updateOracleGenerationTarget(cards);
      this.setData({ cards, ...cardMetrics(cards) });
      return;
    }

    if (event.type === "card.done") {
      const cards = this.data.cards.map((card) =>
        card.id === event.cardId
          ? { ...card, status: "ready" as const }
          : card,
      );
      updateOracleGenerationTarget(cards);
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
      updateOracleGenerationTarget(cards);
      this.setData({ cards, ...cardMetrics(cards) });
      return;
    }

    if (event.type === "run.done") {
      activeController = null;
      oracleSkyGenerationTarget = 1;
      if (oracleSkyPhase === "planning") oracleSkyEnergy = 0.96;
      const phase = this.data.cardsVisible
        ? cardStageSettleTimer
          ? "revealing"
          : "ready"
        : "planning";
      if (phase === "ready") {
        setOracleSkyState(this.data.spectrumId, 0.46, "ready");
      }
      this.setData(
        {
          isRunning: false,
          phase,
          ...cardMetrics(this.data.cards),
        },
        () => {
          this.persistCurrentRun();
          if (cardStageMinimumElapsed && !this.data.cardsVisible) {
            this.revealCardStage();
          }
        },
      );
    }
  },

  revealCardStage() {
    if (this.data.cards.length === 0 || this.data.cardsVisible) return;
    setOracleSkyState(this.data.spectrumId, 0.66, "revealing");
    vibrate("medium");
    this.setData({
      cardsVisible: true,
      phase: "revealing",
    });
    if (cardStageSettleTimer) clearTimeout(cardStageSettleTimer);
    cardStageSettleTimer = setTimeout(() => {
      cardStageSettleTimer = null;
      if (this.data.isRunning) return;
      setOracleSkyState(this.data.spectrumId, 0.46, "ready");
      this.setData({ phase: "ready" });
    }, 920);
  },

  onStop() {
    if (ingestionTimer) clearTimeout(ingestionTimer);
    if (questionHoldTimer) clearTimeout(questionHoldTimer);
    if (questionChargeTimer) clearTimeout(questionChargeTimer);
    if (cardStageRevealTimer) clearTimeout(cardStageRevealTimer);
    if (cardStageSettleTimer) clearTimeout(cardStageSettleTimer);
    ingestionTimer = null;
    questionHoldTimer = null;
    questionChargeTimer = null;
    cardStageRevealTimer = null;
    cardStageSettleTimer = null;
    cardStageMinimumElapsed = false;
    activeController?.cancel();
    activeController = null;
    const cards = this.data.cards.map((card) =>
      card.status === "waiting" || card.status === "streaming"
        ? {
            ...card,
            status: "cancelled" as const,
            body: "",
            error: "",
          }
        : card,
    );
    this.setData(
      {
        isRunning: false,
        isHoldingQuestion: false,
        phase: "stopped",
        cardsVisible: cards.length > 0,
        cards,
        ...cardMetrics(cards),
      },
      () => this.persistCurrentRun(),
    );
    setOracleSkyState(this.data.spectrumId, 0.26, "stopped");
  },

  onCardTap(event: CardTapEvent) {
    const index = Number(event.currentTarget.dataset.index);
    const card = this.data.cards[index];
    if (!card) return;

    if (card.status === "cancelled") {
      this.retryCardAt(index);
      return;
    }
    if (card.status !== "ready") {
      vibrate(card.status === "failed" ? "heavy" : "light");
      this.signalCard(
        card.id,
        card.status === "failed" ? "封印未成，可在牌面重试" : "仍在凝结",
      );
      return;
    }

    if (!card.isRevealed) {
      if (featuredMeasurePending) return;
      featuredMeasurePending = true;
      const cards = this.data.cards.map((item, cardIndex) =>
        cardIndex === index ? { ...item, isRevealed: true } : item,
      );
      const revealedCard = cards[index];
      vibrate("medium");
      this.setData({
        cards,
        ...cardMetrics(cards),
      }, () => {
        let windowWidth = oracleSkyWidth || 375;
        let windowHeight = oracleSkyHeight || 812;
        try {
          const windowInfo = wx.getWindowInfo();
          windowWidth = windowInfo.windowWidth;
          windowHeight = windowInfo.windowHeight;
        } catch {
          // The simulator can briefly omit window metrics while resizing.
        }
        const reveal = (
          rect?: WechatMiniprogram.BoundingClientRectCallbackResult,
        ) => {
          if (!featuredMeasurePending) return;
          featuredMeasurePending = false;
          oracleCameraDriftTarget = 0;
          const finalWidth =
            windowWidth * (FEATURED_CARD_WIDTH_RPX / 750);
          const finalHeight =
            windowWidth * (FEATURED_CARD_HEIGHT_RPX / 750);
          const sourceScale = rect
            ? Math.min(
                rect.width / finalWidth,
                rect.height / finalHeight,
              )
            : 0.78;
          const originX = rect
            ? rect.left + rect.width / 2 - windowWidth / 2
            : 0;
          const originY = rect
            ? rect.top + rect.height / 2 - windowHeight / 2
            : 40;
          this.setData({
            featuredCard: revealedCard,
            featuredOriginStyle:
              `--reveal-x:${originX.toFixed(1)}px;` +
              `--reveal-y:${originY.toFixed(1)}px;` +
              `--reveal-scale:${Math.max(0.54, Math.min(1, sourceScale)).toFixed(3)};`,
          });
        };
        const query = wx.createSelectorQuery();
        query
          .selectAll(".oracle-card")
          .boundingClientRect(
            (
              result: WechatMiniprogram.BoundingClientRectCallbackResult,
            ) => {
              const rects = result as unknown as
                WechatMiniprogram.BoundingClientRectCallbackResult[];
              reveal(rects?.[index]);
            },
          );
        query.exec(() => reveal());
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

  onRetryCard(event: CardTapEvent) {
    const index = Number(event.currentTarget.dataset.index);
    this.retryCardAt(index);
  },

  retryCardAt(index: number) {
    const card = this.data.cards[index];
    if (
      !card ||
      (card.status !== "failed" && card.status !== "cancelled")
    ) {
      return;
    }
    if (activeController || this.data.isRunning) {
      vibrate("light");
      this.signalCard(card.id, "另一枚封印仍在凝结");
      return;
    }

    const cards = this.data.cards.map((item, cardIndex) =>
      cardIndex === index
        ? {
            ...item,
            status: "waiting" as const,
            body: "",
            error: "",
            isRevealed: false,
          }
        : item,
    );
    vibrate("medium");
    this.setData({
      cards,
      isRunning: true,
      phase: "ready",
      error: "",
      ...cardMetrics(cards),
    });
    setOracleSkyState(this.data.spectrumId, 0.5, "ready");
    activeController = retryAdviceCard(this.data.question.trim(), card, {
      onEvent: (event) => this.handleRunEvent(event),
      onTransportError: (message) => {
        activeController = null;
        const failedCards = this.data.cards.map((item) =>
          item.id === card.id
            ? {
                ...item,
                status: "failed" as const,
                error: message,
              }
            : item,
        );
        this.setData({
          cards: failedCards,
          isRunning: false,
          phase: "ready",
          error: message,
          ...cardMetrics(failedCards),
        });
        setOracleSkyState(this.data.spectrumId, 0.36, "ready");
        vibrate("heavy");
        this.signalCard(card.id, message);
      },
    });
  },

  onDismissFeatured() {
    if (this.data.featuredCardEntering) return;
    oracleCameraDriftTarget = oracleRailDrift;
    this.setData({
      featuredCard: null,
      featuredCardEntering: false,
      featuredOriginStyle: "",
    });
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
    oracleCameraDriftTarget = 0;
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
    oracleCameraDriftTarget = oracleRailDrift;
    this.setData({ focusedCard: null, readingMotion: "" });
    startOracleSky();
  },

  onCardRailScroll(event: CardRailScrollEvent) {
    const width = Math.max(oracleSkyWidth, 320);
    const drift = -Math.max(
      0,
      Math.min(1, event.detail.scrollLeft / (width * 1.15)),
    );
    oracleRailDrift = drift;
    if (!this.data.featuredCard && !this.data.focusedCard) {
      oracleCameraDriftTarget = drift;
    }
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
    const horizontalDistance = Math.abs(deltaX);
    const verticalDistance = Math.abs(deltaY);
    if (
      horizontalDistance < 72 ||
      verticalDistance > 64 ||
      horizontalDistance < verticalDistance * 2.5
    ) {
      return;
    }
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
    const mode = event.currentTarget.dataset.mode as
      | AdviceSynthesisMode
      | undefined;
    if (!mode || this.data.isSynthesizing) return;
    const readyCards = this.data.cards.filter(
      (card) => card.status === "ready" && card.body.trim(),
    );
    if (readyCards.length === 0) {
      vibrate("light");
      this.showSceneNotice("至少等待一枚封印完成");
      return;
    }
    const requestId = ++synthesisRequestId;
    vibrate("medium");
    this.setData({
      isSynthesizing: true,
      synthesisTitle: "",
      synthesisBody: "",
      synthesisMeta: "",
      sceneNotice: "三种声音正在收束",
    });
    void synthesizeAdvice({
      question: this.data.question.trim(),
      mode,
      cards: readyCards,
    })
      .then((result) => {
        if (requestId !== synthesisRequestId) return;
        vibrate();
        this.setData(
          {
            isSynthesizing: false,
            sceneNotice: "",
            synthesisTitle: result.title,
            synthesisBody: result.body,
            synthesisMeta:
              result.source === "model"
                ? "依据本轮问题与三张判断收束"
                : "原型规则整理 · 非模型生成",
          },
          () => this.persistCurrentRun(),
        );
      })
      .catch((error: unknown) => {
        if (requestId !== synthesisRequestId) return;
        const message =
          error instanceof Error
            ? error.message
            : "三种声音暂时没有完成收束";
        vibrate("heavy");
        this.setData({ isSynthesizing: false, sceneNotice: "" });
        this.showSceneNotice(message);
      });
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
      spectrumId: this.data.spectrumId,
    });
    if (!this.data.hasHistory) this.setData({ hasHistory: true });
  },

  onReset() {
    if (ingestionTimer) clearTimeout(ingestionTimer);
    if (questionHoldTimer) clearTimeout(questionHoldTimer);
    if (questionChargeTimer) clearTimeout(questionChargeTimer);
    if (cardStageRevealTimer) clearTimeout(cardStageRevealTimer);
    if (cardStageSettleTimer) clearTimeout(cardStageSettleTimer);
    if (oracleEntryTimer) clearTimeout(oracleEntryTimer);
    if (readingMotionTimer) clearTimeout(readingMotionTimer);
    if (spectrumStyleTimer) clearTimeout(spectrumStyleTimer);
    if (holdInterruptedTimer) clearTimeout(holdInterruptedTimer);
    if (cardSignalTimer) clearTimeout(cardSignalTimer);
    if (sceneNoticeTimer) clearTimeout(sceneNoticeTimer);
    ingestionTimer = null;
    questionHoldTimer = null;
    questionChargeTimer = null;
    cardStageRevealTimer = null;
    cardStageSettleTimer = null;
    oracleEntryTimer = null;
    readingMotionTimer = null;
    spectrumStyleTimer = null;
    holdInterruptedTimer = null;
    cardSignalTimer = null;
    sceneNoticeTimer = null;
    synthesisRequestId += 1;
    activeController?.cancel();
    activeController = null;
    readingTouchStart = null;
    oracleSkyReading = false;
    featuredMeasurePending = false;
    oracleCameraDrift = 0;
    oracleCameraDriftTarget = 0;
    oracleRailDrift = 0;
    oracleSkyGenerationProgress = 0;
    oracleSkyGenerationTarget = 0;
    cardStageMinimumElapsed = false;
    this.setData({
      question: "",
      charCount: 0,
      questionEnergy: 0,
      canSubmit: false,
      isRunning: false,
      phase: "idle",
      isQuestionFocused: false,
      spectrumId: "obsidian",
      runId: "",
      plan: null,
      cards: [],
      cardsVisible: false,
      completedCardCount: 0,
      revealedCount: 0,
      allCardsRevealed: false,
      isHoldingQuestion: false,
      holdInterrupted: false,
      cardSignalId: "",
      cardSignalText: "",
      sceneNotice: "",
      featuredCard: null,
      featuredOriginStyle: "",
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
      synthesisMeta: "",
      isSynthesizing: false,
    });
    setOracleSkyState("obsidian", 0.18, "idle");
    this.animateSpectrumStyle();
    wx.pageScrollTo({ scrollTop: 0, duration: 220 });
  },

  onOpenHistory() {
    wx.navigateTo({ url: "/pages/history/history" });
  },
});
