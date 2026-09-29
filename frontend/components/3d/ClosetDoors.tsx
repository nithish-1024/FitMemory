"use client";

import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface ClosetDoorsProps {
  openProgress: number; // 0.0 (closed) to 1.0 (fully open)
  children?: React.ReactNode;
}

export function ClosetDoors({ openProgress, children }: ClosetDoorsProps) {
  const leftPivotRef = useRef<THREE.Group>(null);
  const rightPivotRef = useRef<THREE.Group>(null);

  useFrame(() => {
    // Left door rotates outwards to the left (~-105 degrees)
    if (leftPivotRef.current) {
      leftPivotRef.current.rotation.y = -openProgress * (Math.PI * 0.58);
    }
    // Right door rotates outwards to the right (~+105 degrees)
    if (rightPivotRef.current) {
      rightPivotRef.current.rotation.y = openProgress * (Math.PI * 0.58);
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* ---------------- WARDROBE INTERIOR ---------------- */}
      <group position={[0, 1.2, -0.6]}>
        {/* Back Wall */}
        <mesh position={[0, 0, -0.6]}>
          <planeGeometry args={[1.78, 2.38]} />
          <meshStandardMaterial color="#161412" roughness={0.9} />
        </mesh>

        {/* Interior Floor */}
        <mesh position={[0, -1.18, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.78, 1.2]} />
          <meshStandardMaterial color="#1E1B17" roughness={0.7} />
        </mesh>

        {/* Interior Ceiling */}
        <mesh position={[0, 1.18, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.78, 1.2]} />
          <meshStandardMaterial color="#141210" roughness={0.9} />
        </mesh>

        {/* Interior Left Wall */}
        <mesh position={[-0.89, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[1.2, 2.38]} />
          <meshStandardMaterial color="#181613" roughness={0.9} />
        </mesh>

        {/* Interior Right Wall */}
        <mesh position={[0.89, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[1.2, 2.38]} />
          <meshStandardMaterial color="#181613" roughness={0.9} />
        </mesh>

        {/* Brushed Brass Wardrobe Rail */}
        <mesh position={[0, 0.75, -0.2]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.016, 0.016, 1.76, 16]} />
          <meshStandardMaterial color="#C5A059" metalness={0.75} roughness={0.25} />
        </mesh>

        {/* Warm Internal Glow Light */}
        <pointLight position={[0, 0.8, -0.1]} intensity={openProgress * 2.2} distance={4} color="#FFE6C2" />
        {/* Subtle Indigo Accent Spill Light */}
        <pointLight position={[0, -0.8, -0.2]} intensity={openProgress * 1.5} distance={3} color="#3B4CCF" />

        {/* Hanging Wardrobe Items Container */}
        {children}
      </group>

      {/* ---------------- SURROUNDING DOOR FRAME ---------------- */}
      <group position={[0, 1.2, 0]}>
        {/* Left Outer Post */}
        <mesh position={[-0.93, 0, 0]}>
          <boxGeometry args={[0.08, 2.44, 0.12]} />
          <meshStandardMaterial color="#2B2620" roughness={0.75} />
        </mesh>

        {/* Right Outer Post */}
        <mesh position={[0.93, 0, 0]}>
          <boxGeometry args={[0.08, 2.44, 0.12]} />
          <meshStandardMaterial color="#2B2620" roughness={0.75} />
        </mesh>

        {/* Top Header Lintel */}
        <mesh position={[0, 1.24, 0]}>
          <boxGeometry args={[1.94, 0.08, 0.12]} />
          <meshStandardMaterial color="#2B2620" roughness={0.75} />
        </mesh>

        {/* Bottom Threshold */}
        <mesh position={[0, -1.21, 0]}>
          <boxGeometry args={[1.94, 0.04, 0.14]} />
          <meshStandardMaterial color="#1F1C18" roughness={0.65} />
        </mesh>
      </group>

      {/* ---------------- LEFT CLOSET DOOR ---------------- */}
      {/* Pivot anchored at x = -0.88 */}
      <group ref={leftPivotRef} position={[-0.88, 1.2, 0]}>
        {/* Main Door Slab (offset by half width: +0.44) */}
        <mesh position={[0.44, 0, 0]}>
          <boxGeometry args={[0.87, 2.36, 0.05]} />
          <meshStandardMaterial color="#221F1B" roughness={0.65} metalness={0.1} />
        </mesh>

        {/* Upper Decorative Recessed Panel */}
        <mesh position={[0.44, 0.45, 0.026]}>
          <boxGeometry args={[0.66, 0.95, 0.008]} />
          <meshStandardMaterial color="#191714" roughness={0.8} />
        </mesh>

        {/* Lower Decorative Recessed Panel */}
        <mesh position={[0.44, -0.55, 0.026]}>
          <boxGeometry args={[0.66, 0.75, 0.008]} />
          <meshStandardMaterial color="#191714" roughness={0.8} />
        </mesh>

        {/* Elegant Brass Handle */}
        <mesh position={[0.80, 0, 0.045]}>
          <cylinderGeometry args={[0.009, 0.009, 0.35, 16]} />
          <meshStandardMaterial color="#D4AF37" metalness={0.85} roughness={0.2} />
        </mesh>
        <mesh position={[0.80, 0.14, 0.03]}>
          <boxGeometry args={[0.015, 0.015, 0.03]} />
          <meshStandardMaterial color="#D4AF37" metalness={0.85} roughness={0.2} />
        </mesh>
        <mesh position={[0.80, -0.14, 0.03]}>
          <boxGeometry args={[0.015, 0.015, 0.03]} />
          <meshStandardMaterial color="#D4AF37" metalness={0.85} roughness={0.2} />
        </mesh>
      </group>

      {/* ---------------- RIGHT CLOSET DOOR ---------------- */}
      {/* Pivot anchored at x = +0.88 */}
      <group ref={rightPivotRef} position={[0.88, 1.2, 0]}>
        {/* Main Door Slab (offset by half width: -0.44) */}
        <mesh position={[-0.44, 0, 0]}>
          <boxGeometry args={[0.87, 2.36, 0.05]} />
          <meshStandardMaterial color="#221F1B" roughness={0.65} metalness={0.1} />
        </mesh>

        {/* Upper Decorative Recessed Panel */}
        <mesh position={[-0.44, 0.45, 0.026]}>
          <boxGeometry args={[0.66, 0.95, 0.008]} />
          <meshStandardMaterial color="#191714" roughness={0.8} />
        </mesh>

        {/* Lower Decorative Recessed Panel */}
        <mesh position={[-0.44, -0.55, 0.026]}>
          <boxGeometry args={[0.66, 0.75, 0.008]} />
          <meshStandardMaterial color="#191714" roughness={0.8} />
        </mesh>

        {/* Elegant Brass Handle */}
        <mesh position={[-0.80, 0, 0.045]}>
          <cylinderGeometry args={[0.009, 0.009, 0.35, 16]} />
          <meshStandardMaterial color="#D4AF37" metalness={0.85} roughness={0.2} />
        </mesh>
        <mesh position={[-0.80, 0.14, 0.03]}>
          <boxGeometry args={[0.015, 0.015, 0.03]} />
          <meshStandardMaterial color="#D4AF37" metalness={0.85} roughness={0.2} />
        </mesh>
        <mesh position={[-0.80, -0.14, 0.03]}>
          <boxGeometry args={[0.015, 0.015, 0.03]} />
          <meshStandardMaterial color="#D4AF37" metalness={0.85} roughness={0.2} />
        </mesh>
      </group>
    </group>
  );
}
