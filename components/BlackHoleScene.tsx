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
    float spiral = sin(a * 4.0 - uTime * .16 + 8.0 / (r + .18));
    float fineSpiral = sin(a * 9.0 + uTime * .09 + 14.0 / (r + .2));
    float primaryRing = 1.0 - smoothstep(.008, .046, abs(r - .31 + spiral * .008));
    float secondaryRing = 1.0 - smoothstep(.012, .06, abs(r - .365 + fineSpiral * .006));
    float innerFeather = smoothstep(.12, .22, r) * (1.0 - smoothstep(.22, .48, r));
    float outerFeather = smoothstep(.28, .36, r) * (1.0 - smoothstep(.38, .54, r));
    float grit = noise(vUv * 210. + uTime * .008);
    vec3 champagne = vec3(.72, .64, .50);
    vec3 bone = vec3(.88, .84, .76);
    vec3 color = mix(champagne, bone, .18 + fineSpiral * .035);
    float alpha = primaryRing * .16 + secondaryRing * .065;
    alpha += innerFeather * .026 + outerFeather * .012 + grit * .003;
    alpha *= (1.0 + uPull * .28) * (1.0 - smoothstep(.49, .59, r));
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
      ring.current.rotation.z += delta * (active ? 0.07 : 0.012);
      const s = 1 + Math.sin(state.clock.elapsedTime * 0.42) * 0.012;
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
        <meshBasicMaterial color="#070605" />
      </mesh>
      <Float speed={0.34} rotationIntensity={0.025} floatIntensity={0.08}>
        <mesh position={[0, 0, 0.12]}>
          <ringGeometry args={[0.716, 0.726, 128]} />
          <meshBasicMaterial color="#c8b38e" transparent opacity={0.48} />
        </mesh>
      </Float>
      <Float speed={0.22} rotationIntensity={0.015} floatIntensity={0.05}>
        <mesh position={[0, 0, 0.1]}>
          <ringGeometry args={[0.732, 0.756, 128]} />
          <meshBasicMaterial color="#8f754d" transparent opacity={0.18} />
        </mesh>
      </Float>
    </group>
  );
}

export function BlackHoleScene({ active = false }: { active?: boolean }) {
  return (
    <div className="black-hole-canvas" aria-hidden="true">
      <Canvas camera={{ position: [0, 0, 5], fov: 42 }} dpr={[1, 1.6]}>
        <color attach="background" args={["#0a0908"]} />
        <Vortex active={active} />
        <Sparkles
          count={active ? 78 : 38}
          scale={[6, 4, 1]}
          size={1.1}
          speed={0.08}
          color="#c8b38e"
          opacity={0.22}
        />
      </Canvas>
    </div>
  );
}
