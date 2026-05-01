"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { SearchMode } from "@/components/search-mode-toggle";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mode?: SearchMode;
  onModeChange?: (mode: SearchMode) => void;
}

export function SearchBar({
  value,
  onChange,
  placeholder = "Search song name...",
  mode,
  onModeChange,
}: Props) {
  const showToggle = mode !== undefined && onModeChange !== undefined;

  // Right padding grows when either the clear button or the inline toggle is
  // present, so the input text never collides with them.
  const rightPadding = showToggle ? "pr-[9.5rem]" : value ? "pr-10" : "pr-3";

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        inputMode="search"
        enterKeyHint="search"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder={placeholder}
        className={cn("h-12 pl-10", rightPadding)}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
        {value && (
          <button
            type="button"
            aria-label="Clear"
            onClick={() => onChange("")}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {showToggle && (
          <div className="flex items-center gap-0.5 rounded-full bg-secondary p-0.5">
            <ModePill
              label="Songs"
              active={mode === "songs"}
              onClick={() => onModeChange("songs")}
            />
            <ModePill
              label="Artists"
              active={mode === "artists"}
              onClick={() => onModeChange("artists")}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ModePill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
