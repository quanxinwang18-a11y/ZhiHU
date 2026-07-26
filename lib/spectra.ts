export const SPECTRUM_IDS = [
  "obsidian",
  "lunar",
  "ziwei",
  "calamity",
  "jade",
] as const;

export type SpectrumId = (typeof SPECTRUM_IDS)[number];

export type SpectrumPalette = {
  id: SpectrumId;
  name: string;
  void: string;
  voidDeep: string;
  atmosphere: string;
  primary: string;
  primaryDeep: string;
  secondary: string;
  spark: string;
};

export const SPECTRA: Record<SpectrumId, SpectrumPalette> = {
  obsidian: {
    id: "obsidian",
    name: "黑曜神谕",
    void: "#0a0908",
    voidDeep: "#070605",
    atmosphere: "#17130e",
    primary: "#c9a65b",
    primaryDeep: "#8c6d35",
    secondary: "#f1eadc",
    spark: "#e1c98f",
  },
  lunar: {
    id: "lunar",
    name: "月蚀银蓝",
    void: "#070a0f",
    voidDeep: "#04070b",
    atmosphere: "#101924",
    primary: "#6f9fbd",
    primaryDeep: "#426b85",
    secondary: "#e2edf1",
    spark: "#b7d9e9",
  },
  ziwei: {
    id: "ziwei",
    name: "紫微星云",
    void: "#0b0710",
    voidDeep: "#07040a",
    atmosphere: "#1a101f",
    primary: "#ad789e",
    primaryDeep: "#744c69",
    secondary: "#eadde8",
    spark: "#d8a7ca",
  },
  calamity: {
    id: "calamity",
    name: "赤焰灾星",
    void: "#100705",
    voidDeep: "#090302",
    atmosphere: "#24100a",
    primary: "#c66a42",
    primaryDeep: "#823b24",
    secondary: "#f0dfd5",
    spark: "#e99362",
  },
  jade: {
    id: "jade",
    name: "翡翠深空",
    void: "#06100e",
    voidDeep: "#030907",
    atmosphere: "#0d1e1a",
    primary: "#609989",
    primaryDeep: "#3b685d",
    secondary: "#dce8e2",
    spark: "#8ec1b2",
  },
};

export function normalizeSpectrumId(value?: string | null): SpectrumId {
  return SPECTRUM_IDS.includes(value as SpectrumId)
    ? (value as SpectrumId)
    : "obsidian";
}

export function spectrumFromSeed(seed: string): SpectrumId {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return SPECTRUM_IDS[(hash >>> 0) % SPECTRUM_IDS.length];
}
