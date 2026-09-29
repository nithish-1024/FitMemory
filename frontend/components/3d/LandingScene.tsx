"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  DoorClosed,
  RotateCcw,
  Compass,
} from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/store/useAppStore";
import { MeshFlow } from "./MeshFlow";
import { WardrobeItems } from "./WardrobeItems";
import { DustParticles } from "./DustParticles";
import { ItemDetailCard } from "@/components/ItemDetailCard";
import { SpaceshipLoader } from "@/components/SpaceshipLoader";
import { OutfitCard } from "@/components/OutfitCard";
import { Button } from "@/components/ui/button";
import {
  API_BASE_URL,
  ClarificationOption,
  getWardrobe,
  recommendOutfit,
  submitFeedback,
} from "@/lib/api";

// ----------------- WEBGL DETECTION -----------------
function checkWebGLSupport(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

export function LandingScene() {
  const {
    hasEnteredWardrobe,
    setHasEnteredWardrobe,
    currentUser,
    wardrobe,
    setWardrobe,
    loading,
    setLoading,
    selectedItem,
    setSelectedItem,
    currentOutfit,
    setCurrentOutfit,
    exclude,
    addExclude,
  } = useAppStore();

  const [webglSupported, setWebglSupported] = useState<boolean | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Recommendation & Feedback state
  const [recommendError, setRecommendError] = useState<string | null>(null);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [clarificationOptions, setClarificationOptions] = useState<
    ClarificationOption[] | null
  >(null);

  useEffect(() => {
    setWebglSupported(checkWebGLSupport());
  }, []);

  // Pre-fetch wardrobe on mount and whenever currentUser switches
  useEffect(() => {
    let isMounted = true;
    setLoading("wardrobe", true);

    getWardrobe(currentUser)
      .then((items) => {
        if (isMounted && items && items.length > 0) {
          setWardrobe(items);
        }
      })
      .catch((err) => {
        console.warn("Backend wardrobe fetch note (using local cache):", err);
      })
      .finally(() => {
        if (isMounted) {
          setLoading("wardrobe", false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [currentUser, setWardrobe, setLoading]);

  const handleEnterWardrobe = () => {
    setHasEnteredWardrobe(true);
  };

  const handlePrevItem = () => {
    setActiveIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNextItem = () => {
    setActiveIndex((prev) => Math.min(wardrobe.length - 1, prev + 1));
  };

  // ----------------- RECOMMENDATION FLOW -----------------
  const handleRequestRecommendation = useCallback(
    async (mode: "closet" | "discover" = "closet") => {
      setLoading("recommend", true);
      setRecommendError(null);
      setClarificationOptions(null);

      try {
        // Run recommendation request with guaranteed 11s Star Wars mini-game gameplay experience
        const [outfit] = await Promise.all([
          recommendOutfit(currentUser, exclude, mode),
          new Promise((resolve) => setTimeout(resolve, 11000)),
        ]);
        setCurrentOutfit(outfit);
      } catch (err: any) {
        console.error("Recommendation error:", err);
        setRecommendError(err.message || "Failed to generate outfit recommendation.");
      } finally {
        setLoading("recommend", false);
      }
    },
    [currentUser, exclude, setCurrentOutfit, setLoading]
  );

  // ----------------- ACCEPT FLOW -----------------
  const handleAcceptOutfit = async () => {
    if (!currentOutfit) return;
    setIsSubmittingFeedback(true);
    const activeMode = currentOutfit.mode || "closet";

    try {
      await submitFeedback({
        user_id: currentUser,
        item_ids: currentOutfit.item_ids,
        action: "accept",
        attributes_used: currentOutfit.attributes_used,
      });

      toast.success("Outfit saved to memory! Generating next look...");
      addExclude(currentOutfit.item_ids);
      setCurrentOutfit(null);

      // Auto-trigger next recommendation in same mode
      setTimeout(() => {
        handleRequestRecommendation(activeMode);
      }, 350);
    } catch (err: any) {
      console.error("Accept feedback error:", err);
      toast.error("Failed to save feedback.");
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  // ----------------- REJECT FLOW -----------------
  const handleRejectOutfit = async () => {
    if (!currentOutfit) return;
    setIsSubmittingFeedback(true);

    try {
      const res = await submitFeedback({
        user_id: currentUser,
        item_ids: currentOutfit.item_ids,
        action: "reject",
        attributes_used: currentOutfit.attributes_used,
      });

      if (res.needs_clarification && res.options) {
        setClarificationOptions(res.options);
      } else {
        toast.info("Preference noted. Learning your style preferences.");
        addExclude(currentOutfit.item_ids);
        setCurrentOutfit(null);
      }
    } catch (err: any) {
      console.error("Reject feedback error:", err);
      toast.error("Failed to submit feedback.");
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  // ----------------- CLARIFICATION SUBMIT -----------------
  const handleClarifyReject = async (optionKey: string) => {
    if (!currentOutfit) return;
    setIsSubmittingFeedback(true);

    try {
      const res = await submitFeedback({
        user_id: currentUser,
        item_ids: currentOutfit.item_ids,
        action: "reject",
        attributes_used: currentOutfit.attributes_used,
        clarification: optionKey,
      });

      const summary = !res.needs_clarification
        ? res.memory_write_summary
        : "Memory calibrated";
      toast.info(summary || "Style preference updated in memory.");

      addExclude(currentOutfit.item_ids);
      setCurrentOutfit(null);
      setClarificationOptions(null);
    } catch (err: any) {
      console.error("Clarification error:", err);
      toast.error("Failed to submit clarification.");
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const handleCloseOutfit = () => {
    setCurrentOutfit(null);
    setClarificationOptions(null);
  };

  // ----------------- 2D GRACEFUL FALLBACK -----------------
  if (webglSupported === false) {
    return (
      <div className="relative w-full h-full min-h-[500px] flex flex-col items-center justify-center bg-ink text-bone p-8 text-center rounded-3xl border border-ink-border overflow-hidden">
        <div className="absolute inset-0 bg-radial-vignette pointer-events-none opacity-40" />
        <div className="max-w-md space-y-6 z-10 flex flex-col items-center">
          <div className="h-16 w-16 rounded-2xl bg-ink-surface border border-ink-border flex items-center justify-center text-indigo">
            <DoorClosed className="h-8 w-8 text-indigo" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-serif tracking-tight text-bone font-semibold">
              FitMemory
            </h1>
            <p className="text-sm text-bone-muted leading-relaxed">
              Curated wardrobe and AI stylist for{" "}
              <span className="capitalize text-bone font-medium">{currentUser}</span>.
            </p>
          </div>
          <Button
            size="lg"
            onClick={handleEnterWardrobe}
            className="w-full max-w-xs bg-bone text-ink hover:bg-bone-muted text-sm font-medium tracking-wide shadow-xl flex items-center justify-center gap-2"
          >
            <span>Enter Wardrobe</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  const currentActiveItem = wardrobe[activeIndex];

  // ----------------- 3D CANVAS & OVERLAYS -----------------
  return (
    <div className="relative w-full h-[calc(100vh-64px)] min-h-[550px] overflow-hidden bg-ink select-none">
      {/* 3D R3F Canvas */}
      <Canvas
        camera={{
          position: hasEnteredWardrobe ? [0, 0.1, 4.5] : [0, 0, 4.5],
          fov: hasEnteredWardrobe ? 45 : 46,
        }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        }}
        dpr={[1, 1.5]}
        className="w-full h-full"
      >
        <color
          attach="background"
          args={[hasEnteredWardrobe ? "#161412" : "#1A1815"]}
        />

        {!hasEnteredWardrobe ? (
          // Landing View: 3D Mesh Flow ribbon with dynamic wave and stardust
          <MeshFlow />
        ) : (
          // Wardrobe View: Studio Lighting & 3D Rolling Spiral Slider
          <>
            {/* Ambient Warm Studio Light */}
            <ambientLight color="#F5F1E8" intensity={1.2} />

            {/* Key Light (Spotlight): positioned above-front [0, 4, 3] */}
            <spotLight
              position={[0, 4, 3]}
              angle={0.7}
              penumbra={0.8}
              intensity={3.5}
              color="#FFF9F0"
              target-position={[0, 0, 0]}
            />

            {/* Cool Indigo Rim Light from behind [0, 1, -2] */}
            <pointLight
              position={[0, 1, -2]}
              intensity={2.0}
              color="#3B4CCF"
              distance={8}
            />

            {/* Subtle Studio Fill Light */}
            <pointLight
              position={[-3, -1, 2]}
              intensity={0.8}
              color="#202550"
              distance={7}
            />

            {/* Atmospheric Dust Particles */}
            <DustParticles count={180} />

            {/* Architectural Circular Studio Podium Floor */}
            <mesh position={[0, -1.85, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[3.2, 48]} />
              <meshStandardMaterial
                color="#161412"
                roughness={0.75}
                metalness={0.25}
              />
            </mesh>
            <mesh position={[0, -1.84, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[3.15, 3.22, 48]} />
              <meshBasicMaterial color="#3B4CCF" transparent opacity={0.35} />
            </mesh>

            {/* 3D Rolling Spiral Slider Carousel */}
            <WardrobeItems
              items={wardrobe}
              isLoading={loading.wardrobe}
              selectedItemId={selectedItem?.id}
              onSelectItem={(item) => setSelectedItem(item)}
              activeIndex={activeIndex}
              onActiveIndexChange={setActiveIndex}
            />
          </>
        )}
      </Canvas>

      {/* ----------------- LANDING OVERLAY (MeshFlow) ----------------- */}
      <AnimatePresence>
        {!hasEnteredWardrobe && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -25, scale: 0.95 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-6 sm:p-12 z-20"
          >
            {/* Top Subtitle Pill */}
            <div className="pt-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-ink/20 bg-white/60 backdrop-blur-md px-3.5 py-1 text-[11px] font-semibold tracking-wider uppercase text-ink shadow-sm">
                <Sparkles className="h-3 w-3 text-indigo" />
                <span>Editorial Wardrobe Experience</span>
              </span>
            </div>

            {/* Central Editorial Typography & CTA */}
            <div className="flex flex-col items-center text-center space-y-5 max-w-md">
              <div className="space-y-2">
                <h1 className="font-serif font-black tracking-tight text-4xl sm:text-6xl text-[#12100E] uppercase drop-shadow-sm">
                  FitMemory
                </h1>
                <p className="text-xs sm:text-sm font-mono tracking-widest text-[#3B4CCF] uppercase font-bold">
                  Persistent Styling Intelligence
                </p>
                <p className="text-xs sm:text-sm text-[#2D2824] max-w-sm mx-auto font-sans leading-relaxed pt-1 font-medium">
                  Curated wardrobe and AI stylist for{" "}
                  <span className="capitalize text-[#12100E] font-bold">
                    {currentUser}
                  </span>
                  . Balancing silhouettes, tone theory, and learned preferences.
                </p>
              </div>

              {/* Primary CTA Button "Enter Wardrobe": Bold Deep Ink button with Bone text */}
              <div className="pointer-events-auto pt-2 flex flex-col items-center gap-3">
                <Button
                  size="lg"
                  onClick={handleEnterWardrobe}
                  className="bg-[#141210] text-[#F5EFE6] hover:bg-[#25221F] text-sm font-semibold tracking-wide px-8 py-6 rounded-2xl shadow-2xl shadow-ink/20 transition-all duration-300 flex items-center gap-3 group"
                >
                  <span>Enter Wardrobe</span>
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1 text-[#F5EFE6]" />
                </Button>

                {/* Wardrobe Items Visual Preview Strip */}
                {wardrobe.length > 0 && (
                  <div className="flex items-center gap-2 pt-1">
                    {wardrobe.slice(0, 5).map((item, idx) => {
                      const itemPhotoUrl = item.photo.startsWith("http")
                        ? item.photo
                        : `${API_BASE_URL}${item.photo.startsWith("/") ? item.photo : `/${item.photo}`}`;

                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setActiveIndex(idx);
                            setHasEnteredWardrobe(true);
                          }}
                          className="group relative h-11 w-11 rounded-xl border border-ink/20 bg-white/70 backdrop-blur-sm overflow-hidden hover:scale-110 hover:border-indigo transition-all duration-300 shadow-md"
                          title={item.name}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={itemPhotoUrl}
                            alt={item.name}
                            className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              if (!target.dataset.triedFallback && !item.photo.startsWith("http")) {
                                target.dataset.triedFallback = "true";
                                target.src = item.photo.startsWith("/") ? item.photo : `/${item.photo}`;
                              }
                            }}
                          />
                        </button>
                      );
                    })}
                    <button
                      onClick={handleEnterWardrobe}
                      className="h-11 px-2.5 rounded-xl border border-ink/20 bg-white/70 backdrop-blur-sm text-[10px] font-mono uppercase text-[#141210] font-semibold hover:bg-white hover:border-ink/40 transition-all flex items-center justify-center shadow-sm"
                    >
                      +{wardrobe.length > 5 ? wardrobe.length - 5 : "More"}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Footer Info */}
            <div className="pb-1 text-[11px] text-bone-subtle/80 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-indigo" />
              <span>Hindsight Persistent Memory Engine</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ----------------- WARDROBE MODE CONTROLS ----------------- */}
      <AnimatePresence>
        {hasEnteredWardrobe && (
          <>
            {/* Top Left Return Button */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4 }}
              className="absolute top-5 left-5 z-30 pointer-events-auto"
            >
              <button
                onClick={() => setHasEnteredWardrobe(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-ink-border bg-ink-surface/80 backdrop-blur-md text-[11px] font-mono uppercase text-bone-muted hover:text-bone hover:border-bone/30 transition-all"
              >
                <RotateCcw className="h-3 w-3 text-indigo" />
                <span>Overview</span>
              </button>
            </motion.div>

            {/* Bottom Carousel Navigation Pill */}
            {wardrobe.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-auto"
              >
                <div className="flex flex-col items-center gap-1.5">
                  <div className="flex items-center gap-2 rounded-2xl border border-ink-border bg-ink-surface/90 backdrop-blur-md px-3 py-1.5 shadow-2xl">
                    <button
                      onClick={handlePrevItem}
                      disabled={activeIndex <= 0}
                      className="p-1.5 rounded-xl text-bone-muted hover:text-bone hover:bg-ink-elevated disabled:opacity-30 disabled:pointer-events-none transition-colors"
                      aria-label="Previous item"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>

                    <div className="px-2 text-center min-w-[170px] sm:min-w-[210px]">
                      <div className="text-[10px] font-mono tracking-wider text-indigo uppercase font-semibold">
                        Item {activeIndex + 1} of {wardrobe.length}
                      </div>
                      <div className="text-xs font-medium text-bone truncate max-w-[190px] sm:max-w-[240px]">
                        {currentActiveItem?.name || "Wardrobe Item"}
                      </div>
                    </div>

                    <button
                      onClick={handleNextItem}
                      disabled={activeIndex >= wardrobe.length - 1}
                      className="p-1.5 rounded-xl text-bone-muted hover:text-bone hover:bg-ink-elevated disabled:opacity-30 disabled:pointer-events-none transition-colors"
                      aria-label="Next item"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  <span className="text-[10px] text-bone-subtle/70 font-sans tracking-wide hidden sm:block">
                    Scroll, drag, or arrows to roll • Click to inspect
                  </span>
                </div>
              </motion.div>
            )}

            {/* Persistent Floating Dual Recommendation Dock */}
            {!currentOutfit && !loading.recommend && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-30 pointer-events-auto flex flex-col sm:flex-row items-end sm:items-center gap-2.5"
              >
                {/* Button 1: Style My Closet */}
                <Button
                  size="lg"
                  disabled={
                    loading.wardrobe ||
                    loading.recommend ||
                    wardrobe.length === 0
                  }
                  className="bg-bone text-ink hover:bg-bone-muted shadow-2xl shadow-bone/15 px-5 py-5 rounded-2xl flex items-center gap-2.5 font-semibold text-xs sm:text-sm tracking-wide transition-all group disabled:opacity-50"
                  onClick={() => handleRequestRecommendation("closet")}
                >
                  <Sparkles className="h-4 w-4 text-indigo transition-transform group-hover:rotate-12" />
                  <span>Style My Closet</span>
                </Button>

                {/* Button 2: Discover New Piece */}
                <Button
                  size="lg"
                  disabled={
                    loading.wardrobe ||
                    loading.recommend ||
                    wardrobe.length === 0
                  }
                  className="bg-ink-surface/90 hover:bg-ink-elevated text-bone border border-indigo/40 hover:border-indigo shadow-2xl shadow-indigo/10 backdrop-blur-md px-5 py-5 rounded-2xl flex items-center gap-2.5 font-semibold text-xs sm:text-sm tracking-wide transition-all group disabled:opacity-50"
                  onClick={() => handleRequestRecommendation("discover")}
                >
                  <Compass className="h-4 w-4 text-indigo transition-transform group-hover:rotate-45" />
                  <span>Discover New Piece</span>
                </Button>
              </motion.div>
            )}
          </>
        )}
      </AnimatePresence>

      {/* 2D Item Detail Card Overlay */}
      <ItemDetailCard
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
      />

      {/* Spaceship Shooter Mini-Game Loading Overlay */}
      <SpaceshipLoader
        isLoading={loading.recommend}
        error={recommendError}
        onRetry={handleRequestRecommendation}
        onCancel={() => {
          setLoading("recommend", false);
          setRecommendError(null);
        }}
      />

      {/* Recommended Outfit Card Overlay with Accept / Reject & MCQ */}
      {currentOutfit && (
        <OutfitCard
          outfit={currentOutfit}
          onAccept={handleAcceptOutfit}
          onReject={handleRejectOutfit}
          onClarify={handleClarifyReject}
          onClose={handleCloseOutfit}
          isSubmittingFeedback={isSubmittingFeedback}
          clarificationOptions={clarificationOptions}
        />
      )}
    </div>
  );
}
