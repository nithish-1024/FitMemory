"use client";

import dynamic from "next/dynamic";
import { TopBar } from "@/components/TopBar";

const LandingScene = dynamic(
  () => import("@/components/3d/LandingScene").then((mod) => mod.LandingScene),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[calc(100vh-64px)] flex items-center justify-center bg-ink">
        <div className="flex flex-col items-center space-y-3">
          <div className="h-8 w-8 rounded-full border-2 border-indigo border-t-transparent animate-spin" />
          <p className="text-[11px] font-mono text-bone-subtle tracking-wider uppercase">
            Initializing Scene...
          </p>
        </div>
      </div>
    ),
  }
);

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-ink text-bone relative overflow-hidden select-none">
      {/* Top Bar Header */}
      <TopBar />

      {/* 3D Landing Scene Stage */}
      <main className="flex-1 w-full relative">
        <LandingScene />
      </main>
    </div>
  );
}
