"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Sparkles } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform float uPull;
  varying vec2 vUv;
  float noise(vec2 p) {
    return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123);
  }
  void main() {
    vec2 p = vUv - .5;
    float r = length(p);
    float a = atan(p.y, p.x);
    float spiral = sin(a * 5.0 - uTime * .35 + 9.0 / (r + .15));
    float ring = 1.0 - smoothstep(.018, .085, abs(r - .31 + spiral * .012));
    float halo = (1.0 - smoothstep(.18, .49, r)) * smoothstep(.08, .24, r);
    float grit = noise(vUv * 180. + uTime * .02);
    vec3 gold = vec3(.68, .48, .20);
    vec3 bone = vec3(.91, .86, .76);
    vec3 color = mix(gold, bone, .28 + spiral * .1);
    float alpha = (ring * .28 + halo * .035 + grit * .006) * (1. + uPull * .32);
    alpha *= 1.0 - smoothstep(.46, .58, r);
    gl_FragColor = vec4(color, alpha);
  }
`;

function Vortex({ active }: { active: boolean }) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const ring = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uPull: { value: 0 } }),
    [],
  );
  useFrame((state, delta) => {
    if (material.current) {
      material.current.uniforms.uTime.value += delta;
      material.current.uniforms.uPull.value = THREE.MathUtils.lerp(
        material.current.uniforms.uPull.value,
        active ? 1 : 0,
        0.035,
      );
    }
    if (ring.current) {
      ring.current.rotation.z += delta * (active ? 0.16 : 0.035);
      const s = 1 + Math.sin(state.clock.elapsedTime * 0.55) * 0.018;
      ring.current.scale.setScalar(s);
    }
  });
  return (
    <group>
      <mesh ref={ring}>
        <planeGeometry args={[7.2, 7.2, 1, 1]} />
        <shaderMaterial
          ref={material}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh position={[0, 0, 0.08]}>
        <circleGeometry args={[0.7, 96]} />
        <meshBasicMaterial color="#000" />
      </mesh>
      <Float speed={0.45} rotationIntensity={0.08} floatIntensity={0.14}>
        <mesh position={[0, 0, 0.12]}>
          <ringGeometry args={[0.72, 0.735, 128]} />
          <meshBasicMaterial color="#caa45e" transparent opacity={0.85} />
        </mesh>
      </Float>
    </group>
  );
}

export function BlackHoleScene({ active = false }: { active?: boolean }) {
  return (
    <div className="black-hole-canvas" aria-hidden="true">
      <Canvas camera={{ position: [0, 0, 5], fov: 42 }} dpr={[1, 1.6]}>
        <color attach="background" args={["#050505"]} />
        <Vortex active={active} />
        <Sparkles
          count={active ? 95 : 48}
          scale={[6, 4, 1]}
          size={1.4}
          speed={0.12}
          color="#c6a15c"
          opacity={0.34}
        />
      </Canvas>
    </div>
  );
}
