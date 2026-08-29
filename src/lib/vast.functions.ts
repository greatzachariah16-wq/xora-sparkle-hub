import { createServerFn } from "@tanstack/react-start";
import { VAST_AD_URL } from "@/config/ads";
import { resolveVast } from "./vast.server";
import type { VastResult } from "./vast.types";

export const getPrerollAd = createServerFn({ method: "GET" }).handler(
  async (): Promise<VastResult> => {
    const separator = VAST_AD_URL.includes("?") ? "&" : "?";
    const cacheBusted = `${VAST_AD_URL}${separator}cb=${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    try {
      return await resolveVast(cacheBusted);
    } catch (error) {
      console.error("[VAST] preroll resolution error:", error);
      return { ok: false, reason: "network", message: "Ad request failed." };
    }
  },
);
