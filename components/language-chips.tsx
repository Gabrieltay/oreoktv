"use client";

import { LANGUAGES } from "@/lib/config";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export function LanguageChips({ value, onChange }: Props) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Chip label="All" active={value === ""} onClick={() => onChange("")} />
      {LANGUAGES.map((lang) => (
        <Chip
          key={lang.value}
          label={lang.label}
          active={value === lang.value}
          onClick={() => onChange(value === lang.value ? "" : lang.value)}
        />
      ))}
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-foreground hover:bg-accent",
      )}
    >
      {label}
    </button>
  );
}
