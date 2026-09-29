import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FitMemory | AI Wardrobe Assistant with Persistent Memory",
  description: "AI wardrobe assistant with persistent memory, powered by Hindsight and Groq.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#1A1815",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} font-sans bg-ink text-bone min-h-screen flex flex-col selection:bg-indigo selection:text-bone`}
      >
        <Providers>
          {/* Subtle Film Grain Noise Overlay */}
          <div className="noise-overlay" aria-hidden="true" />
          
          {/* Safe-Area Wrapper */}
          <div className="flex-1 flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
