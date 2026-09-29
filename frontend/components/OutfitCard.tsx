"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  X,
  Sparkles,
  HelpCircle,
  Layers,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import {
  RecommendationResponse,
  ClarificationOption,
  API_BASE_URL,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { springs } from "@/lib/design-tokens";

interface OutfitCardProps {
  outfit: RecommendationResponse;
  onAccept: () => void;
  onReject: () => void;
  onClarify: (optionKey: string) => void;
  onClose: () => void;
  isSubmittingFeedback: boolean;
  clarificationOptions: ClarificationOption[] | null;
}

export function OutfitCard({
  outfit,
  onAccept,
  onReject,
  onClarify,
  onClose,
  isSubmittingFeedback,
  clarificationOptions,
}: OutfitCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const isClarificationStep = Boolean(
    clarificationOptions && clarificationOptions.length > 0
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-ink/80 backdrop-blur-md select-none overflow-y-auto">
      {/* Backdrop click to dismiss */}
      <div
        className="fixed inset-0 -z-10 cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 20 }}
        transition={springs.snappy}
        className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl border border-ink-border bg-ink-surface text-bone shadow-2xl p-5 sm:p-8 flex flex-col space-y-6 relative"
      >
        {/* Header & Close */}
        <div className="flex items-center justify-between border-b border-ink-border/70 pb-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-indigo animate-pulse" />
            <span className="text-xs font-mono uppercase tracking-widest text-indigo font-semibold">
              {outfit.mode === "discover" ? "Wardrobe Discovery" : "Curated Look"} &bull; {outfit.user_id}
            </span>
            {outfit.mode === "discover" && (
              <span className="rounded-full bg-indigo/20 text-indigo border border-indigo/40 px-2 py-0.5 text-[10px] font-mono uppercase">
                +1 New Piece
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-bone-subtle hover:text-bone hover:bg-ink-elevated transition-colors"
            aria-label="Close outfit card"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ---------------- STEP 1: OUTFIT OVERVIEW ---------------- */}
        {!isClarificationStep && (
          <div className="space-y-6">
            {/* Visuals: Editorial Styled Look + Wardrobe Items Collage */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Pollinations AI Editorial Photo */}
              {!imageError && (
                <div className="relative aspect-[3/4] rounded-2xl border border-ink-border/80 bg-ink-elevated overflow-hidden shadow-inner flex items-center justify-center group">
                  {!imageLoaded && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center space-y-2 bg-ink-elevated animate-pulse p-4 text-center">
                      <Skeleton className="w-full h-full rounded-2xl bg-ink-border/50" />
                      <span className="absolute text-[10px] font-mono text-bone-subtle uppercase">
                        Rendering Look…
                      </span>
                    </div>
                  )}

                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={outfit.image_url}
                    alt={outfit.image_prompt || "Styled look on model"}
                    className={`w-full h-full object-cover transition-opacity duration-700 ${
                      imageLoaded ? "opacity-100" : "opacity-0"
                    }`}
                    onLoad={() => setImageLoaded(true)}
                    onError={() => setImageError(true)}
                  />

                  {/* Overlay Badge */}
                  <div className="absolute bottom-2.5 left-2.5 right-2.5 px-3 py-1.5 rounded-xl bg-ink/70 backdrop-blur-md border border-bone/10 text-[10px] text-bone-muted font-sans flex items-center justify-between">
                    <span>Editorial Rendering</span>
                    <Sparkles className="h-3 w-3 text-indigo" />
                  </div>
                </div>
              )}

              {/* Items Collage */}
              <div
                className={`flex flex-col space-y-2.5 justify-between ${
                  imageError ? "sm:col-span-2" : ""
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-bone-subtle">
                  <span>Ensemble Items ({outfit.items?.length || 0})</span>
                  <Layers className="h-3.5 w-3.5 text-indigo" />
                </div>

                <div
                  className={`grid ${
                    imageError ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2"
                  } gap-2.5`}
                >
                  {outfit.items?.map((item) => {
                    const isNewItem = Boolean(
                      item.attributes?.is_new ||
                        outfit.new_item?.name === item.name ||
                        item.id === "new_curated_piece"
                    );

                    const photo = item.photo?.startsWith("http")
                      ? item.photo
                      : item.photo?.startsWith("/")
                      ? item.photo
                      : item.photo
                      ? `/${item.photo}`
                      : "";

                    return (
                      <div
                        key={item.id}
                        className={`rounded-xl border p-2 flex flex-col space-y-1.5 group transition-all relative ${
                          isNewItem
                            ? "border-indigo/80 bg-indigo/10 shadow-lg shadow-indigo/20 ring-1 ring-indigo/40"
                            : "border-ink-border bg-ink-elevated/70 hover:border-bone/20"
                        }`}
                      >
                        {/* New Curated Piece Pill Badge */}
                        {isNewItem && (
                          <div className="flex items-center gap-1 rounded-full bg-indigo px-1.5 py-0.5 text-[8.5px] font-mono font-semibold uppercase text-bone tracking-wide shadow-sm w-fit mb-0.5">
                            <Sparkles className="h-2.5 w-2.5 text-bone" />
                            <span>New Curated Piece</span>
                          </div>
                        )}

                        <div className="aspect-square w-full rounded-lg bg-ink overflow-hidden border border-ink-border/60 relative flex items-center justify-center">
                          {photo ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={photo}
                              alt={item.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                if (!target.dataset.triedFallback && photo && !photo.startsWith("http")) {
                                  target.dataset.triedFallback = "true";
                                  target.src = `${API_BASE_URL}${photo.startsWith("/") ? photo : `/${photo}`}`;
                                } else {
                                  target.style.display = "none";
                                }
                              }}
                            />
                          ) : (
                            /* Elegant Editorial Fallback for Discovered Item */
                            <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center bg-gradient-to-br from-ink-surface via-ink-elevated to-indigo/20 space-y-1">
                              <Sparkles className="h-5 w-5 text-indigo animate-pulse" />
                              <span className="text-[9px] font-mono text-bone-subtle uppercase tracking-wider">
                                {item.attributes?.type || "Curated"}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[11px] font-medium text-bone truncate leading-tight">
                            {item.name}
                          </p>
                          <p className="text-[10px] text-bone-subtle capitalize truncate">
                            {item.attributes?.color} &bull; {item.attributes?.type}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Discovered New Item Callout Banner */}
            {outfit.new_item && (
              <div className="rounded-2xl border border-indigo/50 bg-indigo/10 p-4 space-y-1.5 shadow-lg shadow-indigo/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-indigo animate-pulse" />
                    <span className="text-xs font-mono uppercase tracking-widest text-indigo font-semibold">
                      Curated Discovery Piece
                    </span>
                  </div>
                  <span className="text-[10px] font-mono uppercase tracking-wider bg-indigo/30 text-indigo-200 px-2.5 py-0.5 rounded-full border border-indigo/40">
                    {outfit.new_item.color} &bull; {outfit.new_item.category}
                  </span>
                </div>
                <h4 className="text-base font-serif font-medium text-bone">
                  {outfit.new_item.name}
                </h4>
                <p className="text-xs text-bone-muted leading-relaxed">
                  {outfit.new_item.description ||
                    "Curated specifically to fill a wardrobe gap and unlock new versatile pairings with your owned essentials."}
                </p>
              </div>
            )}

            {/* Editorial Reasoning Text */}
            <div className="rounded-2xl border border-ink-border/80 bg-ink-elevated/60 p-4 space-y-2">
              <div className="flex items-center gap-1.5 text-bone-subtle text-[11px] font-mono uppercase tracking-wider">
                <Sparkles className="h-3 w-3 text-indigo" />
                <span>Styling Rationale</span>
              </div>
              <p className="text-xs sm:text-sm text-bone font-serif leading-relaxed">
                {outfit.reasoning}
              </p>

              {/* Knowledge Base Rules Used */}
              {outfit.kb_rules_used && outfit.kb_rules_used.length > 0 && (
                <div className="pt-2 flex flex-wrap gap-1.5">
                  {outfit.kb_rules_used.map((rule) => (
                    <span
                      key={rule}
                      className="inline-flex items-center rounded-md border border-ink-border bg-ink/70 px-2 py-0.5 text-[10px] font-mono text-bone-subtle"
                    >
                      {rule.replace("kb_", "").replace("_", " ")}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Action Buttons: Accept / Reject */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              {/* Primary Accept Button */}
              <Button
                variant="indigo"
                size="lg"
                disabled={isSubmittingFeedback}
                onClick={onAccept}
                className="w-full sm:flex-1 py-5 rounded-2xl flex items-center justify-center gap-2 font-semibold text-sm shadow-xl shadow-indigo/25"
              >
                <Check className="h-4 w-4" />
                <span>Accept Outfit</span>
              </Button>

              {/* Secondary Reject Button */}
              <Button
                variant="outline"
                size="lg"
                disabled={isSubmittingFeedback}
                onClick={onReject}
                className="w-full sm:flex-1 py-5 rounded-2xl border-ink-border hover:bg-ink-elevated flex items-center justify-center gap-2 font-medium text-sm text-bone-muted hover:text-bone"
              >
                <X className="h-4 w-4" />
                <span>Pass & Clarify</span>
              </Button>
            </div>
          </div>
        )}

        {/* ---------------- STEP 2: REJECT MCQ CLARIFICATION ---------------- */}
        {isClarificationStep && clarificationOptions && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={springs.snappy}
            className="space-y-6 py-2"
          >
            <div className="space-y-1.5 text-center sm:text-left">
              <div className="flex items-center gap-2 text-indigo justify-center sm:justify-start">
                <HelpCircle className="h-4 w-4" />
                <span className="text-[11px] font-mono uppercase tracking-widest font-semibold">
                  Memory Calibration
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-serif text-bone font-medium">
                What felt off about this look?
              </h3>
              <p className="text-xs text-bone-muted max-w-md">
                Your feedback sharpens future recommendations and persists in your style memory.
              </p>
            </div>

            {/* Kinetic Spring Option Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {clarificationOptions.map((opt) => (
                <motion.button
                  key={opt.key}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={springs.snappy}
                  disabled={isSubmittingFeedback}
                  onClick={() => onClarify(opt.key)}
                  className="rounded-2xl border border-ink-border bg-ink-elevated/70 hover:bg-ink-elevated hover:border-indigo/50 p-4 text-left flex items-center justify-between text-bone transition-all group focus:outline-none focus:ring-1 focus:ring-indigo"
                >
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold block group-hover:text-indigo transition-colors capitalize">
                      {opt.label}
                    </span>
                    <span className="text-[10px] text-bone-subtle uppercase font-mono">
                      Category: {opt.key}
                    </span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-bone-subtle group-hover:text-indigo group-hover:translate-x-1 transition-all" />
                </motion.button>
              ))}
            </div>

            {/* Skip Option */}
            <div className="pt-2 flex justify-center sm:justify-start">
              <button
                onClick={() => onClarify("mood")}
                disabled={isSubmittingFeedback}
                className="text-xs text-bone-subtle hover:text-bone underline underline-offset-4 transition-colors font-mono"
              >
                Skip & Return to Wardrobe
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
