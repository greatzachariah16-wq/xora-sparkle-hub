/**
 * VAST resolution service. Runs server-side (no CORS, no ad-blocker interference)
 * and uses the IAB-compliant @dailymotion/vast-client parser — no hand-rolled XML.
 */
import { VAST_MAX_WRAPPER_DEPTH, VAST_TIMEOUT_MS } from "@/config/ads";
import type { VastAd, VastResult } from "./vast.types";

export type { VastAd, VastResult } from "./vast.types";

const PLAYABLE = [
  "video/mp4",
  "video/webm",
  "video/ogg",
  "application/x-mpegurl",
  "application/vnd.apple.mpegurl",
];

type UrlLike = string | { url?: string } | null | undefined;

type ParsedMediaFile = { fileURL?: string | null; mimeType?: string | null; width?: number };

type ParsedCreative = {
  type?: string;
  duration?: number | null;
  skipDelay?: string | number | null;
  mediaFiles?: ParsedMediaFile[];
  videoClickThroughURLTemplate?: UrlLike;
  videoClickTrackingURLTemplates?: UrlLike[];
  trackingEvents?: Record<string, string[]>;
};

type ParsedAd = {
  title?: string | null;
  creatives?: ParsedCreative[];
  impressionURLTemplates?: UrlLike[];
  errorURLTemplates?: (string | null | undefined)[];
};

type ParsedResponse = {
  ads?: ParsedAd[];
  errorURLTemplates?: unknown[];
};

function asUrl(value: UrlLike): string | null {
  if (typeof value === "string") return value || null;
  return value?.url ?? null;
}

function parseSkipOffset(raw: unknown, duration: number | null): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string" || !raw) return null;
  if (raw.endsWith("%")) {
    const pct = Number(raw.slice(0, -1));
    if (!Number.isFinite(pct) || duration == null) return null;
    return (duration * pct) / 100;
  }
  const parts = raw.split(":").map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return null;
  if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  if (parts.length === 2) return parts[0]! * 60 + parts[1]!;
  return parts[0] ?? null;
}

export async function resolveVast(url: string): Promise<VastResult> {
  const { VASTClient } = await import("@dailymotion/vast-client");
  const client = new VASTClient();

  let response: ParsedResponse | null = null;
  try {
    response = (await client.get(url, {
      timeout: VAST_TIMEOUT_MS,
      withCredentials: false,
      wrapperLimit: VAST_MAX_WRAPPER_DEPTH,
      resolveAll: true,
    })) as unknown as ParsedResponse;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const timedOut = /timeout|408|abort/i.test(message);
    console.error("[VAST] request failed:", message);
    return {
      ok: false,
      reason: timedOut ? "timeout" : "network",
      message: timedOut ? "Ad request timed out." : "Ad request failed.",
    };
  }

  if (!response) return { ok: false, reason: "invalid", message: "Invalid ad response." };
  if (!response.ads?.length) {
    return { ok: false, reason: "nofill", message: "No advertisement available." };
  }

  for (const ad of response.ads) {
    for (const creative of ad.creatives ?? []) {
      if (creative.type !== "linear") continue;

      const candidates = (creative.mediaFiles ?? [])
        .map((m: ParsedMediaFile) => ({
          url: m.fileURL ?? "",
          type: (m.mimeType ?? "").toLowerCase(),
          width: Number(m.width ?? 0) || 0,
        }))
        .filter((m) => m.url && PLAYABLE.includes(m.type));
      if (candidates.length === 0) continue;

      candidates.sort((a, b) => {
        const rank = (t: string) => (t === "video/mp4" ? 0 : t === "video/webm" ? 1 : 2);
        return rank(a.type) - rank(b.type) || a.width - b.width;
      });
      const best = candidates.find((c) => c.width >= 640) ?? candidates[candidates.length - 1]!;

      const duration = Number.isFinite(creative.duration) ? Number(creative.duration) : null;

      const parsedAd: VastAd = {
        mediaUrl: best.url,
        mimeType: best.type,
        duration,
        skipOffset: parseSkipOffset(creative.skipDelay, duration),
        clickThrough: asUrl(creative.videoClickThroughURLTemplate),
        adTitle: ad.title ?? null,
        impressions: (ad.impressionURLTemplates ?? [])
          .map(asUrl)
          .filter((u): u is string => Boolean(u)),
        tracking: creative.trackingEvents ?? {},
        clickTracking: (creative.videoClickTrackingURLTemplates ?? [])
          .map(asUrl)
          .filter((u): u is string => Boolean(u)),
        errorUrls: (ad.errorURLTemplates ?? []).filter((u): u is string => Boolean(u)),
      };
      return { ok: true, ad: parsedAd };
    }
  }

  return { ok: false, reason: "nomedia", message: "No playable advertisement returned." };
}
