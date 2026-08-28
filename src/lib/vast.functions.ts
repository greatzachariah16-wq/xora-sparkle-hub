import { createServerFn } from "@tanstack/react-start";
import { resolveVast, type VastResult } from "./vast.server";

const VAST_TAG =
  "https://oiidwgfyo.com?js=1&code_type=1&vast=1&vast_position=preroll&sid=944201";

export const getPrerollAd = createServerFn({ method: "GET" }).handler(
  async (): Promise<VastResult> => {
    const cacheBusted = `${VAST_TAG}&cb=${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    try {
      return await resolveVast(cacheBusted);
    } catch {
      return { ok: false, reason: "network", message: "Ad request failed." };
    }
  },
);
