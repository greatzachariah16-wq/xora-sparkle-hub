/**
 * VAST resolution service. Runs server-side (no CORS, no ad-blocker interference)
 * and uses the IAB-compliant @dailymotion/vast-client parser — no hand-rolled XML.
 */
import { VAST_MAX_WRAPPER_DEPTH, VAST_TIMEOUT_MS } from "@/config/ads";
import type { VastAd, VastResult } from "./vast.types";

const PLAYABLE = [
  "video/mp4",
  "video/webm",
  "video/ogg",
  "application/x-mpegurl",
  "application/vnd.apple.mpegurl",
];

function parseSkipOffset(raw: unknown, duration: number | null): number | null {
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

  let response: Awaited<ReturnType<VASTClient["get"]>>;
  try {
    response = await client.get(url, {
      timeout: VAST_TIMEOUT_MS,
      withCredentials: false,
      wrapperLimit: VAST_MAX_WRAPPER_DEPTH,
      resolveAll: true,
    });
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
  if (response.errorURLTemplates?.length && !response.ads?.length) {
    return { ok: false, reason: "nofill", message: "No advertisement available." };
  }
  if (!response.ads?.length) {
    return { ok: false, reason: "nofill", message: "No advertisement available." };
  }

  for (const ad of response.ads) {
    for (const creative of ad.creatives ?? []) {
      if (creative.type !== "linear") continue;
      const linear = creative as typeof creative & {
        mediaFiles?: { fileURL?: string | null; mimeType?: string | null; width?: number }[];
        skipDelay?: string | number | null;
        duration?: number | null;
        videoClickThroughURLTemplate?: { url?: string } | string | null;
        videoClickTrackingURLTemplates?: ({ url?: string } | string)[];
        trackingEvents?: Record<string, string[]>;
      };

      const candidates = (linear.mediaFiles ?? [])
        .map((m) => ({
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

      const duration = Number.isFinite(linear.duration) ? Number(linear.duration) : null;
      const asUrl = (v: unknown): string | null =>
        typeof v === "string" ? v : ((v as { url?: string } | null)?.url ?? null);

      const result: VastAd = {
        mediaUrl: best.url,
        mimeType: best.type,
        duration,
        skipOffset: parseSkipOffset(linear.skipDelay, duration),
        clickThrough: asUrl(linear.videoClickThroughURLTemplate),
        adTitle: ad.title ?? null,
        impressions: (ad.impressionURLTemplates ?? [])
          .map((i) => asUrl(i))
          .filter((u): u is string => Boolean(u)),
        tracking: linear.trackingEvents ?? {},
        clickTracking: (linear.videoClickTrackingURLTemplates ?? [])
          .map((c) => asUrl(c))
          .filter((u): u is string => Boolean(u)),
        errorUrls: (ad.errorURLTemplates ?? []).filter((u): u is string => Boolean(u)),
      };
      return { ok: true, ad: result };
    }
  }

  return { ok: false, reason: "nomedia", message: "No playable advertisement returned." };
}
