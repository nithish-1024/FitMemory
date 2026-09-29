"use client";

import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-ink-surface group-[.toaster]:text-bone group-[.toaster]:border-ink-border group-[.toaster]:shadow-2xl group-[.toaster]:rounded-xl font-sans",
          description: "group-[.toast]:text-bone-muted",
          actionButton:
            "group-[.toast]:bg-indigo group-[.toast]:text-bone font-medium",
          cancelButton:
            "group-[.toast]:bg-ink-elevated group-[.toast]:text-bone-muted",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
