"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Toast = { id: number; message: string; tone: "success" | "error" };

let nextId = 1;
const listeners = new Set<(t: Toast) => void>();

export function toast(message: string, tone: Toast["tone"] = "success") {
  const t = { id: nextId++, message, tone };
  listeners.forEach((l) => l(t));
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const listener = (t: Toast) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, 2000);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(1rem,env(safe-area-inset-top))] z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto rounded-lg px-4 py-2 text-sm font-medium shadow-lg",
            t.tone === "success"
              ? "bg-foreground text-background"
              : "bg-destructive text-destructive-foreground",
          )}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
