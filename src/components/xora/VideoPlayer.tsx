import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Maximize2, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useSignedUrl } from "@/lib/media";
import { duration as fmtDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getPrerollAd } from "@/lib/vast.functions";
import type { VastAd } from "@/lib/vast.server";

type Props = {
  mediaPath?: string | null;
  posterPath?: string | null;
  vertical?: boolean;
  title?: string;
  autoPlay?: boolean;
  loop?: boolean;
  className?: string;
};

type AdState = "idle" | "loading" | "playing" | "done" | "failed";

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
  const [adError, setAdError] = useState<string | null>(null);
  const [adRemaining, setAdRemaining] = useState<number | null>(null);
  const inFlight = useRef(false);
  const firedImpressions = useRef(false);

  const adDone = adState === "done";

  // A new video always requires its own preroll.
  useEffect(() => {
    inFlight.current = false;
    firedImpressions.current = false;
    setAdState("idle");
    setAd(null);
    setAdError(null);
    setAdRemaining(null);
    setPlaying(false);
    setProgress(0);
    setCurrent(0);
    setFailed(false);
  }, [mediaPath]);

  const playMain = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    void video.play().catch(() => setFailed(true));
  }, []);

  const startPreroll = useCallback(async () => {
    if (inFlight.current || adState === "loading" || adState === "playing") return;
    inFlight.current = true;
    setAdState("loading");
    setAdError(null);
    try {
      const result = await fetchAd();
      if (!result.ok) {
        setAd(null);
        setAdError(result.message);
        setAdState("failed");
        return;
      }
      firedImpressions.current = false;
      setAd(result.ad);
      setAdRemaining(result.ad.duration);
      setAdState("playing");
    } catch {
      setAd(null);
      setAdError("Advertisement unavailable. Please try again.");
      setAdState("failed");
    } finally {
      inFlight.current = false;
    }
  }, [adState, fetchAd]);

  const toggle = useCallback(() => {
    if (!adDone) {
      void startPreroll();
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => setFailed(true));
    else video.pause();
  }, [adDone, startPreroll]);

  // Start ad playback once we have a media file.
  useEffect(() => {
    if (adState !== "playing" || !ad) return;
    const adVideo = adRef.current;
    if (!adVideo) return;
    adVideo.muted = muted;
    void adVideo.play().catch(() => {
      // Autoplay restriction: retry muted before giving up.
      adVideo.muted = true;
      setMuted(true);
      void adVideo.play().catch(() => {
        setAdError("Advertisement unavailable. Please try again.");
        setAdState("failed");
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adState, ad]);

  const finishAd = useCallback(() => {
    if (ad?.trackingComplete?.length) {
      for (const url of ad.trackingComplete) {
        void fetch(url, { mode: "no-cors", keepalive: true }).catch(() => {});
      }
    }
    setAdState("done");
    setAdRemaining(null);
    setTimeout(playMain, 0);
  }, [ad, playMain]);

  const failAd = useCallback(() => {
    setAdError("Advertisement unavailable. Please try again.");
    setAdState("failed");
  }, []);

  useEffect(() => {
    if (!autoPlay) return;
    const video = videoRef.current;
    if (!video || !src) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          if (adDone) void video.play().catch(() => {});
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
  }, [autoPlay, src, adDone, startPreroll]);

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

  const adBlocking = adState !== "done";

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
          src={adDone ? src : undefined}
          poster={poster ?? undefined}
          playsInline
          loop={loop}
          muted={muted}
          preload={adDone ? "metadata" : "none"}
          aria-label={title}
          className="h-full w-full bg-ink object-contain"
          onClick={toggle}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onWaiting={() => setWaiting(true)}
          onPlaying={() => setWaiting(false)}
          onError={() => adDone && setFailed(true)}
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

      {/* Preroll advertisement layer */}
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
            onLoadedMetadata={(event) => {
              if (!firedImpressions.current) {
                firedImpressions.current = true;
                for (const url of ad.impressions) {
                  void fetch(url, { mode: "no-cors", keepalive: true }).catch(() => {});
                }
              }
              setAdRemaining(event.currentTarget.duration || ad.duration);
            }}
            onTimeUpdate={(event) => {
              const el = event.currentTarget;
              if (el.duration) setAdRemaining(Math.max(0, el.duration - el.currentTime));
            }}
            onEnded={finishAd}
            onError={failAd}
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-3">
            <span className="rounded-full bg-ink/70 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-background">
              Ad{adRemaining != null ? ` · ${fmtDuration(adRemaining)}` : ""}
            </span>
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
      ) : null}

      {adState === "loading" ? (
        <div className="absolute inset-0 z-20 grid place-items-center bg-ink/85 text-center">
          <div>
            <Loader2 className="mx-auto size-6 animate-spin text-background/90" aria-hidden="true" />
            <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-background/80">
              Loading advertisement
            </p>
          </div>
        </div>
      ) : null}

      {adState === "failed" ? (
        <div className="absolute inset-0 z-20 grid place-items-center bg-ink/90 px-6 text-center">
          <div>
            <p className="font-display text-sm font-semibold text-background">
              Advertisement unavailable. Please try again.
            </p>
            {adError ? <p className="mt-1 text-xs text-background/70">{adError}</p> : null}
            <button
              type="button"
              onClick={() => {
                setAdState("idle");
                setAdError(null);
                void startPreroll();
              }}
              className="press mt-4 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Try again
            </button>
          </div>
        </div>
      ) : null}

      {failed && adDone ? (
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

      {waiting && !failed && adDone ? (
        <span className="pointer-events-none absolute inset-0 grid place-items-center">
          <Loader2 className="size-7 animate-spin text-background/90" aria-hidden="true" />
        </span>
      ) : null}

      {!playing && !failed && adState === "idle" ? (
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

      {!playing && !failed && adDone ? (
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
      {adBlocking ? <span className="sr-only">Advertisement required before playback</span> : null}
    </div>
  );
}
