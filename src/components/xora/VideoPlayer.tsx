import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Maximize2, Pause, Play, SkipForward, Volume2, VolumeX } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useSignedUrl } from "@/lib/media";
import { duration as fmtDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import { adLog } from "@/config/ads";
import { getPrerollAd } from "@/lib/vast.functions";
import type { VastAd } from "@/lib/vast.types";

type Props = {
  mediaPath?: string | null;
  posterPath?: string | null;
  vertical?: boolean;
  title?: string;
  autoPlay?: boolean;
  loop?: boolean;
  className?: string;
};

/** idle → loading → playing → finished. "finished" covers completed, skipped and failed ads. */
type AdState = "idle" | "loading" | "playing" | "finished";

function ping(urls: string[] | undefined, event: string) {
  if (!urls?.length) return;
  adLog(`tracking ${event}`, urls.length);
  for (const url of urls) {
    void fetch(url, { mode: "no-cors", keepalive: true }).catch(() => {});
  }
}

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
  const adRef = useRef<HTMLVideoElement | null>(null);
  const src = useSignedUrl("videos", mediaPath);
  const poster = useSignedUrl("posters", posterPath);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(autoPlay);
  const [waiting, setWaiting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(0);

  // --- Preroll state -------------------------------------------------------
  const fetchAd = useServerFn(getPrerollAd);
  const [adState, setAdState] = useState<AdState>("idle");
  const [ad, setAd] = useState<VastAd | null>(null);
  const [adRemaining, setAdRemaining] = useState<number | null>(null);
  const [adElapsed, setAdElapsed] = useState(0);
  const requested = useRef(false);
  const firedImpressions = useRef(false);
  const quartiles = useRef<Set<string>>(new Set());

  const adOver = adState === "finished";

  // A new video is a new playback session: exactly one preroll per video.
  useEffect(() => {
    requested.current = false;
    firedImpressions.current = false;
    quartiles.current = new Set();
    setAdState("idle");
    setAd(null);
    setAdRemaining(null);
    setAdElapsed(0);
    setPlaying(false);
    setProgress(0);
    setCurrent(0);
    setFailed(false);
  }, [mediaPath]);

  const playMain = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    adLog("content video started");
    void video.play().catch(() => setFailed(true));
  }, []);

  const endAd = useCallback(
    (reason: "complete" | "skip" | "error" | "nofill", urls?: string[]) => {
      adLog(`ad ${reason}`);
      ping(urls, reason);
      setAdState("finished");
      setAdRemaining(null);
      // Content playback is never permanently blocked by ad failures.
      setTimeout(playMain, 0);
    },
    [playMain],
  );

  const startPreroll = useCallback(async () => {
    if (requested.current) return;
    requested.current = true;
    setAdState("loading");
    adLog("request started");
    try {
      const result = await fetchAd();
      adLog("response received", result.ok ? "filled" : result.reason);
      if (!result.ok) {
        endAd(result.reason === "nofill" ? "nofill" : "error");
        return;
      }
      adLog("ad loaded", { duration: result.ad.duration, mime: result.ad.mimeType });
      firedImpressions.current = false;
      quartiles.current = new Set();
      setAd(result.ad);
      setAdRemaining(result.ad.duration);
      setAdElapsed(0);
      setAdState("playing");
    } catch (error) {
      adLog("error", error);
      endAd("error");
    }
  }, [fetchAd, endAd]);

  const toggle = useCallback(() => {
    if (!adOver) {
      void startPreroll();
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => setFailed(true));
    else video.pause();
  }, [adOver, startPreroll]);

  // Start ad creative playback once the media file is known.
  useEffect(() => {
    if (adState !== "playing" || !ad) return;
    const adVideo = adRef.current;
    if (!adVideo) return;
    adVideo.muted = muted;
    void adVideo.play().catch(() => {
      // Autoplay restriction (common on Android Chrome): retry muted.
      adVideo.muted = true;
      setMuted(true);
      void adVideo.play().catch(() => endAd("error", ad.errorUrls));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adState, ad]);

  useEffect(() => {
    if (!autoPlay) return;
    const video = videoRef.current;
    if (!video || !src) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          if (adOver) void video.play().catch(() => {});
          else void startPreroll();
        } else {
          video.pause();
          adRef.current?.pause();
        }
      },
      { threshold: 0.6 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [autoPlay, src, adOver, startPreroll]);

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

  const canSkip =
    ad?.skipOffset != null && adElapsed >= ad.skipOffset ? true : false;
  const skipIn =
    ad?.skipOffset != null ? Math.max(0, Math.ceil(ad.skipOffset - adElapsed)) : null;

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
          src={adOver ? src : undefined}
          poster={poster ?? undefined}
          playsInline
          loop={loop}
          muted={muted}
          preload={adOver ? "metadata" : "none"}
          aria-label={title}
          className="h-full w-full bg-ink object-contain"
          onClick={toggle}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onWaiting={() => setWaiting(true)}
          onPlaying={() => setWaiting(false)}
          onError={() => adOver && setFailed(true)}
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

      {/* Advertisement layer — separate element, never replaces the Xora video */}
      {adState === "playing" && ad ? (
        <div className="absolute inset-0 z-20 bg-ink">
          <video
            ref={adRef}
            src={ad.mediaUrl}
            playsInline
            muted={muted}
            preload="auto"
            aria-label="Advertisement"
            className="h-full w-full bg-ink object-contain"
            onClick={() => {
              if (!ad.clickThrough) return;
              ping(ad.clickTracking, "click");
              window.open(ad.clickThrough, "_blank", "noopener,noreferrer");
            }}
            onLoadedMetadata={(event) => {
              if (!firedImpressions.current) {
                firedImpressions.current = true;
                adLog("ad started");
                ping(ad.impressions, "impression");
                ping(ad.tracking["start"], "start");
              }
              setAdRemaining(event.currentTarget.duration || ad.duration);
            }}
            onTimeUpdate={(event) => {
              const el = event.currentTarget;
              setAdElapsed(el.currentTime);
              if (!el.duration) return;
              setAdRemaining(Math.max(0, el.duration - el.currentTime));
              const pct = el.currentTime / el.duration;
              const marks: [string, number][] = [
                ["firstQuartile", 0.25],
                ["midpoint", 0.5],
                ["thirdQuartile", 0.75],
              ];
              for (const [event_, at] of marks) {
                if (pct >= at && !quartiles.current.has(event_)) {
                  quartiles.current.add(event_);
                  ping(ad.tracking[event_], event_);
                }
              }
            }}
            onEnded={() => endAd("complete", ad.tracking["complete"])}
            onError={() => endAd("error", ad.errorUrls)}
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-3">
            <span className="rounded-full bg-ink/70 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-background">
              Ad{adRemaining != null ? ` · ${fmtDuration(adRemaining)}` : ""}
            </span>
            <div className="flex items-center gap-2">
              {ad.skipOffset != null ? (
                <button
                  type="button"
                  disabled={!canSkip}
                  onClick={() => endAd("skip", ad.tracking["skip"])}
                  className="press pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-background/20 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-background ring-1 ring-background/25 disabled:opacity-60"
                >
                  {canSkip ? (
                    <>
                      Skip ad <SkipForward className="size-3" aria-hidden="true" />
                    </>
                  ) : (
                    `Skip in ${skipIn}s`
                  )}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  const adVideo = adRef.current;
                  if (!adVideo) return;
                  adVideo.muted = !adVideo.muted;
                  setMuted(adVideo.muted);
                }}
                aria-label={muted ? "Unmute advertisement" : "Mute advertisement"}
                className="press pointer-events-auto grid size-8 place-items-center rounded-full bg-background/20 text-background ring-1 ring-background/25"
              >
                {muted ? (
                  <VolumeX className="size-3.5" aria-hidden="true" />
                ) : (
                  <Volume2 className="size-3.5" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {adState === "loading" ? (
        <div className="absolute inset-0 z-20 grid place-items-center bg-ink/85 text-center">
          <div>
            <Loader2 className="mx-auto size-6 animate-spin text-background/90" aria-hidden="true" />
            <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-background/80">
              Advertisement
            </p>
          </div>
        </div>
      ) : null}

      {failed && adOver ? (
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

      {waiting && !failed && adOver ? (
        <span className="pointer-events-none absolute inset-0 grid place-items-center">
          <Loader2 className="size-7 animate-spin text-background/90" aria-hidden="true" />
        </span>
      ) : null}

      {!playing && !failed && (adState === "idle" || adOver) ? (
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
            disabled={adState === "loading" || adState === "playing"}
            className="press grid size-8 place-items-center rounded-full bg-background/20 text-background ring-1 ring-background/25 disabled:opacity-50"
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
