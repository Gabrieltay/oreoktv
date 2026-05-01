"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Settings as SettingsIcon, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/toaster";

interface ConfigResponse {
  ktvBaseUrl: string;
  imageBase: string;
  baseline: string;
  override: string | null;
}

async function fetchConfig(): Promise<ConfigResponse> {
  const res = await fetch("/api/config");
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Config fetch failed (${res.status})`);
  }
  return res.json();
}

export function SettingsButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label="Settings"
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <SettingsIcon className="h-5 w-5" />
      </button>
      {open && <SettingsSheet onClose={() => setOpen(false)} />}
    </>
  );
}

function SettingsSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["config"] as const,
    queryFn: fetchConfig,
    staleTime: 0,
  });

  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setValue(data.override ?? data.ktvBaseUrl);
  }, [data]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const save = async (override: string | null) => {
    setSaving(true);
    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ktvBaseUrl: override }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message ?? `Save failed (${res.status})`);
      qc.setQueryData(["config"], body);
      void qc.invalidateQueries({ queryKey: ["playlist"] });
      router.refresh();
      toast(override ? `Saved · ${override}` : "Reset to default");
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim().replace(/\/+$/, "");
    if (!trimmed) {
      toast("Enter a URL or tap Reset to default", "error");
      return;
    }
    if (data && trimmed === data.baseline) {
      void save(null);
      return;
    }
    void save(trimmed);
  };

  const baseline = data?.baseline ?? "";
  const isOverridden = !!data?.override;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      className="fixed inset-0 z-40 flex h-[100dvh] items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-background"
      >
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <div className="text-sm font-semibold">Settings</div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading || !data ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3 px-4 pb-4">
            <div className="space-y-1">
              <label
                htmlFor="ktv-url"
                className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                KTV machine URL
              </label>
              <input
                id="ktv-url"
                type="url"
                inputMode="url"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="http://192.168.x.x:8080"
                disabled={saving}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-base outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              />
              <p className="text-xs text-muted-foreground">
                Default: <span className="font-mono">{baseline}</span>
                {isOverridden ? null : <span className="ml-1">(in use)</span>}
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground transition-all active:scale-95 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </button>
              <button
                type="button"
                disabled={saving || !isOverridden}
                onClick={() => void save(null)}
                className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
              >
                Reset to default
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Save pings the new host first; if it doesn&apos;t respond the change is rejected.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
