import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Points, PointMaterial } from "@react-three/drei";
import * as THREE from "three";

function ParticleConstellation({ mouseRef }: { mouseRef: React.MutableRefObject<{ x: number; y: number }> }) {
  const pointsRef = useRef<THREE.Points>(null);

  const [positions, colors] = useMemo(() => {
    const count = 900;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 3.2 + Math.random() * 5.5;

      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.72;
      pos[i * 3 + 2] = r * Math.cos(phi) * 0.85;

      // Color variation between champagne (#e5d9c5) and warm gold (#c9a84c)
      const isGold = Math.random() > 0.45;
      col[i * 3] = isGold ? 0.79 : 0.90;
      col[i * 3 + 1] = isGold ? 0.66 : 0.85;
      col[i * 3 + 2] = isGold ? 0.30 : 0.77;
    }
    return [pos, col];
  }, []);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    const elapsed = clock.getElapsedTime();
    pointsRef.current.rotation.y = elapsed * 0.035 + mouseRef.current.x * 0.09;
    pointsRef.current.rotation.x = Math.sin(elapsed * 0.02) * 0.05 + mouseRef.current.y * 0.07;
  });

  return (
    <Points ref={pointsRef} positions={positions} colors={colors} stride={3}>
      <PointMaterial
        vertexColors
        size={0.022}
        sizeAttenuation
        transparent
        opacity={0.6}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </Points>
  );
}

export default function ParticleBackground({ mouseRef }: { mouseRef: React.MutableRefObject<{ x: number; y: number }> }) {
  return (
    <div className="w-full h-full pointer-events-none animate-in fade-in duration-1000">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 60 }}
        dpr={[1, 1.5]}
        gl={{
          antialias: false,
          alpha: true,
          powerPreference: "high-performance",
          depth: false,
          stencil: false,
        }}
        className="w-full h-full pointer-events-none"
      >
        <ParticleConstellation mouseRef={mouseRef} />
      </Canvas>
    </div>
  );
}
