"use client";

import { Sparkles } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Bloom,
  EffectComposer,
  Noise,
  Vignette,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

export type OraclePhase =
  | "auth"
  | "question"
  | "summoning"
  | "sealed"
  | "reading";

const phaseValue: Record<OraclePhase, number> = {
  auth: 0,
  question: 0.28,
  summoning: 0.62,
  sealed: 0.9,
  reading: 1.18,
};

const vertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = `
  precision highp float;

  uniform float uTime;
  uniform float uAspect;
  uniform float uPhase;
  uniform float uEnergy;
  uniform vec2 uPointer;
  varying vec2 vUv;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0)), f.x),
      f.y
    );
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    mat2 rotation = mat2(0.8, -0.6, 0.6, 0.8);
    for (int i = 0; i < 5; i++) {
      value += amplitude * valueNoise(p);
      p = rotation * p * 2.03 + 7.17;
      amplitude *= 0.48;
    }
    return value;
  }

  float band(float value, float width) {
    return 1.0 - smoothstep(0.0, width, abs(value));
  }

  void main() {
    vec2 uv = vUv;
    vec2 p = uv - 0.5;
    p.x *= uAspect;

    float authBlend = 1.0 - smoothstep(0.08, 0.34, uPhase);
    vec2 center = mix(vec2(-0.25 * uAspect, 0.035), vec2(0.0, 0.045), 1.0 - authBlend);
    vec2 pointer = (uPointer - 0.5) * vec2(uAspect, 1.0);
    center += pointer * vec2(0.026, 0.018);

    vec2 q = p - center;
    float radius = length(q);
    float angle = atan(q.y, q.x);
    float safeRadius = max(radius, 0.035);
    float time = uTime * (0.055 + uEnergy * 0.075);

    float pull = smoothstep(0.95, 0.12, radius);
    vec2 warped = q;
    warped += normalize(q + 0.0001) * sin(angle * 3.0 - time * 1.7) * 0.012 * pull;
    warped += (pointer - p) * 0.012 * smoothstep(0.8, 0.0, length(pointer - p));

    float spiralA = sin(angle * 5.0 - time * 2.1 + 2.25 / safeRadius);
    float spiralB = sin(angle * 9.0 + time * 1.25 + 3.6 / (safeRadius + 0.08));
    float atmosphere = fbm(warped * 2.1 + vec2(time * 0.3, -time * 0.2));
    float filament = band(spiralA + (atmosphere - 0.5) * 0.72, 0.115);
    filament += band(spiralB + (atmosphere - 0.5) * 0.5, 0.09) * 0.38;
    filament *= smoothstep(0.08, 0.2, radius) * (1.0 - smoothstep(0.38, 1.05, radius));

    float horizon = band(radius - (0.205 + sin(angle * 2.0 + time) * 0.003), 0.01);
    float echoRing = band(radius - (0.32 + sin(angle * 4.0 - time) * 0.009), 0.025);
    float farRing = band(radius - (0.52 + sin(angle * 7.0 + time * 0.7) * 0.015), 0.045);
    float lens = pow(max(0.0, 1.0 - abs(radius - 0.24) / 0.22), 4.0);

    float current = filament * (0.11 + 0.2 * uEnergy);
    current += horizon * (0.52 + uEnergy * 0.35);
    current += echoRing * (0.055 + uPhase * 0.025);
    current += farRing * 0.018;
    current += lens * 0.045;

    vec3 ink = vec3(0.026, 0.023, 0.019);
    vec3 warmInk = vec3(0.075, 0.061, 0.044);
    vec3 champagne = vec3(0.78, 0.67, 0.51);
    vec3 bone = vec3(0.91, 0.87, 0.79);
    vec3 color = mix(ink, warmInk, atmosphere * 0.38 + lens * 0.22);
    color += mix(champagne, bone, horizon * 0.65) * current;

    float voidCore = 1.0 - smoothstep(0.105, 0.205, radius);
    color *= 1.0 - voidCore * 0.93;

    float readingVeil = smoothstep(1.0, 1.18, uPhase);
    color = mix(color, color * 0.42 + vec3(0.016, 0.014, 0.012), readingVeil * 0.74);

    float vignette = smoothstep(1.12, 0.18, length(p * vec2(0.76, 1.0)));
    color *= 0.5 + vignette * 0.5;

    float grain = hash21(gl_FragCoord.xy + fract(uTime) * 31.7) - 0.5;
    color += grain * 0.012;
    color += vec3(0.012, 0.009, 0.005) * smoothstep(0.8, 0.15, radius);

    gl_FragColor = vec4(color, 1.0);
  }
`;

function EventHorizon({
  phase,
  energy,
  staticMode,
}: {
  phase: OraclePhase;
  energy: number;
  staticMode: boolean;
}) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const pointerTarget = useRef(new THREE.Vector2(0.5, 0.5));
  const pointerCurrent = useRef(new THREE.Vector2(0.5, 0.5));
  const elapsed = useRef(0);
  const { size } = useThree();
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uPhase: { value: 0 },
      uEnergy: { value: 0 },
      uPointer: { value: new THREE.Vector2(0.5, 0.5) },
    }),
    [],
  );

  useEffect(() => {
    if (staticMode) return;
    function trackPointer(event: PointerEvent) {
      pointerTarget.current.set(
        event.clientX / window.innerWidth,
        1 - event.clientY / window.innerHeight,
      );
    }
    window.addEventListener("pointermove", trackPointer, { passive: true });
    return () => window.removeEventListener("pointermove", trackPointer);
  }, [staticMode]);

  useFrame((_, delta) => {
    if (!material.current) return;
    if (!staticMode) {
      elapsed.current += Math.min(delta, 0.05);
      pointerCurrent.current.lerp(pointerTarget.current, 0.035);
    }
    const nextPhase = phaseValue[phase];
    material.current.uniforms.uTime.value = elapsed.current;
    material.current.uniforms.uAspect.value = size.width / size.height;
    material.current.uniforms.uPhase.value = THREE.MathUtils.lerp(
      material.current.uniforms.uPhase.value,
      nextPhase,
      staticMode ? 1 : 0.04,
    );
    material.current.uniforms.uEnergy.value = THREE.MathUtils.lerp(
      material.current.uniforms.uEnergy.value,
      energy,
      staticMode ? 1 : 0.045,
    );
    material.current.uniforms.uPointer.value.copy(pointerCurrent.current);
  });

  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={material}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

export function OracleAtmosphere({
  phase = "question",
  energy = 0,
}: {
  phase?: OraclePhase;
  energy?: number;
}) {
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div className="oracle-atmosphere" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 1], fov: 50 }}
        dpr={reducedMotion ? 1 : [1, 1.7]}
        frameloop={reducedMotion ? "demand" : "always"}
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: "high-performance",
        }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 0.92;
        }}
      >
        <EventHorizon
          phase={phase}
          energy={Math.min(1, Math.max(0, energy))}
          staticMode={reducedMotion}
        />
        {!reducedMotion && (
          <Sparkles
            count={phase === "summoning" ? 96 : 58}
            scale={[7, 4, 2]}
            size={0.85}
            speed={phase === "summoning" ? 0.14 : 0.055}
            color="#c8b38e"
            opacity={phase === "reading" ? 0.08 : 0.18}
          />
        )}
        <EffectComposer multisampling={0}>
          <Bloom
            mipmapBlur
            intensity={phase === "summoning" ? 0.85 : 0.52}
            luminanceThreshold={0.18}
            luminanceSmoothing={0.72}
          />
          <Noise
            premultiply
            opacity={0.018}
            blendFunction={BlendFunction.SOFT_LIGHT}
          />
          <Vignette eskil={false} offset={0.18} darkness={0.72} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
