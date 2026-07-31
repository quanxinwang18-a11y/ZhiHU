import { describe, expect, it } from "vitest";
import {
  cardSpectrumStyle,
  fallbackSpectrumFromText,
  historySpectrumStyle,
  spectrumIds,
} from "../apps/miniprogram/domain/visual-spectrum";

describe("miniprogram visual spectrum", () => {
  it("derives three related but distinct card treatments from one question spectrum", () => {
    const styles = [0, 1, 2].map((index) =>
      cardSpectrumStyle("lunar", index),
    );

    expect(new Set(styles).size).toBe(3);
    for (const style of styles) {
      expect(style).toContain("--card-accent:rgb(");
      expect(style).toContain("--card-bright:rgb(");
      expect(style).toContain("--card-deep:rgb(");
      expect(style).toContain("--card-glow:rgba(");
    }
  });

  it("changes the card treatment when the question spectrum changes", () => {
    expect(cardSpectrumStyle("lunar", 1)).not.toBe(
      cardSpectrumStyle("calamity", 1),
    );
  });

  it("maps legacy history deterministically to a valid spectrum", () => {
    const question = "我是否应该继续维护这个个人产品？";
    const first = fallbackSpectrumFromText(question);

    expect(fallbackSpectrumFromText(question)).toBe(first);
    expect(spectrumIds).toContain(first);
  });

  it("emits compatible precomputed history variables without color-mix", () => {
    const style = historySpectrumStyle("jade");

    expect(style).toContain("--history-border:rgba(");
    expect(style).toContain("--history-surface:rgba(");
    expect(style).not.toContain("color-mix");
  });
});
