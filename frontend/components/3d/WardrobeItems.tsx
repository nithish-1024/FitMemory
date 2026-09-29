"use client";

import React, { useRef, useState, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { WardrobeItem, API_BASE_URL } from "@/lib/api";

const COLOR_HEX_MAP: Record<string, string> = {
  indigo: "#3B4CCF",
  white: "#F0EFEA",
  light_blue: "#ADD8E6",
  beige: "#D2B48C",
  navy: "#1B263B",
  black: "#1A1A1A",
  charcoal: "#36454F",
  grey: "#808080",
  crimson: "#B41432",
  emerald: "#108C5A",
  mustard: "#E1AD01",
  multicolor: "#DA8CAA",
  gold: "#D4AF37",
  burgundy: "#800020",
  cream: "#FAF5E6",
  blue_striped: "#6495ED",
  denim_blue: "#4169B9",
};

// Texture cache to prevent re-fetching and memory leaks
const textureCache = new Map<string, THREE.Texture>();

/**
 * Generates a high-contrast, crisp canvas texture for the bottom badge.
 * Displays item name and category / color in editorial typography.
 */
function createBadgeTexture(
  name: string,
  category?: string,
  color?: string,
  formality?: number
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 140;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.clearRect(0, 0, 512, 140);

    // Dark glass pill background with gradient
    const grad = ctx.createLinearGradient(0, 0, 0, 140);
    grad.addColorStop(0, "rgba(22, 20, 18, 0.96)");
    grad.addColorStop(1, "rgba(14, 12, 10, 0.98)");
    ctx.fillStyle = grad;

    // Rounded rectangle pill
    const radius = 24;
    const x = 12,
      y = 10,
      w = 488,
      h = 120;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();

    // Metallic Brass rim stroke
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "rgba(197, 160, 89, 0.5)";
    ctx.stroke();

    // Item Name in bone-white bold font
    ctx.fillStyle = "#F5F1E8";
    ctx.font = "bold 27px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    let displayName = name;
    if (ctx.measureText(displayName).width > 440) {
      while (ctx.measureText(displayName + "…").width > 440 && displayName.length > 3) {
        displayName = displayName.slice(0, -1);
      }
      displayName += "…";
    }
    ctx.fillText(displayName, 256, 52);

    // Tag subtitle in electric indigo
    ctx.fillStyle = "#818CF8";
    ctx.font = "600 17px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    const tags: string[] = [];
    if (category) tags.push(category.toUpperCase());
    if (color) tags.push(color.toUpperCase());
    if (formality) tags.push(`LVL ${formality}`);
    const tagText = tags.join(" • ") || "WARDROBE ESSENTIAL";
    ctx.fillText(tagText, 256, 92);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

// ----------------- INDIVIDUAL 3D HELIX DISPLAY CARD -----------------
interface SingleSpiralCardProps {
  item: WardrobeItem;
  index: number;
  currentScrollRef: React.MutableRefObject<number>;
  isSelected: boolean;
  onSelect: (item: WardrobeItem) => void;
  targetScrollRef: React.MutableRefObject<number>;
  entranceProgressRef: React.MutableRefObject<number>;
}

function SingleSpiralCard({
  item,
  index,
  currentScrollRef,
  isSelected,
  onSelect,
  targetScrollRef,
  entranceProgressRef,
}: SingleSpiralCardProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  const fullPhotoUrl = useMemo(() => {
    if (!item.photo) return "";
    if (item.photo.startsWith("http://") || item.photo.startsWith("https://")) {
      return item.photo;
    }
    return item.photo.startsWith("/") ? item.photo : `/${item.photo}`;
  }, [item.photo]);

  const [texture, setTexture] = useState<THREE.Texture | null>(() => {
    if (typeof window === "undefined" || !fullPhotoUrl) return null;
    return textureCache.get(fullPhotoUrl) || null;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !fullPhotoUrl) return;

    if (textureCache.has(fullPhotoUrl)) {
      setTexture(textureCache.get(fullPhotoUrl)!);
      return;
    }

    const loader = new THREE.TextureLoader();
    // Only set crossOrigin if truly external origin
    const isExternal =
      fullPhotoUrl.startsWith("http://") || fullPhotoUrl.startsWith("https://");
    if (isExternal && typeof window !== "undefined" && !fullPhotoUrl.startsWith(window.location.origin)) {
      loader.crossOrigin = "anonymous";
    }

    const tryLoad = (url: string, isFallback: boolean = false) => {
      loader.load(
        url,
        (loadedTex) => {
          loadedTex.colorSpace = THREE.SRGBColorSpace;
          loadedTex.generateMipmaps = true;
          loadedTex.minFilter = THREE.LinearMipmapLinearFilter;
          loadedTex.magFilter = THREE.LinearFilter;
          loadedTex.needsUpdate = true;
          textureCache.set(fullPhotoUrl, loadedTex);
          setTexture(loadedTex);
        },
        undefined,
        (err) => {
          if (!isFallback && !url.startsWith("http")) {
            // Fallback to backend URL
            const backendFallback = `${API_BASE_URL}${url.startsWith("/") ? url : `/${url}`}`;
            tryLoad(backendFallback, true);
          } else {
            console.warn("Failed to load photo texture:", url, err);
          }
        }
      );
    };

    tryLoad(fullPhotoUrl);
  }, [fullPhotoUrl]);

  const badgeTexture = useMemo(() => {
    if (typeof window === "undefined") return null;
    return createBadgeTexture(
      item.name,
      item.attributes?.type,
      item.attributes?.color,
      item.attributes?.formality
    );
  }, [
    item.name,
    item.attributes?.type,
    item.attributes?.color,
    item.attributes?.formality,
  ]);

  useEffect(() => {
    return () => {
      badgeTexture?.dispose();
    };
  }, [badgeTexture]);

  const baseColor = useMemo(() => {
    const c = item.attributes?.color?.toLowerCase();
    return c && COLOR_HEX_MAP[c] ? COLOR_HEX_MAP[c] : "#2A2621";
  }, [item.attributes]);

  useFrame(() => {
    if (!groupRef.current) return;
    const currentScroll = currentScrollRef.current;
    const diff = index - currentScroll;
    const angleStep = Math.PI / 4; // 8 cards per revolution
    const targetTheta = diff * angleStep;

    // 1.8-second Cinematic Helix Bloom entrance animation
    const progress = entranceProgressRef.current;
    // Stagger slightly per card by index
    const cardDelay = (index % 8) * 0.035;
    const cardProgress = THREE.MathUtils.clamp(
      (progress - cardDelay) / Math.max(0.01, 1 - cardDelay),
      0,
      1
    );
    // Smooth cubic ease-out
    const easedProgress = 1 - Math.pow(1 - cardProgress, 3);

    // 1. Radius blooms outward: R = THREE.MathUtils.lerp(0.5, 2.2, easedProgress)
    const R = THREE.MathUtils.lerp(0.5, 2.2, easedProgress);

    // 2. Cascade into position with staggered rotation: theta = THREE.MathUtils.lerp(targetTheta - 1.2, targetTheta, easedProgress)
    const theta = THREE.MathUtils.lerp(targetTheta - 1.2, targetTheta, easedProgress);

    const x = R * Math.sin(theta);
    const z = R * Math.cos(theta);
    const y = THREE.MathUtils.lerp(-diff * 0.42 - 0.35, -diff * 0.42, easedProgress);

    groupRef.current.position.set(x, y, z);
    groupRef.current.rotation.y = theta;

    // Focus calculation: front card (diff ~ 0) gets scaled and highlighted
    const dist = Math.abs(diff);
    const focus = Math.max(0, 1 - dist * 0.7);

    // Front card scales to 1.15x
    const fullScale = THREE.MathUtils.lerp(0.9, 1.15, focus);
    const targetScale = hovered || isSelected ? fullScale * 1.05 : fullScale;

    // 3. Cards scale smoothly from 0.2 to their full scale
    const scale = THREE.MathUtils.lerp(0.2, targetScale, easedProgress);
    groupRef.current.scale.set(scale, scale, scale);

    // Subtle gentle breath on front-focused card once fully bloomed
    if (dist < 0.35 && easedProgress > 0.95) {
      groupRef.current.rotation.z = Math.sin(Date.now() * 0.0018) * 0.015;
    } else {
      groupRef.current.rotation.z = 0;
    }

    // Only render cards reasonably close to the camera field
    groupRef.current.visible = dist < 5.0 && easedProgress > 0.02;
  });

  return (
    <group
      ref={groupRef}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
      onClick={(e) => {
        e.stopPropagation();
        targetScrollRef.current = index;
        onSelect(item);
      }}
    >
      {/* ---------------- THICK BEVELED BACKING (STUDIO CHASSIS) ---------------- */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.96, 1.34, 0.04]} />
        <meshStandardMaterial
          color="#161412"
          roughness={0.35}
          metalness={0.4}
        />
      </mesh>

      {/* ---------------- BRUSHED BRASS MARGIN FRAME ---------------- */}
      <mesh position={[0, 0, -0.002]}>
        <boxGeometry args={[0.98, 1.36, 0.036]} />
        <meshStandardMaterial
          color="#C5A059"
          metalness={0.8}
          roughness={0.25}
        />
      </mesh>

      {/* ---------------- TOP LUXURY BRASS HANGER ACCENT ---------------- */}
      <mesh position={[0, 0.71, 0]}>
        <torusGeometry args={[0.032, 0.005, 8, 24, Math.PI * 1.2]} />
        <meshStandardMaterial
          color="#D4AF37"
          metalness={0.85}
          roughness={0.2}
        />
      </mesh>
      <mesh position={[0, 0.675, 0]}>
        <cylinderGeometry args={[0.003, 0.003, 0.035, 8]} />
        <meshStandardMaterial
          color="#D4AF37"
          metalness={0.85}
          roughness={0.2}
        />
      </mesh>

      {/* ---------------- CRISP STUDIO MATTE BACKING (HIGH CONTRAST MOUNT) ---------------- */}
      <mesh position={[0, 0.14, 0.025]}>
        <planeGeometry args={[0.88, 0.94]} />
        <meshBasicMaterial color="#FAF9F5" side={THREE.DoubleSide} />
      </mesh>

      {/* ---------------- HIGH-RES PHOTO PLANE (Z = 0.032 TO ELIMINATE Z-FIGHTING) ---------------- */}
      <mesh position={[0, 0.14, 0.032]}>
        <planeGeometry args={[0.84, 0.90]} />
        <meshBasicMaterial
          map={texture || undefined}
          color={texture ? "#FFFFFF" : baseColor}
          transparent={false}
          depthWrite={true}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* ---------------- READABLE BOTTOM BADGE (NAME + CATEGORY) ---------------- */}
      {badgeTexture && (
        <mesh position={[0, -0.47, 0.035]}>
          <planeGeometry args={[0.86, 0.24]} />
          <meshBasicMaterial map={badgeTexture} transparent depthWrite={false} />
        </mesh>
      )}

      {/* ---------------- SELECTION / HOVER ELECTRIC INDIGO GLOW ---------------- */}
      {(hovered || isSelected) && (
        <mesh position={[0, 0, 0.038]}>
          <planeGeometry args={[0.94, 1.32]} />
          <meshBasicMaterial
            color="#3B4CCF"
            wireframe
            transparent
            opacity={0.7}
          />
        </mesh>
      )}
    </group>
  );
}

// ----------------- SPIRAL LOADING SKELETONS -----------------
function SpiralLoadingSkeletons() {
  const count = 8;
  return (
    <group position={[0, 0, 0]}>
      {Array.from({ length: count }).map((_, i) => {
        const theta = (i - 1) * (Math.PI / 4);
        const R = 2.2;
        const x = R * Math.sin(theta);
        const z = R * Math.cos(theta);
        const y = -(i - 1) * 0.42;

        return (
          <group
            key={i}
            position={[x, y, z]}
            rotation={[0, theta, 0]}
            scale={i === 1 ? 1.15 : 0.9}
          >
            <mesh>
              <boxGeometry args={[0.96, 1.34, 0.03]} />
              <meshStandardMaterial
                color="#221F1B"
                roughness={0.8}
                transparent
                opacity={0.5}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// ----------------- MAIN 3D SPIRAL SLIDER CONTAINER -----------------
export interface WardrobeItemsProps {
  items: WardrobeItem[];
  isLoading: boolean;
  selectedItemId?: string | null;
  onSelectItem: (item: WardrobeItem) => void;
  activeIndex?: number;
  onActiveIndexChange?: (index: number) => void;
  entranceProgress?: number;
}

export function WardrobeItems({
  items,
  isLoading,
  selectedItemId,
  onSelectItem,
  activeIndex,
  onActiveIndexChange,
  entranceProgress,
}: WardrobeItemsProps) {
  const targetScrollRef = useRef(0);
  const currentScrollRef = useRef(0);
  const lastReportedIndex = useRef(0);

  // 1.8-second Cinematic Helix Bloom entrance animation controller
  const entranceTimeRef = useRef(0);
  const entranceProgressRef = useRef(0);

  // Sync external activeIndex if provided (e.g. from Prev/Next buttons)
  useEffect(() => {
    if (typeof activeIndex === "number" && activeIndex !== Math.round(targetScrollRef.current)) {
      targetScrollRef.current = activeIndex;
    }
  }, [activeIndex]);

  // Reset scroll position and entrance bloom animation when items/user changes
  useEffect(() => {
    targetScrollRef.current = 0;
    currentScrollRef.current = 0;
    lastReportedIndex.current = 0;
    entranceTimeRef.current = 0;
    entranceProgressRef.current = 0;
    onActiveIndexChange?.(0);
  }, [items, onActiveIndexChange]);

  // Set up interactive mouse wheel, drag, and keyboard navigation
  useEffect(() => {
    const maxIdx = Math.max(0, items.length - 1);

    // 1. Mouse Wheel
    const handleWheel = (e: WheelEvent) => {
      // Don't hijack wheel if user is interacting with an open modal or sheet
      if ((e.target as HTMLElement)?.closest(".modal, .sheet, [role='dialog']")) return;
      e.preventDefault();
      const delta = e.deltaY * 0.0028;
      targetScrollRef.current = Math.max(0, Math.min(maxIdx, targetScrollRef.current + delta));
    };

    // 2. Drag & Touch Swipe
    let isPointerDown = false;
    let startX = 0;
    let startY = 0;

    const handlePointerDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement)?.closest("button, input, a, [role='dialog']")) return;
      isPointerDown = true;
      startX = e.clientX;
      startY = e.clientY;
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isPointerDown) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const sensitivity = 0.0055;
      const delta = (dy * 0.7 - dx) * sensitivity;
      targetScrollRef.current = Math.max(0, Math.min(maxIdx, targetScrollRef.current + delta));
      startX = e.clientX;
      startY = e.clientY;
    };

    const handlePointerUp = () => {
      isPointerDown = false;
    };

    // 3. Arrow Keys
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        targetScrollRef.current = Math.min(maxIdx, Math.round(targetScrollRef.current + 1));
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        targetScrollRef.current = Math.max(0, Math.round(targetScrollRef.current - 1));
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [items.length]);

  // Frame loop for smooth damping, active index notification, and 1.8s entrance bloom
  useFrame((_, delta) => {
    currentScrollRef.current = THREE.MathUtils.lerp(
      currentScrollRef.current,
      targetScrollRef.current,
      0.088
    );

    const rounded = Math.round(currentScrollRef.current);
    if (rounded !== lastReportedIndex.current) {
      lastReportedIndex.current = rounded;
      onActiveIndexChange?.(rounded);
    }

    // Advance 1.8s Cinematic Helix Bloom entrance animation
    if (typeof entranceProgress === "number") {
      entranceProgressRef.current = entranceProgress;
    } else if (entranceProgressRef.current < 1) {
      entranceTimeRef.current += delta;
      const raw = Math.min(1, entranceTimeRef.current / 1.8);
      // Smooth cubic ease-out
      entranceProgressRef.current = 1 - Math.pow(1 - raw, 3);
    }
  });

  if (isLoading && (!items || items.length === 0)) {
    return <SpiralLoadingSkeletons />;
  }

  if (!items || items.length === 0) {
    return null;
  }

  return (
    <group position={[0, 0, 0]}>
      {items.map((item, index) => (
        <SingleSpiralCard
          key={item.id}
          item={item}
          index={index}
          currentScrollRef={currentScrollRef}
          targetScrollRef={targetScrollRef}
          entranceProgressRef={entranceProgressRef}
          isSelected={item.id === selectedItemId}
          onSelect={onSelectItem}
        />
      ))}
    </group>
  );
}
