export type SpectrumId =
  | "obsidian"
  | "lunar"
  | "ziwei"
  | "calamity"
  | "jade";

export type RgbColor = [number, number, number];

export type SkyPalette = {
  void: RgbColor;
  warm: RgbColor;
  atmosphere: RgbColor;
  primary: RgbColor;
  secondary: RgbColor;
  spark: RgbColor;
  primaryHazeAlpha: number;
  secondaryHazeAlpha: number;
};

export const spectrumIds: SpectrumId[] = [
  "obsidian",
  "lunar",
  "ziwei",
  "calamity",
  "jade",
];

export const skyPalettes: Record<SpectrumId, SkyPalette> = {
  obsidian: {
    void: [7, 6, 5],
    warm: [23, 19, 14],
    atmosphere: [28, 22, 14],
    primary: [201, 166, 91],
    secondary: [241, 234, 220],
    spark: [225, 201, 143],
    primaryHazeAlpha: 0.22,
    secondaryHazeAlpha: 0.11,
  },
  lunar: {
    void: [4, 7, 11],
    warm: [16, 25, 36],
    atmosphere: [13, 29, 42],
    primary: [111, 159, 189],
    secondary: [226, 237, 241],
    spark: [183, 217, 233],
    primaryHazeAlpha: 0.24,
    secondaryHazeAlpha: 0.11,
  },
  ziwei: {
    void: [7, 4, 10],
    warm: [26, 16, 31],
    atmosphere: [35, 17, 42],
    primary: [173, 120, 158],
    secondary: [234, 221, 232],
    spark: [216, 167, 202],
    primaryHazeAlpha: 0.25,
    secondaryHazeAlpha: 0.1,
  },
  calamity: {
    void: [9, 3, 2],
    warm: [36, 16, 10],
    atmosphere: [43, 16, 9],
    primary: [198, 106, 66],
    secondary: [240, 223, 213],
    spark: [233, 147, 98],
    primaryHazeAlpha: 0.25,
    secondaryHazeAlpha: 0.1,
  },
  jade: {
    void: [3, 9, 7],
    warm: [13, 30, 26],
    atmosphere: [10, 34, 28],
    primary: [96, 153, 137],
    secondary: [220, 232, 226],
    spark: [142, 193, 178],
    primaryHazeAlpha: 0.24,
    secondaryHazeAlpha: 0.1,
  },
};

export function isSpectrumId(value: unknown): value is SpectrumId {
  return spectrumIds.includes(value as SpectrumId);
}

export function randomSpectrum(exclude: SpectrumId): SpectrumId {
  const candidates = spectrumIds.filter((spectrumId) => spectrumId !== exclude);
  return candidates[Math.floor(Math.random() * candidates.length)] ?? "lunar";
}

export function colorWithAlpha(color: RgbColor, alpha: number) {
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
}

function rgb(color: RgbColor) {
  return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
}

export function mixNumber(from: number, to: number, progress: number) {
  return from + (to - from) * progress;
}

export function mixColor(
  from: RgbColor,
  to: RgbColor,
  progress: number,
): RgbColor {
  return [
    Math.round(mixNumber(from[0], to[0], progress)),
    Math.round(mixNumber(from[1], to[1], progress)),
    Math.round(mixNumber(from[2], to[2], progress)),
  ];
}

export function interpolatePalette(
  from: SkyPalette,
  to: SkyPalette,
  progress: number,
): SkyPalette {
  const eased = progress * progress * (3 - 2 * progress);
  return {
    void: mixColor(from.void, to.void, eased),
    warm: mixColor(from.warm, to.warm, eased),
    atmosphere: mixColor(from.atmosphere, to.atmosphere, eased),
    primary: mixColor(from.primary, to.primary, eased),
    secondary: mixColor(from.secondary, to.secondary, eased),
    spark: mixColor(from.spark, to.spark, eased),
    primaryHazeAlpha: mixNumber(
      from.primaryHazeAlpha,
      to.primaryHazeAlpha,
      eased,
    ),
    secondaryHazeAlpha: mixNumber(
      from.secondaryHazeAlpha,
      to.secondaryHazeAlpha,
      eased,
    ),
  };
}

export function spectrumStyleFromPalette(palette: SkyPalette) {
  return [
    `--void-color:${rgb(palette.void)}`,
    `--void-warm:${rgb(palette.warm)}`,
    `--spectrum-primary:${rgb(palette.primary)}`,
    `--spectrum-bright:${rgb(palette.secondary)}`,
    `--spectrum-spark:${rgb(palette.spark)}`,
    `--spectrum-primary-haze:${colorWithAlpha(
      palette.primary,
      palette.primaryHazeAlpha,
    )}`,
    `--spectrum-secondary-haze:${colorWithAlpha(
      palette.secondary,
      palette.secondaryHazeAlpha,
    )}`,
  ].join(";");
}

function rgbToHsl(color: RgbColor): [number, number, number] {
  const red = color[0] / 255;
  const green = color[1] / 255;
  const blue = color[2] / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;
  if (delta === 0) return [0, 0, lightness];
  const saturation =
    delta / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;
  if (max === red) hue = 60 * (((green - blue) / delta) % 6);
  else if (max === green) hue = 60 * ((blue - red) / delta + 2);
  else hue = 60 * ((red - green) / delta + 4);
  return [(hue + 360) % 360, saturation, lightness];
}

function hslToRgb(hue: number, saturation: number, lightness: number): RgbColor {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const sector = (((hue % 360) + 360) % 360) / 60;
  const x = chroma * (1 - Math.abs((sector % 2) - 1));
  let red = 0;
  let green = 0;
  let blue = 0;
  if (sector < 1) [red, green] = [chroma, x];
  else if (sector < 2) [red, green] = [x, chroma];
  else if (sector < 3) [green, blue] = [chroma, x];
  else if (sector < 4) [green, blue] = [x, chroma];
  else if (sector < 5) [red, blue] = [x, chroma];
  else [red, blue] = [chroma, x];
  const match = lightness - chroma / 2;
  return [red, green, blue].map((channel) =>
    Math.round((channel + match) * 255),
  ) as RgbColor;
}

export function cardSpectrumStyle(spectrumId: SpectrumId, index: number) {
  const palette = skyPalettes[spectrumId];
  const [hue, saturation, lightness] = rgbToHsl(palette.primary);
  const offsets = [-34, 0, 34];
  const lightnessOffsets = [0.025, 0, -0.015];
  const accent = hslToRgb(
    hue + offsets[index % offsets.length],
    Math.max(0.32, Math.min(0.68, saturation * 0.92 + 0.04)),
    Math.max(
      0.42,
      Math.min(0.7, lightness + lightnessOffsets[index % 3]),
    ),
  );
  const bright = mixColor(accent, palette.secondary, 0.76);
  const deep = mixColor(palette.void, accent, 0.14);
  return [
    `--card-accent:${rgb(accent)}`,
    `--card-bright:${rgb(bright)}`,
    `--card-deep:${rgb(deep)}`,
    `--card-glow:${colorWithAlpha(accent, 0.27)}`,
  ].join(";");
}

export function historySpectrumStyle(spectrumId: SpectrumId) {
  const palette = skyPalettes[spectrumId];
  const surface = mixColor([17, 17, 16], palette.warm, 0.68);
  return [
    `--history-void:${rgb(palette.void)}`,
    `--history-warm:${rgb(palette.warm)}`,
    `--history-accent:${rgb(palette.primary)}`,
    `--history-bright:${rgb(palette.secondary)}`,
    `--history-glow:${colorWithAlpha(palette.primary, 0.2)}`,
    `--history-border:${colorWithAlpha(palette.primary, 0.34)}`,
    `--history-surface:${colorWithAlpha(surface, 0.92)}`,
  ].join(";");
}

export function fallbackSpectrumFromText(value: string): SpectrumId {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return spectrumIds[(hash >>> 0) % spectrumIds.length] ?? "obsidian";
}
