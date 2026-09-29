"use client";

import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface DustParticlesProps {
  count?: number;
}

export function DustParticles({ count = 350 }: DustParticlesProps) {
  const pointsRef = useRef<THREE.Points>(null);

  // Generate random initial positions and gentle drift velocities
  const [positions, velocities] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      // Spread across stage: X [-4, 4], Y [0, 3.5], Z [-2, 4.5]
      pos[i * 3] = (Math.random() - 0.5) * 8;
      pos[i * 3 + 1] = Math.random() * 3.5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 6;

      // Gentle floating speeds
      vel[i * 3] = (Math.random() - 0.5) * 0.0015;
      vel[i * 3 + 1] = 0.0008 + Math.random() * 0.0012;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.0015;
    }

    return [pos, vel];
  }, [count]);

  useFrame(() => {
    if (!pointsRef.current) return;
    const positionAttribute = pointsRef.current.geometry.attributes.position;
    const array = positionAttribute.array as Float32Array;

    for (let i = 0; i < count; i++) {
      array[i * 3] += velocities[i * 3];
      array[i * 3 + 1] += velocities[i * 3 + 1];
      array[i * 3 + 2] += velocities[i * 3 + 2];

      // Recycle particles that drift above the top
      if (array[i * 3 + 1] > 3.6) {
        array[i * 3 + 1] = -0.2;
        array[i * 3] = (Math.random() - 0.5) * 8;
      }
    }

    positionAttribute.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.032}
        color="#F5F1E8"
        transparent
        opacity={0.35}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}
