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
import { SPECTRA, type SpectrumPalette } from "@/lib/spectra";

export type OraclePhase =
  | "auth"
  | "question"
  | "summoning"
  | "sealed"
  | "reading"
  | "dissolving";

const phaseValue: Record<OraclePhase, number> = {
  auth: 0,
  question: 0.28,
  summoning: 0.62,
  sealed: 0.9,
  reading: 1.18,
  dissolving: 1.48,
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
  uniform vec3 uVoidColor;
  uniform vec3 uAtmosphereColor;
  uniform vec3 uPrimaryColor;
  uniform vec3 uSecondaryColor;
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
    float vortexDrive = smoothstep(0.46, 0.6, uPhase) *
      (1.0 - smoothstep(0.72, 0.9, uPhase));
    float time = uTime * (0.045 + uEnergy * 0.055 + vortexDrive * 0.34);

    float pull = smoothstep(0.95, 0.12, radius);
    vec2 warped = q;
    warped += normalize(q + 0.0001) * sin(angle * 2.0 - time * 0.7) * 0.009 * pull;
    warped += (pointer - p) * 0.012 * smoothstep(0.8, 0.0, length(pointer - p));

    float cloudA = fbm(warped * 1.7 + vec2(time * 0.16, -time * 0.1));
    float cloudB = fbm(
      warped * 3.6 +
      vec2(-time * 0.08, time * 0.055) +
      vec2(cloudA * 0.42, -cloudA * 0.28)
    );
    float atmosphere = cloudA * 0.68 + cloudB * 0.32;
    float nebula = pow(max(0.0, atmosphere - 0.34), 1.8);
    nebula *= smoothstep(1.12, 0.16, radius);

    float diskTilt = -0.44;
    mat2 diskRotation = mat2(
      cos(diskTilt), -sin(diskTilt),
      sin(diskTilt), cos(diskTilt)
    );
    vec2 disk = diskRotation * q;
    disk.y *= 2.7;
    float diskRadius = length(disk);
    float diskNoise = fbm(vec2(
      angle * 1.15 - time * 0.11,
      diskRadius * 7.4 + time * 0.08
    ));
    float diskWidth = 0.022 + diskNoise * 0.032 + vortexDrive * 0.012;
    float accretion = exp(
      -pow(abs(diskRadius - 0.315) / diskWidth, 1.35)
    );
    accretion *= smoothstep(0.12, 0.23, diskRadius) *
      (1.0 - smoothstep(0.48, 0.72, diskRadius));
    float nearSide = smoothstep(-0.2, 0.22, disk.y);
    float dustBreaks = smoothstep(
      0.22,
      0.84,
      fbm(disk * 7.2 + vec2(time * 0.25, -time * 0.16))
    );
    accretion *= 0.38 + dustBreaks * 0.92;

    float revelation = smoothstep(0.34, 0.62, uPhase) *
      (1.0 - smoothstep(1.2, 1.48, uPhase));
    revelation = max(
      revelation,
      uEnergy * (1.0 - smoothstep(0.34, 0.5, uPhase)) * 0.28
    );
    float rayA = pow(max(0.0, cos(angle - 1.36)), 24.0);
    float rayB = pow(max(0.0, cos(angle - 1.82)), 36.0) * 0.64;
    float rayC = pow(max(0.0, cos(angle + 1.17)), 42.0) * 0.35;
    float rayD = pow(max(0.0, cos(angle + 2.44)), 54.0) * 0.2;
    float rayNoise = 0.28 + 0.72 * fbm(
      q * vec2(4.2, 1.8) + vec2(time * 0.045, -time * 0.08)
    );
    float sacredRays = (rayA + rayB + rayC + rayD) * rayNoise;
    sacredRays *= smoothstep(0.18, 0.31, radius) *
      (1.0 - smoothstep(0.62, 1.28, radius)) * revelation;

    float horizon = band(radius - (0.205 + sin(angle * 2.0 + time) * 0.002), 0.009);
    float lens = pow(max(0.0, 1.0 - abs(radius - 0.24) / 0.22), 4.0);

    float accretionCurrent = accretion * (
      0.08 + 0.12 * uEnergy + vortexDrive * 0.15
    );
    float nebulaCurrent = nebula * (0.032 + uEnergy * 0.018);
    float horizonCurrent = horizon * (0.52 + uEnergy * 0.35);
    float lensCurrent = lens * 0.045;

    float spectrumOrbit = angle - uTime * mix(0.05, 0.38, vortexDrive) +
      atmosphere * 0.24;
    float spectrumBlend = smoothstep(
      -0.62,
      0.72,
      cos(spectrumOrbit)
    );
    float spectralCrest = pow(
      max(0.0, cos(spectrumOrbit - 0.24)),
      7.0
    );
    vec3 horizonColor = mix(
      uPrimaryColor,
      uSecondaryColor,
      spectrumBlend
    );
    float horizonHalo = exp(
      -abs(radius - 0.205) * 46.0
    ) * (0.045 + uEnergy * 0.035);

    vec3 color = mix(
      uVoidColor,
      uAtmosphereColor,
      atmosphere * 0.3 + nebula * 0.16 + lens * 0.2
    );
    color += mix(uPrimaryColor, uSecondaryColor, nearSide) *
      accretionCurrent;
    color += uPrimaryColor * (nebulaCurrent + lensCurrent);
    color += uSecondaryColor * sacredRays * (0.055 + revelation * 0.12);
    color += horizonColor * (horizonCurrent + horizonHalo);
    color += uSecondaryColor * horizon * spectralCrest * 0.16;

    float voidCore = 1.0 - smoothstep(0.105, 0.205, radius);
    color *= 1.0 - voidCore * 0.93;

    float readingVeil = smoothstep(1.0, 1.18, uPhase);
    color = mix(color, color * 0.42 + vec3(0.016, 0.014, 0.012), readingVeil * 0.74);

    float dissolvePhase = smoothstep(1.22, 1.46, uPhase);
    float dissolvePulse = 0.5 + 0.5 * sin(uTime * 9.2 + angle * 8.0);
    float particleField = pow(valueNoise(p * 28.0 + vec2(-uTime * 1.8, 0.0)), 9.0);
    float fractureHalo = exp(-abs(radius - (0.235 + dissolvePulse * 0.018)) * 22.0);
    color += dissolvePhase * (
      uSecondaryColor * fractureHalo * 0.14 +
      uPrimaryColor * particleField * 0.24
    );
    color = mix(
      color,
      uVoidColor * 0.76 + color * 0.5,
      dissolvePhase * 0.45
    );

    float vignette = smoothstep(1.12, 0.18, length(p * vec2(0.76, 1.0)));
    color *= 0.5 + vignette * 0.5;

    float grain = hash21(gl_FragCoord.xy + fract(uTime) * 31.7) - 0.5;
    color += grain * 0.012;
    color += uPrimaryColor * 0.018 * smoothstep(0.8, 0.15, radius);

    gl_FragColor = vec4(color, 1.0);
  }
`;

function EventHorizon({
  phase,
  energy,
  staticMode,
  palette,
}: {
  phase: OraclePhase;
  energy: number;
  staticMode: boolean;
  palette: SpectrumPalette;
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
      uVoidColor: { value: new THREE.Color(palette.void) },
      uAtmosphereColor: { value: new THREE.Color(palette.atmosphere) },
      uPrimaryColor: { value: new THREE.Color(palette.primary) },
      uSecondaryColor: { value: new THREE.Color(palette.secondary) },
    }),
    // Uniform objects must remain stable; target colors are interpolated below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const paletteTarget = useMemo(
    () => ({
      void: new THREE.Color(palette.void),
      atmosphere: new THREE.Color(palette.atmosphere),
      primary: new THREE.Color(palette.primary),
      secondary: new THREE.Color(palette.secondary),
    }),
    [palette],
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
    const colorEase = staticMode ? 1 : 0.022;
    material.current.uniforms.uVoidColor.value.lerp(
      paletteTarget.void,
      colorEase,
    );
    material.current.uniforms.uAtmosphereColor.value.lerp(
      paletteTarget.atmosphere,
      colorEase,
    );
    material.current.uniforms.uPrimaryColor.value.lerp(
      paletteTarget.primary,
      colorEase,
    );
    material.current.uniforms.uSecondaryColor.value.lerp(
      paletteTarget.secondary,
      colorEase,
    );
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

function CosmicDepth({
  phase,
  palette,
}: {
  phase: OraclePhase;
  palette: SpectrumPalette;
}) {
  const far = useRef<THREE.Group>(null);
  const middle = useRef<THREE.Group>(null);
  const near = useRef<THREE.Group>(null);

  useFrame(({ pointer, clock }, delta) => {
    const ease = 1 - Math.exp(-delta * 1.8);
    const breath = Math.sin(clock.elapsedTime * 0.16) * 0.012;

    if (far.current) {
      far.current.position.x = THREE.MathUtils.lerp(
        far.current.position.x,
        pointer.x * 0.028,
        ease,
      );
      far.current.position.y = THREE.MathUtils.lerp(
        far.current.position.y,
        pointer.y * 0.018,
        ease,
      );
    }
    if (middle.current) {
      middle.current.position.x = THREE.MathUtils.lerp(
        middle.current.position.x,
        pointer.x * 0.075,
        ease,
      );
      middle.current.position.y = THREE.MathUtils.lerp(
        middle.current.position.y,
        pointer.y * 0.05 + breath,
        ease,
      );
    }
    if (near.current) {
      near.current.position.x = THREE.MathUtils.lerp(
        near.current.position.x,
        pointer.x * 0.16,
        ease,
      );
      near.current.position.y = THREE.MathUtils.lerp(
        near.current.position.y,
        pointer.y * 0.11 - breath,
        ease,
      );
    }
  });

  const isCalling = phase === "summoning";
  const isReading = phase === "reading";
  const isDissolving = phase === "dissolving";

  return (
    <>
      <group ref={far} position={[0, 0, -1.9]}>
        <Sparkles
          count={72}
          scale={[8.5, 4.8, 2.5]}
          size={0.42}
          speed={0.012}
          color={palette.spark}
          opacity={isReading ? 0.045 : 0.11}
        />
      </group>
      <group ref={middle} position={[0, 0, -0.75]}>
        <Sparkles
          count={isDissolving ? 118 : isCalling ? 82 : 54}
          scale={[7.2, 3.8, 1.5]}
          size={0.9}
          speed={isDissolving ? 0.24 : isCalling ? 0.09 : 0.035}
          color={palette.primary}
          opacity={isDissolving ? 0.28 : isReading ? 0.035 : 0.12}
        />
      </group>
      <group ref={near} position={[0, 0, 0.42]}>
        <Sparkles
          count={isDissolving ? 44 : 18}
          scale={[6.2, 3.2, 0.75]}
          size={isDissolving ? 3.4 : 2.65}
          speed={isDissolving ? 0.38 : 0.018}
          color={palette.secondary}
          opacity={isDissolving ? 0.2 : isReading ? 0.018 : 0.045}
        />
      </group>
    </>
  );
}

function HiddenConstellation({
  phase,
  energy,
  palette,
}: {
  phase: OraclePhase;
  energy: number;
  palette: SpectrumPalette;
}) {
  const group = useRef<THREE.Group>(null);
  const nodes = useRef<THREE.PointsMaterial>(null);
  const nodeGlow = useRef<THREE.PointsMaterial>(null);
  const links = useRef<THREE.LineBasicMaterial>(null);
  const visibility = useRef(0);
  const paletteTarget = useMemo(
    () => new THREE.Color(palette.secondary),
    [palette.secondary],
  );
  const nodePositions = useMemo(
    () =>
      new Float32Array([
        -0.82, 0.22, 0.02,
        -0.58, 0.48, -0.04,
        -0.28, 0.36, 0.04,
        -0.08, 0.61, -0.02,
        0.27, 0.43, 0.03,
        0.66, 0.15, -0.03,
        0.48, -0.28, 0.02,
        0.14, -0.53, -0.04,
        -0.34, -0.42, 0.03,
      ]),
    [],
  );
  const linkPositions = useMemo(() => {
    const linksByIndex = [
      [0, 1],
      [1, 2],
      [2, 3],
      [2, 4],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 8],
    ];
    const values: number[] = [];
    linksByIndex.forEach(([from, to]) => {
      values.push(
        nodePositions[from * 3],
        nodePositions[from * 3 + 1],
        nodePositions[from * 3 + 2],
        nodePositions[to * 3],
        nodePositions[to * 3 + 1],
        nodePositions[to * 3 + 2],
      );
    });
    return new Float32Array(values);
  }, [nodePositions]);

  useFrame(({ pointer, clock }, delta) => {
    const target =
      phase === "summoning"
        ? 0.34
        : phase === "question"
          ? 0.055 + energy * 0.2
          : phase === "sealed"
            ? 0.11
            : 0;
    visibility.current = THREE.MathUtils.lerp(
      visibility.current,
      target,
      1 - Math.exp(-delta * 1.45),
    );

    if (nodes.current) {
      nodes.current.opacity = visibility.current;
      nodes.current.color.lerp(paletteTarget, 0.025);
    }
    if (nodeGlow.current) {
      nodeGlow.current.opacity = visibility.current * 0.22;
      nodeGlow.current.color.lerp(paletteTarget, 0.025);
    }
    if (links.current) {
      links.current.opacity = visibility.current * 0.34;
      links.current.color.lerp(paletteTarget, 0.025);
    }
    if (group.current) {
      const ease = 1 - Math.exp(-delta * 1.25);
      group.current.position.x = THREE.MathUtils.lerp(
        group.current.position.x,
        pointer.x * 0.055,
        ease,
      );
      group.current.position.y = THREE.MathUtils.lerp(
        group.current.position.y,
        pointer.y * 0.038 + Math.sin(clock.elapsedTime * 0.22) * 0.008,
        ease,
      );
      const pulse = 1 + Math.sin(clock.elapsedTime * 0.42) * 0.006;
      group.current.scale.setScalar(pulse);
    }
  });

  return (
    <group ref={group} position={[0, 0, -0.38]}>
      <lineSegments renderOrder={2}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[linkPositions, 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial
          ref={links}
          color={palette.secondary}
          transparent
          opacity={0}
          depthTest={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </lineSegments>
      <points renderOrder={3}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[nodePositions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          ref={nodeGlow}
          color={palette.secondary}
          size={0.058}
          sizeAttenuation
          transparent
          opacity={0}
          depthTest={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>
      <points renderOrder={4}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[nodePositions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          ref={nodes}
          color={palette.secondary}
          size={0.016}
          sizeAttenuation
          transparent
          opacity={0}
          depthTest={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>
    </group>
  );
}

export function OracleAtmosphere({
  phase = "question",
  energy = 0,
  palette = SPECTRA.obsidian,
}: {
  phase?: OraclePhase;
  energy?: number;
  palette?: SpectrumPalette;
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
          palette={palette}
        />
        {!reducedMotion && (
          <>
            <CosmicDepth phase={phase} palette={palette} />
            <HiddenConstellation
              phase={phase}
              energy={Math.min(1, Math.max(0, energy))}
              palette={palette}
            />
          </>
        )}
        <EffectComposer multisampling={0}>
          <Bloom
            mipmapBlur
            intensity={phase === "dissolving" ? 1.08 : phase === "summoning" ? 0.85 : 0.52}
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
