"use client";

import { useState } from "react";
import {
  Loader2,
  Mic,
  MicOff,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  SkipForward,
  Sliders,
  Volume2,
  VolumeX,
} from "lucide-react";
import { usePlaylist, usePlaybackCommand } from "@/lib/queries";
import { toast } from "@/components/toaster";
import { cn } from "@/lib/utils";
import type { PlaybackCommand } from "@/lib/ktv-client";

export function PlaybackBar() {
  const { data } = usePlaylist();
  const cmd = usePlaybackCommand();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isPlaying = data?.isPlaying ?? false;
  const isOriginalVocal = data?.isOriginalVocal ?? false;
  const isMuted = data?.isMuted ?? false;

  const run = (c: PlaybackCommand, label: string) =>
    cmd.mutate(c, {
      onSuccess: () => toast(label),
      onError: (e) => toast(e.message, "error"),
    });

  return (
    <>
      {drawerOpen && (
        <button
          type="button"
          aria-label="Close sound controls"
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 z-20 bg-black/40 animate-in fade-in"
        />
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        {drawerOpen && <SoundDrawer pending={cmd.isPending} isMuted={isMuted} onRun={run} />}

        <div className="mx-auto flex max-w-xl items-center justify-around gap-2 px-4 py-3">
          <ControlButton
            label="Restart"
            pending={cmd.isPending}
            onClick={() => run("Reset", "Restarted")}
          >
            <RotateCcw className="h-6 w-6" />
          </ControlButton>
          <ControlButton
            label={isOriginalVocal ? "Turn off guide vocal" : "Turn on guide vocal"}
            pending={cmd.isPending}
            active={isOriginalVocal}
            onClick={() => run("MuOr", isOriginalVocal ? "Guide vocal off" : "Guide vocal on")}
          >
            {isOriginalVocal ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
          </ControlButton>
          <ControlButton
            label={isPlaying ? "Pause" : "Resume"}
            pending={cmd.isPending}
            tone="primary"
            onClick={() => run("Play", isPlaying ? "Paused" : "Playing")}
          >
            {isPlaying ? (
              <Pause className="h-7 w-7" />
            ) : (
              <Play className="h-7 w-7 translate-x-0.5" />
            )}
          </ControlButton>
          <ControlButton
            label="Skip"
            pending={cmd.isPending}
            onClick={() => run("Skip", "Skipped")}
          >
            <SkipForward className="h-6 w-6" />
          </ControlButton>
          <ControlButton
            label={drawerOpen ? "Close sound controls" : "Sound controls"}
            pending={false}
            active={drawerOpen}
            onClick={() => setDrawerOpen((v) => !v)}
          >
            <Sliders className="h-6 w-6" />
          </ControlButton>
        </div>
      </div>
    </>
  );
}

function SoundDrawer({
  pending,
  isMuted,
  onRun,
}: {
  pending: boolean;
  isMuted: boolean;
  onRun: (cmd: PlaybackCommand, label: string) => void;
}) {
  return (
    <div className="border-b bg-muted/40 animate-in slide-in-from-bottom">
      <div className="mx-auto max-w-xl space-y-3 px-4 py-3">
        <SoundRow
          label="Music"
          icon={<Volume2 className="h-5 w-5" />}
          pending={pending}
          onDown={() => onRun("Music_down", "Music −")}
          onUp={() => onRun("Music_up", "Music +")}
        />
        <SoundRow
          label="Mic"
          icon={<Mic className="h-5 w-5" />}
          pending={pending}
          onDown={() => onRun("Mic_down", "Mic −")}
          onUp={() => onRun("Mic_up", "Mic +")}
        />
        <button
          type="button"
          aria-pressed={isMuted}
          disabled={pending}
          onClick={() => onRun("Mute", isMuted ? "Unmuted" : "Muted")}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-md border py-2.5 text-sm font-medium transition-colors disabled:opacity-50",
            isMuted
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-input bg-background text-foreground active:bg-accent",
          )}
        >
          {isMuted ? (
            <>
              <VolumeX className="h-5 w-5" />
              Muted · Tap to unmute
            </>
          ) : (
            <>
              <Volume2 className="h-5 w-5" />
              Mute
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function SoundRow({
  label,
  icon,
  pending,
  onDown,
  onUp,
}: {
  label: string;
  icon: React.ReactNode;
  pending: boolean;
  onDown: () => void;
  onUp: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium">
        {icon}
        <span>{label}</span>
      </div>
      <StepButton label={`${label} down`} pending={pending} onClick={onDown}>
        <Minus className="h-5 w-5" />
      </StepButton>
      <StepButton label={`${label} up`} pending={pending} onClick={onUp}>
        <Plus className="h-5 w-5" />
      </StepButton>
    </div>
  );
}

function StepButton({
  label,
  pending,
  onClick,
  children,
}: {
  label: string;
  pending: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={pending}
      onClick={onClick}
      className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-foreground transition-colors hover:bg-accent active:scale-95 disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function ControlButton({
  label,
  onClick,
  pending,
  tone = "neutral",
  active = false,
  children,
}: {
  label: string;
  onClick: () => void;
  pending: boolean;
  tone?: "primary" | "neutral";
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={pending}
      onClick={onClick}
      className={cn(
        "flex items-center justify-center rounded-full transition-all disabled:opacity-50",
        tone === "primary"
          ? "h-14 w-14 bg-primary text-primary-foreground shadow-lg shadow-primary/40 hover:scale-105 active:scale-95"
          : cn(
              "h-11 w-11",
              active
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            ),
      )}
    >
      {pending ? (
        <Loader2 className={cn("animate-spin", tone === "primary" ? "h-7 w-7" : "h-6 w-6")} />
      ) : (
        children
      )}
    </button>
  );
}
