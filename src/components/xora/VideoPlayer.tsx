import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Maximize2, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { useSignedUrl } from "@/lib/media";
import { duration as fmtDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  mediaPath?: string | null;
  posterPath?: string | null;
  vertical?: boolean;
  title?: string;
  autoPlay?: boolean;
  loop?: boolean;
  className?: string;
};

export function VideoPlayer({
  mediaPath,
  posterPath,
  vertical = false,
  title = "Video",
  autoPlay = false,
  loop = false,
  className,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const src = useSignedUrl("videos", mediaPath);
  const poster = useSignedUrl("posters", posterPath);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(autoPlay);
  const [waiting, setWaiting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(0);

  const toggle = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => setFailed(true));
    else video.pause();
  }, []);

  useEffect(() => {
    if (!autoPlay) return;
    const video = videoRef.current;
    if (!video || !src) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0.6 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [autoPlay, src]);

  const aspect = vertical ? "aspect-[9/16]" : "aspect-video";

  if (!mediaPath) {
    return (
      <div
        className={cn(
          "grid w-full place-items-center rounded-xl bg-surface-2 text-xs uppercase tracking-widest text-muted-foreground",
          aspect,
          className,
        )}
      >
        No video
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative w-full overflow-hidden rounded-xl bg-ink",
        aspect,
        className,
      )}
    >
      {src ? (
        <video
          ref={videoRef}
          src={src}
          poster={poster ?? undefined}
          playsInline
          loop={loop}
          muted={muted}
          preload="metadata"
          aria-label={title}
          className="h-full w-full bg-ink object-contain"
          onClick={toggle}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onWaiting={() => setWaiting(true)}
          onPlaying={() => setWaiting(false)}
          onError={() => setFailed(true)}
          onLoadedMetadata={(event) => setTotal(event.currentTarget.duration || 0)}
          onTimeUpdate={(event) => {
            const video = event.currentTarget;
            setCurrent(video.currentTime);
            setProgress(video.duration ? (video.currentTime / video.duration) * 100 : 0);
          }}
        />
      ) : (
        <div className="shimmer h-full w-full" aria-hidden="true" />
      )}

      {failed ? (
        <div className="absolute inset-0 grid place-items-center bg-ink/85 px-6 text-center">
          <div>
            <p className="font-display text-sm font-semibold text-background">
              This video can&apos;t be played
            </p>
            <p className="mt-1 text-xs text-background/70">
              It may still be processing. Try again in a moment.
            </p>
          </div>
        </div>
      ) : null}

      {waiting && !failed ? (
        <span className="pointer-events-none absolute inset-0 grid place-items-center">
          <Loader2 className="size-7 animate-spin text-background/90" aria-hidden="true" />
        </span>
      ) : null}

      {!playing && !failed ? (
        <button
          type="button"
          onClick={toggle}
          aria-label="Play video"
          className="press absolute inset-0 grid place-items-center bg-ink/15"
        >
          <span className="grid size-14 place-items-center rounded-full bg-background/85 shadow-lift">
            <Play className="ml-0.5 size-6 fill-foreground text-foreground" aria-hidden="true" />
          </span>
        </button>
      ) : null}

      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/80 to-transparent p-3 transition-opacity duration-200",
          playing ? "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100" : "opacity-100",
        )}
      >
        <div className="pointer-events-auto flex items-center gap-3">
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? "Pause" : "Play"}
            className="press grid size-8 place-items-center rounded-full bg-background/20 text-background ring-1 ring-background/25"
          >
            {playing ? (
              <Pause className="size-3.5" aria-hidden="true" />
            ) : (
              <Play className="ml-px size-3.5" aria-hidden="true" />
            )}
          </button>
          <div
            className="h-1 flex-1 overflow-hidden rounded-full bg-background/25"
            role="progressbar"
            aria-label="Playback progress"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="font-mono text-[10px] tabular-nums text-background/85">
            {fmtDuration(current)} / {fmtDuration(total)}
          </span>
          <button
            type="button"
            onClick={() => {
              const video = videoRef.current;
              if (!video) return;
              video.muted = !video.muted;
              setMuted(video.muted);
            }}
            aria-label={muted ? "Unmute" : "Mute"}
            className="press grid size-8 place-items-center rounded-full bg-background/20 text-background ring-1 ring-background/25"
          >
            {muted ? (
              <VolumeX className="size-3.5" aria-hidden="true" />
            ) : (
              <Volume2 className="size-3.5" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={() => void videoRef.current?.requestFullscreen?.()}
            aria-label="Enter fullscreen"
            className="press grid size-8 place-items-center rounded-full bg-background/20 text-background ring-1 ring-background/25"
          >
            <Maximize2 className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
