"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { History, ListMusic, ListPlus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlaylist } from "@/lib/queries";
import { ThemeToggle } from "@/components/theme-toggle";
import { SettingsButton } from "@/components/settings-sheet";

const TABS = [
  { href: "/", label: "Search", icon: Search },
  { href: "/playlists", label: "Playlists", icon: ListPlus },
  { href: "/recent", label: "Recent", icon: History },
  { href: "/queue", label: "Queue", icon: ListMusic },
] as const;

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav className="sticky top-0 z-20 border-b bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="flex items-center justify-end gap-1 px-2 pt-1">
        <KtvHealthDot />
        <SettingsButton />
        <ThemeToggle />
      </div>
      <div className="flex items-center gap-1 px-2 pb-2">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-2 text-sm font-semibold transition-colors",
                active
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * Reuses the playlist poll (3 s) as a heartbeat — no extra network. Red
 * when the latest /PlaylistServlet attempt failed, green when it just
 * succeeded, grey before the first response.
 */
function KtvHealthDot() {
  const { isError, data, error } = usePlaylist();
  const status = isError ? "down" : data ? "up" : "pending";
  const title =
    status === "down"
      ? `KTV unreachable${error instanceof Error ? `: ${error.message}` : ""}`
      : status === "up"
        ? "KTV reachable"
        : "Checking KTV…";
  return (
    <span
      role="status"
      aria-label={title}
      title={title}
      className={cn(
        "mx-2 h-2 w-2 shrink-0 rounded-full transition-colors",
        status === "down"
          ? "bg-destructive shadow-[0_0_6px] shadow-destructive/60"
          : status === "up"
            ? "bg-emerald-500"
            : "bg-muted-foreground/40",
      )}
    />
  );
}
