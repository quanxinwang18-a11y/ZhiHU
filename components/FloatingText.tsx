"use client";

import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";
import { useLayoutEffect, useRef } from "react";

type FloatingTextMode = "tidal" | "identity" | "verdict";

export function FloatingText({
  text,
  mode,
}: {
  text: string;
  mode: FloatingTextMode;
}) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const bodyRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const body = bodyRef.current;
    if (!root || !body) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reducedMotion) return;

    let cancelled = false;
    let split: SplitText | undefined;
    let context: gsap.Context | undefined;
    let removePointerTracking: (() => void) | undefined;

    async function animate() {
      await document.fonts.ready;
      const currentRoot = rootRef.current;
      const currentBody = bodyRef.current;
      if (cancelled || !currentRoot || !currentBody) return;

      if (mode === "verdict") {
        context = gsap.context(() => {
          gsap.fromTo(
            currentBody,
            {
              autoAlpha: 0,
              y: 18,
              filter: "blur(10px)",
            },
            {
              autoAlpha: 1,
              y: 0,
              filter: "blur(0px)",
              duration: 1.35,
              ease: "power3.out",
            },
          );
          gsap.to(currentBody, {
            y: -1.5,
            duration: 7.2,
            delay: 1.35,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
          });
        }, currentRoot);
        return;
      }

      gsap.registerPlugin(SplitText);
      context = gsap.context(() => {
        split = SplitText.create(currentBody, {
          type: "chars",
          charsClass: "floating-glyph",
          tag: "span",
          aria: "auto",
        });

        const glyphs = split.chars;
        const entrance =
          mode === "identity"
            ? { y: 14, z: -42, blur: 8, stagger: 0.07, duration: 1.25 }
            : { y: 18, z: -58, blur: 9, stagger: 0.055, duration: 1.45 };

        gsap.fromTo(
          glyphs,
          {
            autoAlpha: 0,
            y: entrance.y,
            z: entrance.z,
            filter: `blur(${entrance.blur}px)`,
          },
          {
            autoAlpha: 1,
            y: 0,
            z: 0,
            filter: "blur(0px)",
            duration: entrance.duration,
            stagger: entrance.stagger,
            ease: "power3.out",
            clearProps: "visibility",
          },
        );

        glyphs.forEach((glyph, index) => {
          const direction = index % 2 === 0 ? 1 : -1;
          const verticalAmplitude =
            mode === "identity"
              ? 1.6 + (index % 3) * 0.65
              : 2.4 + (index % 5) * 0.65;

          gsap.to(glyph, {
            x: direction * (0.35 + (index % 3) * 0.35),
            y: direction * verticalAmplitude,
            z: mode === "tidal" ? (index % 4) * 1.4 : (index % 3) * 0.8,
            duration: 6.8 + (index % 6) * 0.9,
            delay:
              entrance.duration +
              index * entrance.stagger +
              (index % 4) * 0.18,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
          });
        });

        if (mode === "tidal") {
          const moveX = gsap.quickTo(currentRoot, "x", {
            duration: 1.4,
            ease: "power3.out",
          });
          const moveY = gsap.quickTo(currentRoot, "y", {
            duration: 1.4,
            ease: "power3.out",
          });
          const onPointerMove = (event: PointerEvent) => {
            moveX((event.clientX / window.innerWidth - 0.5) * 6);
            moveY((event.clientY / window.innerHeight - 0.5) * 4);
          };
          window.addEventListener("pointermove", onPointerMove, {
            passive: true,
          });
          removePointerTracking = () =>
            window.removeEventListener("pointermove", onPointerMove);
        }
      }, currentRoot);
    }

    void animate();

    return () => {
      cancelled = true;
      removePointerTracking?.();
      context?.revert();
      split?.revert();
    };
  }, [mode, text]);

  return (
    <span
      className={`floating-text floating-text--${mode}`}
      ref={rootRef}
    >
      <span className="floating-text__body" ref={bodyRef}>
        {text}
      </span>
    </span>
  );
}
