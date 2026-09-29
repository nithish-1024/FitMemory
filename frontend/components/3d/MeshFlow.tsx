"use client";

import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export function MeshFlow() {
  const meshRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const particlesRef = useRef<THREE.Points>(null);

  // High-resolution subdivided plane for organic cloth wave deformation
  const [geometry, originalPositions] = useMemo(() => {
    const geo = new THREE.PlaneGeometry(13, 7.5, 72, 54);
    const pos = geo.attributes.position;
    const orig = new Float32Array(pos.array.length);
    orig.set(pos.array);
    return [geo, orig];
  }, []);

  // Soft glowing stardust motes floating around the liquid satin
  const [particlePositions, particleSpeeds] = useMemo(() => {
    const count = 140;
    const pos = new Float32Array(count * 3);
    const spd = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 12;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 6;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 3.5;

      spd[i * 3] = 0.0015 + Math.random() * 0.003;
      spd[i * 3 + 1] = (Math.random() - 0.5) * 0.0015;
      spd[i * 3 + 2] = (Math.random() - 0.5) * 0.0015;
    }
    return [pos, spd];
  }, []);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();

    // 1. Organic Heavy Silk & Satin Wave Undulation
    if (meshRef.current) {
      const posAttr = meshRef.current.geometry.attributes.position;
      const arr = posAttr.array as Float32Array;

      for (let i = 0; i < arr.length; i += 3) {
        const ox = originalPositions[i];
        const oy = originalPositions[i + 1];

        // Smooth, heavy liquid fabric displacement math
        const wave1 = Math.sin(ox * 0.42 + t * 0.65) * 0.52;
        const wave2 = Math.cos(oy * 0.52 + t * 0.55) * 0.42;
        const wave3 = Math.sin((ox * 0.35 + oy * 0.4) + t * 0.75) * 0.32;
        const wave4 = Math.cos(Math.hypot(ox * 0.35, oy * 0.45) - t * 0.8) * 0.22;

        arr[i + 2] = wave1 + wave2 + wave3 + wave4;
      }
      posAttr.needsUpdate = true;
      meshRef.current.geometry.computeVertexNormals();
    }

    // 2. Interactive Pointer Parallax Tilt
    if (groupRef.current) {
      const px = state.pointer.x;
      const py = state.pointer.y;

      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        px * 0.2,
        0.04
      );
      groupRef.current.rotation.x = THREE.MathUtils.lerp(
        groupRef.current.rotation.x,
        -py * 0.16 - 0.1,
        0.04
      );
      groupRef.current.position.y = THREE.MathUtils.lerp(
        groupRef.current.position.y,
        Math.sin(t * 0.4) * 0.1,
        0.04
      );
    }

    // 3. Floating Motes Drift
    if (particlesRef.current) {
      const posAttr = particlesRef.current.geometry.attributes.position;
      const arr = posAttr.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i] += particleSpeeds[i];
        arr[i + 1] += particleSpeeds[i + 1];
        if (arr[i] > 6.5) arr[i] = -6.5;
      }
      posAttr.needsUpdate = true;
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Studio Lighting tailored to highlight satin sheen */}
      <ambientLight color="#FAF6F0" intensity={0.9} />
      <directionalLight position={[4, 5, 5]} intensity={2.8} color="#FFF8EE" />
      <pointLight position={[-4, 2, 3]} intensity={3.5} color="#7A6AD6" distance={12} />
      <pointLight position={[3, -2, 2]} intensity={2.2} color="#C5A059" distance={9} />
      <pointLight position={[0, -3, -2]} intensity={1.8} color="#3B4CCF" distance={8} />

      {/* Luxury Liquid Silk & Satin Cloth Surface */}
      <mesh ref={meshRef} geometry={geometry}>
        <meshPhysicalMaterial
          color="#F5EFE6"
          roughness={0.32}
          metalness={0.12}
          clearcoat={0.35}
          clearcoatRoughness={0.25}
          sheen={1.0}
          sheenColor="#7A6AD6"
          sheenRoughness={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Floating Warm Champagne Stardust Motes */}
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={particlePositions.length / 3}
            array={particlePositions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.04}
          color="#E8E2D5"
          transparent
          opacity={0.65}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}
