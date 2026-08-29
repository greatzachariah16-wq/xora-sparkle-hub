/** Client-safe types shared between the VAST service and the player. */

export type VastAd = {
  /** Ad creative media file the player renders. */
  mediaUrl: string;
  mimeType: string;
  duration: number | null;
  /** Seconds after which the ad may be skipped, or null when not skippable. */
  skipOffset: number | null;
  clickThrough: string | null;
  adTitle: string | null;
  impressions: string[];
  /** Tracking pixels keyed by VAST event name (start, firstQuartile, complete, skip...). */
  tracking: Record<string, string[]>;
  clickTracking: string[];
  errorUrls: string[];
};

export type VastFailureReason =
  | "nofill"
  | "invalid"
  | "timeout"
  | "network"
  | "nomedia";

export type VastResult =
  | { ok: true; ad: VastAd }
  | { ok: false; reason: VastFailureReason; message: string };
