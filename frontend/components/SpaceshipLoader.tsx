"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, AlertCircle, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SpaceshipLoaderProps {
  isLoading: boolean;
  error?: string | null;
  onRetry?: () => void;
  onCancel?: () => void;
}

interface Star {
  x: number;
  y: number;
  radius: number;
  speed: number;
  color: string;
  phase: number;
  isNear: boolean;
}

interface Bullet {
  x: number;
  y: number;
}

interface AsteroidVertex {
  angle: number;
  radius: number;
}

interface Asteroid {
  x: number;
  y: number;
  baseRadius: number;
  speed: number;
  rotation: number;
  rotSpeed: number;
  vertices: AsteroidVertex[];
  craterOffset: { x: number; y: number; r: number };
}

interface ExplosionParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

interface ScorePopup {
  x: number;
  y: number;
  text: string;
  life: number;
  maxLife: number;
}

function createPolyhedralAsteroid(x: number, y: number, width: number): Asteroid {
  const baseRadius = 10 + Math.random() * 9;
  const numVertices = Math.floor(6 + Math.random() * 3); // 6 to 8 vertices
  const vertices: AsteroidVertex[] = [];

  for (let i = 0; i < numVertices; i++) {
    const angle = (i / numVertices) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
    const radius = baseRadius * (0.75 + Math.random() * 0.45);
    vertices.push({ angle, radius });
  }

  // Sort vertices by angle for clean convex/polyhedral polygon winding
  vertices.sort((a, b) => a.angle - b.angle);

  return {
    x: x ?? Math.random() * (width - 30) + 15,
    y: y ?? Math.random() * -180,
    baseRadius,
    speed: 1.1 + Math.random() * 1.6,
    rotation: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.035,
    vertices,
    craterOffset: {
      x: (Math.random() - 0.5) * (baseRadius * 0.6),
      y: (Math.random() - 0.5) * (baseRadius * 0.6),
      r: 2.5 + Math.random() * 3,
    },
  };
}

export function SpaceshipLoader({
  isLoading,
  error,
  onRetry,
  onCancel,
}: SpaceshipLoaderProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  // 11-second progress countdown tracker
  useEffect(() => {
    if (!isLoading || error) {
      setSecondsElapsed(0);
      return;
    }
    const timer = setInterval(() => {
      setSecondsElapsed((prev) => Math.min(12, prev + 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [isLoading, error]);

  useEffect(() => {
    if (!isLoading || error) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle High-DPI screens for razor-sharp vector rendering
    const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    const logicalWidth = 300;
    const logicalHeight = 320;
    canvas.width = logicalWidth * dpr;
    canvas.height = logicalHeight * dpr;
    ctx.scale(dpr, dpr);

    let animId: number;
    let shipX = logicalWidth / 2;
    let bullets: Bullet[] = [];
    let asteroids: Asteroid[] = [];
    let explosions: ExplosionParticle[] = [];
    let popups: ScorePopup[] = [];
    let keys: Record<string, boolean> = {};
    let lastShoot = 0;
    let currentScore = 0;

    // 1. Initialize Parallax Stars (40 distant + 20 near)
    const stars: Star[] = [];
    // 40 Distant slow stars (Bone white, subtle drift)
    for (let i = 0; i < 40; i++) {
      stars.push({
        x: Math.random() * logicalWidth,
        y: Math.random() * logicalHeight,
        radius: 0.75 + Math.random() * 0.5,
        speed: 0.35 + Math.random() * 0.45,
        color: "rgba(245, 241, 232, 0.35)",
        phase: Math.random() * Math.PI * 2,
        isNear: false,
      });
    }
    // 20 Near faster stars (Electric cyan/indigo tint)
    for (let i = 0; i < 20; i++) {
      stars.push({
        x: Math.random() * logicalWidth,
        y: Math.random() * logicalHeight,
        radius: 1.4 + Math.random() * 0.9,
        speed: 1.2 + Math.random() * 1.1,
        color: i % 2 === 0 ? "rgba(0, 229, 255, 0.7)" : "rgba(129, 140, 248, 0.75)",
        phase: Math.random() * Math.PI * 2,
        isNear: true,
      });
    }

    // 2. Initialize Polyhedral Asteroids (5 initial space rocks)
    for (let i = 0; i < 5; i++) {
      asteroids.push(createPolyhedralAsteroid(
        Math.random() * (logicalWidth - 30) + 15,
        Math.random() * -200,
        logicalWidth
      ));
    }

    // Controls
    const onKeyDown = (e: KeyboardEvent) => {
      keys[e.key] = true;
      if (e.key === " " || e.key === "ArrowUp") e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.key] = false;
    };
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      shipX = Math.max(22, Math.min(logicalWidth - 22, e.clientX - rect.left));
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const rect = canvas.getBoundingClientRect();
        shipX = Math.max(22, Math.min(logicalWidth - 22, e.touches[0].clientX - rect.left));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("touchmove", onTouchMove);

    // Main 60 FPS Vector Game Loop
    const loop = (now: number) => {
      // ---------------- SHIP INPUT & MOVEMENT ----------------
      if (keys["ArrowLeft"] || keys["a"] || keys["A"]) shipX -= 4.5;
      if (keys["ArrowRight"] || keys["d"] || keys["D"]) shipX += 4.5;
      shipX = Math.max(22, Math.min(logicalWidth - 22, shipX));

      const sy = logicalHeight - 32;

      // ---------------- TWIN BLASTER FIRING ----------------
      // Auto-shoot every 220ms or on Space/ArrowUp key
      if (now - lastShoot > 220 || keys[" "] || keys["ArrowUp"]) {
        // Fire twin parallel bolts from left and right wingtips
        bullets.push({ x: shipX - 17, y: sy - 12 });
        bullets.push({ x: shipX + 17, y: sy - 12 });
        lastShoot = now;
      }

      // ---------------- UPDATE BULLETS ----------------
      bullets.forEach((b) => (b.y -= 7.5));
      bullets = bullets.filter((b) => b.y > -10);

      // ---------------- UPDATE ASTEROIDS ----------------
      asteroids.forEach((a) => {
        a.y += a.speed;
        a.rotation += a.rotSpeed;
        if (a.y > logicalHeight + 30) {
          a.y = -30;
          a.x = Math.random() * (logicalWidth - 30) + 15;
        }
      });

      // ---------------- UPDATE PARTICLES ----------------
      for (let i = explosions.length - 1; i >= 0; i--) {
        const p = explosions[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.93;
        p.vy *= 0.93;
        p.life++;
        if (p.life >= p.maxLife) {
          explosions.splice(i, 1);
        }
      }

      // ---------------- UPDATE SCORE POPUPS ----------------
      for (let i = popups.length - 1; i >= 0; i--) {
        const pop = popups[i];
        pop.y -= 0.85;
        pop.life++;
        if (pop.life >= pop.maxLife) {
          popups.splice(i, 1);
        }
      }

      // ---------------- COLLISION DETECTION ----------------
      const SPARK_COLORS = [
        "#FF7A00", // Electric Orange
        "#FFD600", // Solar Yellow
        "#A855F7", // Neon Purple
        "#3B4CCF", // Electric Indigo
        "#00E5FF", // Neon Cyan
        "#FFFFFF", // Pure White Core
      ];

      for (let bi = bullets.length - 1; bi >= 0; bi--) {
        const b = bullets[bi];
        if (!b) continue;

        for (let ai = asteroids.length - 1; ai >= 0; ai--) {
          const a = asteroids[ai];
          if (!a) continue;

          const dist = Math.hypot(b.x - a.x, b.y - a.y);
          if (dist < a.baseRadius + 5) {
            // Remove the bullet
            bullets.splice(bi, 1);

            // Spawn 10 to 14 explosive spark particles
            const particleCount = 10 + Math.floor(Math.random() * 5);
            for (let pi = 0; pi < particleCount; pi++) {
              const angle = Math.random() * Math.PI * 2;
              const speed = 1.4 + Math.random() * 3.6;
              const color = SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)];
              explosions.push({
                x: a.x + (Math.random() - 0.5) * 6,
                y: a.y + (Math.random() - 0.5) * 6,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color,
                size: 1.8 + Math.random() * 2.2,
                life: 0,
                maxLife: 20 + Math.floor(Math.random() * 8), // ~350ms
              });
            }

            // Spawn floating "+10" score text
            popups.push({
              x: a.x - 10,
              y: a.y - 4,
              text: "+10",
              life: 0,
              maxLife: 32,
            });

            // Reset asteroid position to top
            a.y = -35;
            a.x = Math.random() * (logicalWidth - 30) + 15;
            a.speed = 1.1 + Math.random() * 1.6;

            currentScore += 10;
            setScore(currentScore);
            break;
          }
        }
      }

      // ==================== RENDERING ====================
      // 1. Deep Space Void Background
      ctx.fillStyle = "#12100E";
      ctx.fillRect(0, 0, logicalWidth, logicalHeight);

      // 2. Parallax Starfield
      stars.forEach((star) => {
        star.y += star.speed;
        if (star.y > logicalHeight) {
          star.y = 0;
          star.x = Math.random() * logicalWidth;
        }

        ctx.fillStyle = star.color;
        if (star.isNear) {
          ctx.shadowColor = star.color;
          ctx.shadowBlur = 4;
        } else {
          ctx.shadowBlur = 0;
        }

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.shadowBlur = 0;

      // 3. Render Explosions (Colorful glowing sparks)
      explosions.forEach((p) => {
        const alpha = Math.max(0, 1 - p.life / p.maxLife);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // 4. Render Asteroids (Faceted polyhedral rocks with crater accents)
      asteroids.forEach((a) => {
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(a.rotation);

        // Dark graphite body fill
        ctx.beginPath();
        a.vertices.forEach((v, idx) => {
          const vx = Math.cos(v.angle) * v.radius;
          const vy = Math.sin(v.angle) * v.radius;
          if (idx === 0) ctx.moveTo(vx, vy);
          else ctx.lineTo(vx, vy);
        });
        ctx.closePath();

        ctx.fillStyle = "#24211D";
        ctx.fill();

        // Warm bone polyhedral perimeter outline
        ctx.strokeStyle = "#8E8A82";
        ctx.lineWidth = 1.4;
        ctx.stroke();

        // Internal facet vector lines
        ctx.strokeStyle = "rgba(142, 138, 130, 0.4)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(
          Math.cos(a.vertices[0].angle) * a.vertices[0].radius,
          Math.sin(a.vertices[0].angle) * a.vertices[0].radius
        );
        ctx.moveTo(0, 0);
        ctx.lineTo(
          Math.cos(a.vertices[Math.floor(a.vertices.length / 2)].angle) *
            a.vertices[Math.floor(a.vertices.length / 2)].radius,
          Math.sin(a.vertices[Math.floor(a.vertices.length / 2)].angle) *
            a.vertices[Math.floor(a.vertices.length / 2)].radius
        );
        ctx.stroke();

        // Neon Crater Accent
        ctx.beginPath();
        ctx.arc(a.craterOffset.x, a.craterOffset.y, a.craterOffset.r, 0, Math.PI * 2);
        ctx.fillStyle = "#1B1815";
        ctx.fill();
        ctx.strokeStyle = "rgba(0, 229, 255, 0.45)"; // Cyan neon rim
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();
      });

      // 5. Render Twin Blaster Lasers (Neon cyan bolts with sharp glowing core)
      bullets.forEach((b) => {
        ctx.save();
        ctx.shadowColor = "#00E5FF";
        ctx.shadowBlur = 10;

        // Outer cyan laser bolt
        ctx.fillStyle = "#00E5FF";
        ctx.fillRect(b.x - 1.5, b.y - 10, 3, 12);

        // Core white-hot laser energy
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(b.x - 0.75, b.y - 8, 1.5, 9);
        ctx.restore();
      });

      // 6. Render Starfighter Player Ship (Star Wars X-Wing / Interceptor)
      ctx.save();

      // --- Twin Engine Thruster Flame Exhausts ---
      const flameFlicker = Math.sin(now * 0.06) * 3 + Math.random() * 2.5;
      const flameLen = 9 + flameFlicker;

      [-6, 6].forEach((ox) => {
        ctx.save();
        ctx.shadowColor = "#00F0FF";
        ctx.shadowBlur = 10;

        // Outer cyan engine plume
        ctx.fillStyle = "#00F0FF";
        ctx.beginPath();
        ctx.moveTo(shipX + ox - 2.5, sy + 7);
        ctx.lineTo(shipX + ox + 2.5, sy + 7);
        ctx.lineTo(shipX + ox, sy + 7 + flameLen);
        ctx.closePath();
        ctx.fill();

        // Inner white-hot thruster jet
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.moveTo(shipX + ox - 1.2, sy + 7);
        ctx.lineTo(shipX + ox + 1.2, sy + 7);
        ctx.lineTo(shipX + ox, sy + 7 + flameLen * 0.65);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      });

      // --- Left S-Foil Wing ---
      ctx.fillStyle = "#EAE6DE";
      ctx.beginPath();
      ctx.moveTo(shipX - 5, sy - 2);
      ctx.lineTo(shipX - 18, sy + 2);
      ctx.lineTo(shipX - 17, sy + 7);
      ctx.lineTo(shipX - 6, sy + 7);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#C4BEB2";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Wing chevron accent (Electric indigo)
      ctx.fillStyle = "#3B4CCF";
      ctx.beginPath();
      ctx.moveTo(shipX - 10, sy + 1);
      ctx.lineTo(shipX - 15, sy + 3);
      ctx.lineTo(shipX - 14, sy + 5);
      ctx.lineTo(shipX - 9, sy + 3);
      ctx.closePath();
      ctx.fill();

      // --- Right S-Foil Wing ---
      ctx.fillStyle = "#EAE6DE";
      ctx.beginPath();
      ctx.moveTo(shipX + 5, sy - 2);
      ctx.lineTo(shipX + 18, sy + 2);
      ctx.lineTo(shipX + 17, sy + 7);
      ctx.lineTo(shipX + 6, sy + 7);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#C4BEB2";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Wing chevron accent (Electric indigo)
      ctx.fillStyle = "#3B4CCF";
      ctx.beginPath();
      ctx.moveTo(shipX + 10, sy + 1);
      ctx.lineTo(shipX + 15, sy + 3);
      ctx.lineTo(shipX + 14, sy + 5);
      ctx.lineTo(shipX + 9, sy + 3);
      ctx.closePath();
      ctx.fill();

      // --- Dual Wingtip Blaster Cannons ---
      [-17.5, 17.5].forEach((wx) => {
        // Cannon barrel
        ctx.fillStyle = "#5A544A";
        ctx.fillRect(shipX + wx - 1, sy - 12, 2, 17);

        // Blaster muzzle glow
        ctx.save();
        ctx.shadowColor = "#00E5FF";
        ctx.shadowBlur = 6;
        ctx.fillStyle = "#00E5FF";
        ctx.fillRect(shipX + wx - 1.5, sy - 13, 3, 2);
        ctx.restore();
      });

      // --- Central Fuselage (Sleek aerodynamic nosecone) ---
      ctx.fillStyle = "#F5F1E8";
      ctx.beginPath();
      ctx.moveTo(shipX, sy - 18);
      ctx.lineTo(shipX + 5.5, sy + 4);
      ctx.lineTo(shipX + 5, sy + 8);
      ctx.lineTo(shipX - 5, sy + 8);
      ctx.lineTo(shipX - 5.5, sy + 4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#C4BEB2";
      ctx.lineWidth = 1;
      ctx.stroke();

      // --- Dark Graphite Cockpit Canopy ---
      ctx.fillStyle = "#1E2233";
      ctx.beginPath();
      ctx.moveTo(shipX, sy - 10);
      ctx.lineTo(shipX + 2.5, sy - 3);
      ctx.lineTo(shipX - 2.5, sy - 3);
      ctx.closePath();
      ctx.fill();

      // Cyan HUD glare in canopy
      ctx.strokeStyle = "rgba(0, 229, 255, 0.7)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(shipX - 1.2, sy - 7);
      ctx.lineTo(shipX + 1.2, sy - 4);
      ctx.stroke();

      ctx.restore();

      // 7. Render Floating "+10" Score Popups (Glowing Gold)
      popups.forEach((pop) => {
        const popAlpha = Math.max(0, 1 - pop.life / pop.maxLife);
        ctx.save();
        ctx.globalAlpha = popAlpha;
        ctx.font = "bold 13px 'Courier New', Courier, monospace";
        ctx.fillStyle = "#FFD600";
        ctx.shadowColor = "#FFD600";
        ctx.shadowBlur = 8;
        ctx.fillText(pop.text, pop.x, pop.y);
        ctx.restore();
      });

      // 8. Arcade HUD Overlay (Top-Left Badge)
      ctx.save();
      // HUD Badge background
      ctx.fillStyle = "rgba(0, 229, 255, 0.12)";
      ctx.strokeStyle = "rgba(0, 229, 255, 0.4)";
      ctx.lineWidth = 1;
      const hx = 10, hy = 10, hw = 84, hh = 20;
      ctx.beginPath();
      ctx.rect(hx, hy, hw, hh);
      ctx.fill();
      ctx.stroke();

      // HUD text
      ctx.font = "bold 10px 'Courier New', Courier, monospace";
      ctx.fillStyle = "#00E5FF";
      ctx.shadowColor = "#00E5FF";
      ctx.shadowBlur = 5;
      ctx.fillText(`KILLS: ${currentScore / 10}`, hx + 8, hy + 14);
      ctx.restore();

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("touchmove", onTouchMove);
    };
  }, [isLoading, error]);

  if (!isLoading && !error) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-md select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.94 }}
        className="w-full max-w-sm rounded-3xl border border-ink-border bg-ink-surface p-6 shadow-2xl flex flex-col items-center text-bone space-y-4 relative"
      >
        {onCancel && (
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 p-1.5 rounded-full text-bone-subtle hover:text-bone hover:bg-ink-elevated transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* Error State */}
        {error ? (
          <div className="py-6 flex flex-col items-center text-center space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-red-900/20 border border-red-800/40 text-red-400 flex items-center justify-center">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-bone text-base">Stylist Error</h3>
              <p className="text-xs text-bone-muted max-w-xs">{error}</p>
            </div>
            {onRetry && (
              <Button
                variant="default"
                size="sm"
                onClick={onRetry}
                className="bg-bone text-ink hover:bg-bone-muted gap-2 text-xs font-semibold px-5 py-2.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Try Again</span>
              </Button>
            )}
          </div>
        ) : (
          /* Mini-game Active State */
          <>
            <div className="flex items-center justify-between w-full px-2 text-xs font-mono">
              <div className="flex items-center gap-1.5 text-indigo">
                <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                <span className="font-semibold tracking-wide uppercase text-[11px]">
                  AI Stylist Active
                </span>
              </div>
              <div className="text-bone-muted font-mono">
                SCORE: <span className="font-semibold text-bone">{score}</span>
              </div>
            </div>

            {/* Canvas Game Box */}
            <div className="relative rounded-2xl border border-ink-border/80 bg-ink overflow-hidden shadow-inner w-[300px] h-[320px]">
              <canvas
                ref={canvasRef}
                style={{ width: "300px", height: "320px" }}
                className="cursor-crosshair block"
              />
            </div>

            {/* Status Captions & Progress Tracker */}
            <div className="w-full text-center space-y-2.5">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-bone font-serif">
                  Charting your next look…
                </p>
                <p className="text-[11px] text-bone-subtle">
                  Drag or use Arrow keys / Spacebar to shoot
                </p>
              </div>

              {/* Progress Bar & Countdown */}
              <div className="w-full space-y-1.5 px-1">
                <div className="flex items-center justify-between text-[11px] font-mono text-bone-subtle">
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo animate-ping" />
                    <span>AI Stylist synthesizing lookbook…</span>
                  </span>
                  <span className="text-indigo font-semibold font-mono">
                    {Math.max(0, 11 - secondsElapsed)}s
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-ink-elevated overflow-hidden border border-ink-border/80">
                  <motion.div
                    className="h-full bg-gradient-to-r from-indigo via-cyan-400 to-indigo"
                    initial={{ width: "0%" }}
                    animate={{
                      width: `${Math.min(100, Math.floor((secondsElapsed / 11) * 100))}%`,
                    }}
                    transition={{ ease: "linear", duration: 0.6 }}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
