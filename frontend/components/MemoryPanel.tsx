"use client";

import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  ThumbsUp,
  ThumbsDown,
  Layers,
  Clock,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/useAppStore";
import {
  getMemory,
  getFeedbackLog,
  MemoryViewerResponse,
  FeedbackLogEntry,
  MemoryPreference,
} from "@/lib/api";
import { springs } from "@/lib/design-tokens";

interface MemoryPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatRelativeTime(isoStr?: string): string {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return isoStr;
  }
}

export function MemoryPanel({ open, onOpenChange }: MemoryPanelProps) {
  const { currentUser, memoryData, setMemoryData, feedbackLog, setFeedbackLog } =
    useAppStore();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMemoryAndLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [memRes, logsRes] = await Promise.all([
        getMemory(currentUser),
        getFeedbackLog(currentUser, 8),
      ]);
      setMemoryData(memRes);
      setFeedbackLog(logsRes);
    } catch (err: any) {
      console.error("Failed to load memory panel:", err);
      setError(err.message || "Failed to retrieve persistent memory data.");
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, setMemoryData, setFeedbackLog]);

  // Refresh when opened or when currentUser switches
  useEffect(() => {
    if (open) {
      fetchMemoryAndLogs();
    }
  }, [open, currentUser, fetchMemoryAndLogs]);

  const preferences: MemoryPreference[] = memoryData?.preferences || [];
  const logs: FeedbackLogEntry[] = feedbackLog || [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg bg-ink-surface border-ink-border text-bone p-0 flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Sticky Header */}
        <SheetHeader className="p-6 border-b border-ink-border bg-ink/50 backdrop-blur-md shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo">
              <Brain className="h-5 w-5" />
              <span className="text-[11px] font-mono uppercase tracking-widest font-semibold">
                Cognitive Style Memory
              </span>
            </div>
            <button
              onClick={fetchMemoryAndLogs}
              disabled={isLoading}
              className="text-bone-subtle hover:text-bone p-1 rounded-md transition-colors"
              title="Refresh Memory"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <SheetTitle className="text-xl sm:text-2xl font-serif text-bone font-medium">
            What I Know About You
          </SheetTitle>
          <SheetDescription className="text-xs text-bone-muted leading-relaxed">
            Persistent style memory for{" "}
            <span className="capitalize text-bone font-semibold">{currentUser}</span>,
            extracted from interactions, ratings, and fashion principles.
          </SheetDescription>

          {/* High-level Summary Pill */}
          {memoryData?.summary && !isLoading && (
            <div className="mt-2 text-[11px] font-mono px-3 py-1.5 rounded-lg border border-ink-border bg-ink-elevated/70 text-bone-muted flex items-center justify-between">
              <span>{memoryData.summary}</span>
              {memoryData.mood_flags > 0 && (
                <span className="text-amber-400 font-semibold">
                  Mood flags: {memoryData.mood_flags}
                </span>
              )}
            </div>
          )}
        </SheetHeader>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 select-none">
          {/* Error State */}
          {error && (
            <div className="rounded-2xl border border-red-900/40 bg-red-950/20 p-5 text-center space-y-3">
              <div className="h-10 w-10 mx-auto rounded-xl bg-red-900/30 text-red-400 flex items-center justify-center">
                <AlertCircle className="h-5 w-5" />
              </div>
              <p className="text-xs text-bone-muted">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchMemoryAndLogs}
                className="text-xs border-ink-border text-bone"
              >
                Retry Fetch
              </Button>
            </div>
          )}

          {/* Loading Skeletons */}
          {isLoading && (
            <div className="space-y-6">
              <div className="space-y-3">
                <Skeleton className="h-4 w-40 bg-ink-elevated" />
                <Skeleton className="h-20 w-full rounded-2xl bg-ink-elevated" />
                <Skeleton className="h-20 w-full rounded-2xl bg-ink-elevated" />
              </div>
              <div className="space-y-3 pt-4 border-t border-ink-border">
                <Skeleton className="h-4 w-32 bg-ink-elevated" />
                <Skeleton className="h-14 w-full rounded-xl bg-ink-elevated" />
                <Skeleton className="h-14 w-full rounded-xl bg-ink-elevated" />
              </div>
            </div>
          )}

          {!isLoading && !error && (
            <>
              {/* ---------------- SECTION A: LEARNED PREFERENCES ---------------- */}
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-bone-subtle">
                    <Sparkles className="h-3.5 w-3.5 text-indigo" />
                    <span>Learned Preferences ({preferences.length})</span>
                  </div>
                </div>

                {/* Empty State */}
                {preferences.length === 0 ? (
                  <div className="rounded-2xl border border-ink-border/80 bg-ink-elevated/40 p-6 text-center space-y-2">
                    <div className="h-10 w-10 mx-auto rounded-xl bg-ink-elevated flex items-center justify-center text-bone-subtle">
                      <HelpCircle className="h-5 w-5" />
                    </div>
                    <p className="text-xs text-bone-muted max-w-xs mx-auto leading-relaxed">
                      I’m still learning your style. Accept or reject a few outfits to get started.
                    </p>
                  </div>
                ) : (
                  /* Preferences List */
                  <div className="space-y-2.5">
                    {preferences.map((pref, i) => {
                      const isLikes = pref.direction === "likes";
                      const confidencePercent = Math.round(pref.confidence * 100);

                      return (
                        <motion.div
                          key={pref.label || i}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05, ...springs.gentle }}
                          className="rounded-2xl border border-ink-border bg-ink-elevated/70 p-4 flex flex-col space-y-2.5 hover:border-bone/20 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span
                                className={`p-1.5 rounded-lg border ${
                                  isLikes
                                    ? "bg-indigo/15 border-indigo/30 text-indigo"
                                    : "bg-red-950/30 border-red-800/40 text-red-400"
                                }`}
                              >
                                {isLikes ? (
                                  <ThumbsUp className="h-3.5 w-3.5" />
                                ) : (
                                  <ThumbsDown className="h-3.5 w-3.5" />
                                )}
                              </span>
                              <span className="text-xs font-semibold text-bone font-sans">
                                {pref.label}
                              </span>
                            </div>

                            {/* Strength Badge */}
                            <span
                              className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-md border ${
                                pref.strength === "strong"
                                  ? "bg-indigo text-bone border-indigo shadow-sm shadow-indigo/20 font-bold"
                                  : pref.strength === "moderate"
                                  ? "bg-ink-border/80 text-bone border-bone/20"
                                  : "bg-ink text-bone-subtle border-ink-border"
                              }`}
                            >
                              {pref.strength}
                            </span>
                          </div>

                          {/* Confidence Rating Bar & Evidence Count */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] font-mono text-bone-subtle">
                              <span>Confidence: {confidencePercent}%</span>
                              <span>Evidence: {pref.evidence} signal{pref.evidence > 1 ? "s" : ""}</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-ink overflow-hidden border border-ink-border/60">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  isLikes ? "bg-indigo" : "bg-red-500/80"
                                }`}
                                style={{ width: `${confidencePercent}%` }}
                              />
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ---------------- SECTION B: RECENT FEEDBACK LOG ---------------- */}
              <div className="space-y-3.5 pt-4 border-t border-ink-border/80">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-bone-subtle">
                    <Clock className="h-3.5 w-3.5 text-indigo" />
                    <span>Recent Activity ({logs.length})</span>
                  </div>
                </div>

                {logs.length === 0 ? (
                  <div className="rounded-xl border border-ink-border/80 bg-ink-elevated/40 p-4 text-center">
                    <p className="text-xs text-bone-subtle">No feedback interactions logged yet.</p>
                  </div>
                ) : (
                  /* Feedback Timeline Items */
                  <div className="space-y-2">
                    {logs.map((entry, idx) => {
                      const isAccept = entry.action === "accept";

                      return (
                        <div
                          key={idx}
                          className="rounded-xl border border-ink-border/80 bg-ink/70 p-3 flex flex-col space-y-1.5 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {isAccept ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-950/40 border border-emerald-700/40 text-emerald-400 text-[10px] font-mono uppercase font-semibold">
                                  <CheckCircle2 className="h-3 w-3" />
                                  <span>Accepted</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-950/40 border border-red-700/40 text-red-400 text-[10px] font-mono uppercase font-semibold">
                                  <XCircle className="h-3 w-3" />
                                  <span>Passed</span>
                                </span>
                              )}

                              {entry.clarification && (
                                <span className="text-[10px] font-mono text-bone-subtle bg-ink-elevated px-2 py-0.5 rounded border border-ink-border">
                                  Focus: {entry.clarification}
                                </span>
                              )}
                            </div>

                            <span className="text-[10px] text-bone-subtle font-mono">
                              {formatRelativeTime(entry.timestamp)}
                            </span>
                          </div>

                          {/* Reasoning or Attributes */}
                          <div className="text-[11px] text-bone-muted line-clamp-2 font-serif">
                            {entry.reasoning || (entry.item_ids ? `Outfit with items: ${entry.item_ids.join(", ")}` : "")}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer Brand Banner */}
        <div className="p-4 border-t border-ink-border bg-ink/90 shrink-0 flex items-center justify-between text-[11px] text-bone-subtle font-mono">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-indigo" />
            <span>Hindsight Vectorize Memory</span>
          </div>
          <span className="capitalize">{currentUser}</span>
        </div>
      </SheetContent>
    </Sheet>
  );
}
