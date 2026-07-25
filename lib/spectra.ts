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
    primary: "#c8b38e",
    primaryDeep: "#8f754d",
    secondary: "#e9e2d6",
    spark: "#d9c39d",
  },
  lunar: {
    id: "lunar",
    name: "月蚀银蓝",
    void: "#070a0f",
    voidDeep: "#04070b",
    atmosphere: "#101924",
    primary: "#829cb4",
    primaryDeep: "#526b82",
    secondary: "#d7e3e8",
    spark: "#b8d5e4",
  },
  ziwei: {
    id: "ziwei",
    name: "紫微星云",
    void: "#0b0710",
    voidDeep: "#07040a",
    atmosphere: "#1a101f",
    primary: "#92749b",
    primaryDeep: "#644c6c",
    secondary: "#d0a873",
    spark: "#c4a2cb",
  },
  calamity: {
    id: "calamity",
    name: "赤焰灾星",
    void: "#100705",
    voidDeep: "#090302",
    atmosphere: "#24100a",
    primary: "#b65b3a",
    primaryDeep: "#77351f",
    secondary: "#e0b36c",
    spark: "#e98352",
  },
  jade: {
    id: "jade",
    name: "翡翠深空",
    void: "#06100e",
    voidDeep: "#030907",
    atmosphere: "#0d1e1a",
    primary: "#608d81",
    primaryDeep: "#3c6259",
    secondary: "#c6c19e",
    spark: "#86b9aa",
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
