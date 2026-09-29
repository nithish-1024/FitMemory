"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Tag, Sparkles, Layers, ShieldCheck } from "lucide-react";
import { WardrobeItem, API_BASE_URL } from "@/lib/api";
import { springs } from "@/lib/design-tokens";
import { Button } from "@/components/ui/button";

interface ItemDetailCardProps {
  item: WardrobeItem | null;
  onClose: () => void;
}

export function ItemDetailCard({ item, onClose }: ItemDetailCardProps) {
  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!item) return null;

  const photoUrl = item.photo.startsWith("http")
    ? item.photo
    : item.photo.startsWith("/")
    ? item.photo
    : `/${item.photo}`;

  const attributes = item.attributes || {};

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end sm:justify-center p-0 sm:p-6 pointer-events-auto">
        {/* Backdrop Overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={onClose}
          className="fixed inset-0 bg-ink/75 backdrop-blur-md cursor-pointer -z-10"
          aria-hidden="true"
        />

        {/* Detail Card Container */}
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.95 }}
          transition={springs.snappy}
          className="w-full sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-ink-border bg-ink-surface shadow-2xl p-6 sm:p-8 flex flex-col space-y-6 text-bone relative"
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full border border-ink-border bg-ink-elevated text-bone-muted hover:text-bone hover:border-bone/30 transition-all focus:outline-none"
            aria-label="Close item detail"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Item Category Header */}
          <div className="flex items-center gap-2 text-indigo">
            <Sparkles className="h-4 w-4" />
            <span className="text-[11px] font-mono uppercase tracking-widest font-semibold">
              {attributes.type || "Wardrobe Item"} &bull; {item.id}
            </span>
          </div>

          {/* Large Item Photo Preview */}
          <div className="relative w-full aspect-[4/5] max-h-72 rounded-2xl border border-ink-border/80 bg-ink-elevated overflow-hidden flex items-center justify-center shadow-inner group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoUrl}
              alt={item.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (!target.dataset.triedFallback && !photoUrl.startsWith("http")) {
                  target.dataset.triedFallback = "true";
                  target.src = `${API_BASE_URL}${photoUrl.startsWith("/") ? photoUrl : `/${photoUrl}`}`;
                } else {
                  target.style.display = "none";
                }
              }}
            />
            {/* Soft Ambient Inner Gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-ink-surface/80 via-transparent to-transparent pointer-events-none" />
          </div>

          {/* Item Name */}
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-serif font-medium tracking-tight text-bone">
              {item.name}
            </h2>
            <p className="text-xs text-bone-muted font-sans capitalize">
              {attributes.palette ? `${attributes.palette.replace("_", " ")} palette` : "Classic wardrobe staple"}
            </p>
          </div>

          {/* Attributes Matrix */}
          <div className="space-y-2.5 pt-1 border-t border-ink-border/60">
            <span className="text-[10px] uppercase font-mono tracking-wider text-bone-subtle">
              Styling Attributes
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {/* Color */}
              <div className="rounded-xl border border-ink-border/80 bg-ink-elevated/60 p-3 flex flex-col space-y-1">
                <span className="text-[10px] text-bone-subtle uppercase">Color</span>
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full border border-bone/20 shrink-0"
                    style={{
                      backgroundColor:
                        attributes.color === "white"
                          ? "#FFFFFF"
                          : attributes.color === "black"
                          ? "#111111"
                          : attributes.color === "indigo"
                          ? "#3B4CCF"
                          : attributes.color === "navy"
                          ? "#1E2A4A"
                          : attributes.color === "beige"
                          ? "#D2B48C"
                          : attributes.color === "cream"
                          ? "#F5F5DC"
                          : attributes.color === "crimson"
                          ? "#DC143C"
                          : attributes.color === "emerald"
                          ? "#10B981"
                          : attributes.color === "charcoal"
                          ? "#333333"
                          : "#888888",
                    }}
                  />
                  <span className="font-medium capitalize text-bone">{attributes.color || "—"}</span>
                </div>
              </div>

              {/* Fit */}
              <div className="rounded-xl border border-ink-border/80 bg-ink-elevated/60 p-3 flex flex-col space-y-1">
                <span className="text-[10px] text-bone-subtle uppercase">Fit Silhouette</span>
                <span className="font-medium capitalize text-bone">{attributes.fit ? attributes.fit.replace("_", " ") : "—"}</span>
              </div>

              {/* Texture */}
              <div className="rounded-xl border border-ink-border/80 bg-ink-elevated/60 p-3 flex flex-col space-y-1">
                <span className="text-[10px] text-bone-subtle uppercase">Texture</span>
                <span className="font-medium capitalize text-bone">{attributes.texture ? attributes.texture.replace("_", " ") : "—"}</span>
              </div>

              {/* Formality Scale */}
              <div className="rounded-xl border border-ink-border/80 bg-ink-elevated/60 p-3 flex flex-col space-y-1">
                <span className="text-[10px] text-bone-subtle uppercase">Formality Level</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-bone">{attributes.formality ?? 3}</span>
                  <span className="text-bone-subtle text-[11px]">/ 5</span>
                  <div className="flex items-center gap-0.5 ml-1">
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <span
                        key={lvl}
                        className={`h-1.5 w-1.5 rounded-full ${
                          lvl <= (attributes.formality ?? 3)
                            ? "bg-indigo"
                            : "bg-ink-border"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="w-full text-xs font-medium border-ink-border hover:bg-ink-elevated text-bone-muted hover:text-bone py-3"
            >
              Back to Wardrobe
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
