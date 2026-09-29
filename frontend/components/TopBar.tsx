"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Brain } from "lucide-react";
import { useAppStore, UserType } from "@/store/useAppStore";
import { springs } from "@/lib/design-tokens";
import { Button } from "@/components/ui/button";
import { MemoryPanel } from "@/components/MemoryPanel";

export function TopBar() {
  const { currentUser, setUser } = useAppStore();
  const [sheetOpen, setSheetOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-ink-border/60 bg-ink/80 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between transition-colors">
      {/* Left: FitMemory Wordmark */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-indigo shadow-lg shadow-indigo/50 animate-pulse" />
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-bone font-sans select-none">
            FitMemory
          </h1>
        </div>
        <span className="hidden sm:inline-flex items-center rounded-full border border-ink-border bg-ink-surface px-2.5 py-0.5 text-[10px] font-medium tracking-wide uppercase text-bone-subtle">
          Persistent AI Stylist
        </span>
      </div>

      {/* Center: User Switcher */}
      <div className="flex items-center rounded-xl border border-ink-border bg-ink-surface p-1">
        {(["arjun", "sara"] as UserType[]).map((user) => {
          const isActive = currentUser === user;
          return (
            <button
              key={user}
              onClick={() => setUser(user)}
              className="relative px-3.5 py-1 text-xs font-medium capitalize transition-colors duration-200 z-10 select-none text-bone"
            >
              {isActive && (
                <motion.div
                  layoutId="activeUserIndicator"
                  className="absolute inset-0 rounded-lg bg-ink-elevated border border-bone/15 shadow-sm -z-10"
                  transition={springs.snappy}
                />
              )}
              <span
                className={
                  isActive
                    ? "text-bone font-semibold"
                    : "text-bone-subtle hover:text-bone-muted"
                }
              >
                {user}
              </span>
            </button>
          );
        })}
      </div>

      {/* Right: What I Know About You button & Memory Panel Sheet */}
      <div className="flex items-center space-x-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSheetOpen(true)}
          className="flex items-center gap-2 border-ink-border hover:border-indigo/40 hover:bg-ink-elevated group"
        >
          <Brain className="h-4 w-4 text-indigo transition-transform group-hover:scale-110" />
          <span className="hidden sm:inline text-xs font-medium text-bone">
            What I Know About You
          </span>
          <span className="sm:hidden text-xs font-medium text-bone">
            Memory
          </span>
        </Button>

        <MemoryPanel open={sheetOpen} onOpenChange={setSheetOpen} />
      </div>
    </header>
  );
}
