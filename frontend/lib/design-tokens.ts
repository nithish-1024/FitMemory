/**
 * FitMemory Design Tokens
 * 
 * Strict palette:
 * - Background / ink: #1A1815
 * - Bone / cream: #F5F1E8
 * - Accent indigo: #3B4CCF
 * - Dark moody, warm soft lighting, fashion-editorial aesthetic
 */

export const colors = {
  ink: {
    DEFAULT: "#1A1815",
    surface: "#221F1B",
    elevated: "#2C2823",
    border: "#3D3831",
    subtleBorder: "rgba(245, 241, 232, 0.08)",
  },
  bone: {
    DEFAULT: "#F5F1E8",
    muted: "#D0C9BE",
    subtle: "#9C958A",
    dim: "rgba(245, 241, 232, 0.45)",
  },
  indigo: {
    DEFAULT: "#3B4CCF",
    hover: "#4D5DE0",
    glow: "rgba(59, 76, 207, 0.25)",
    muted: "rgba(59, 76, 207, 0.15)",
  },
} as const;

export const springs = {
  gentle: {
    type: "spring" as const,
    stiffness: 240,
    damping: 24,
  },
  snappy: {
    type: "spring" as const,
    stiffness: 380,
    damping: 28,
  },
  bouncy: {
    type: "spring" as const,
    stiffness: 420,
    damping: 18,
  },
  smooth: {
    type: "spring" as const,
    stiffness: 180,
    damping: 26,
    mass: 0.9,
  },
} as const;

export const radii = {
  sm: "6px",
  md: "10px",
  lg: "16px",
  xl: "22px",
  full: "9999px",
} as const;
