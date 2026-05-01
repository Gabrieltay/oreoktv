"use client";

import { createContext, useContext } from "react";

/**
 * Runtime-resolved values that the browser needs but can't read directly.
 * The root layout (server component) resolves these from settings.json /
 * env vars and passes them down via this provider so client components
 * always render with the current host.
 *
 * After the user saves new settings, the form calls router.refresh() so
 * the server tree re-runs and a new value flows in here.
 */

interface RuntimeConfig {
  imageBase: string;
}

const RuntimeConfigContext = createContext<RuntimeConfig | null>(null);

export function RuntimeConfigProvider({
  value,
  children,
}: {
  value: RuntimeConfig;
  children: React.ReactNode;
}) {
  return <RuntimeConfigContext.Provider value={value}>{children}</RuntimeConfigContext.Provider>;
}

export function useImageBase(): string {
  const ctx = useContext(RuntimeConfigContext);
  if (!ctx) throw new Error("useImageBase must be used within RuntimeConfigProvider");
  return ctx.imageBase;
}
