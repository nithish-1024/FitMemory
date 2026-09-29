"use client";

import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export function MeshFlow() {
  const meshRef = useRef<THREE.Mesh>(null);
  const wireRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const particlesRef = useRef<THREE.Points>(null);

  // High-resolution subdivided plane for organic wave deformation
  const [geometry, originalPositions] = useMemo(() => {
    const geo = new THREE.PlaneGeometry(12, 6.5, 64, 48);
    const pos = geo.attributes.position;
    const orig = new Float32Array(pos.array.length);
    orig.set(pos.array);
    return [geo, orig];
  }, []);

  // Glowing particle motes along the flow
  const [particlePositions, particleSpeeds] = useMemo(() => {
    const count = 180;
    const pos = new Float32Array(count * 3);
    const spd = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 11;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 3;

      spd[i * 3] = 0.002 + Math.random() * 0.004;
      spd[i * 3 + 1] = (Math.random() - 0.5) * 0.002;
      spd[i * 3 + 2] = (Math.random() - 0.5) * 0.002;
    }
    return [pos, spd];
  }, []);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();

    // 1. Dynamic Wave Vertex Displacement
    if (meshRef.current) {
      const posAttr = meshRef.current.geometry.attributes.position;
      const arr = posAttr.array as Float32Array;

      for (let i = 0; i < arr.length; i += 3) {
        const ox = originalPositions[i];
        const oy = originalPositions[i + 1];

        // Complex multi-frequency organic flow wave
        const wave1 = Math.sin(ox * 0.65 + t * 1.1) * 0.55;
        const wave2 = Math.cos(oy * 0.85 + t * 0.9) * 0.45;
        const wave3 = Math.sin((ox + oy) * 0.45 + t * 1.3) * 0.35;
        const wave4 = Math.cos(Math.hypot(ox, oy) * 0.5 - t * 1.5) * 0.25;

        arr[i + 2] = wave1 + wave2 + wave3 + wave4;
      }
      posAttr.needsUpdate = true;
      meshRef.current.geometry.computeVertexNormals();

      // Synchronize wireframe geometry
      if (wireRef.current) {
        const wirePosAttr = wireRef.current.geometry.attributes.position;
        (wirePosAttr.array as Float32Array).set(arr);
        wirePosAttr.needsUpdate = true;
      }
    }

    // 2. Interactive Pointer Parallax Tilt
    if (groupRef.current) {
      const px = state.pointer.x;
      const py = state.pointer.y;

      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        px * 0.25,
        0.05
      );
      groupRef.current.rotation.x = THREE.MathUtils.lerp(
        groupRef.current.rotation.x,
        -py * 0.2 - 0.15,
        0.05
      );
      groupRef.current.position.y = THREE.MathUtils.lerp(
        groupRef.current.position.y,
        Math.sin(t * 0.5) * 0.12,
        0.05
      );
    }

    // 3. Drift Floating Motes
    if (particlesRef.current) {
      const posAttr = particlesRef.current.geometry.attributes.position;
      const arr = posAttr.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i] += particleSpeeds[i];
        arr[i + 1] += particleSpeeds[i + 1];
        if (arr[i] > 6) arr[i] = -6;
      }
      posAttr.needsUpdate = true;
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Dynamic Lighting for Mesh Flow */}
      <ambientLight color="#1A1815" intensity={1.5} />
      <pointLight position={[-3, 2, 3]} intensity={4.5} color="#3B4CCF" distance={10} />
      <pointLight position={[3, -1, 2]} intensity={3.5} color="#F5F1E8" distance={8} />
      <pointLight position={[0, -2, -2]} intensity={2.0} color="#3B4CCF" distance={7} />

      {/* Surface 1: Translucent Glowing Mesh Ribbon */}
      <mesh ref={meshRef} geometry={geometry}>
        <meshPhysicalMaterial
          color="#1A1815"
          emissive="#1F2A7A"
          emissiveIntensity={0.65}
          roughness={0.25}
          metalness={0.7}
          clearcoat={1.0}
          clearcoatRoughness={0.2}
          transmission={0.4}
          opacity={0.88}
          transparent
          side={THREE.DoubleSide}
          wireframe={false}
        />
      </mesh>

      {/* Surface 2: Electric Indigo Wireframe Lattice Overlay */}
      <mesh ref={wireRef} geometry={geometry.clone()}>
        <meshBasicMaterial
          color="#3B4CCF"
          wireframe
          transparent
          opacity={0.38}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Floating Stardust Particles */}
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
          size={0.045}
          color="#F5F1E8"
          transparent
          opacity={0.55}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}
