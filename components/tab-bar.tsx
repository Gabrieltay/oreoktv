"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ListMusic, ListPlus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

const TABS = [
  { href: "/", label: "Search", icon: Search },
  { href: "/playlists", label: "Playlists", icon: ListPlus },
  { href: "/queue", label: "Queue", icon: ListMusic },
] as const;

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav className="sticky top-0 z-20 flex items-center gap-1 border-b bg-background/95 px-2 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="flex flex-1 items-center">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                active
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </div>
      <ThemeToggle />
    </nav>
  );
}
