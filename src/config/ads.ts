/**
 * Central advertising configuration for Xora.
 * Swap the VAST endpoint here — nothing else in the app hard-codes it.
 */

export const VAST_AD_URL =
  "https://oiidwgfyo.com?js=1&code_type=1&vast=1&vast_position=preroll&sid=944201";

/** Max wrapper redirects the VAST client will follow. */
export const VAST_MAX_WRAPPER_DEPTH = 5;

/** Network timeout for a single VAST document request (ms). */
export const VAST_TIMEOUT_MS = 8000;

/** Verbose ad logging: on in dev, off in production builds. */
export const VAST_DEBUG =
  typeof import.meta !== "undefined" && Boolean(import.meta.env?.DEV);

export function adLog(event: string, detail?: unknown) {
  if (!VAST_DEBUG) return;
  if (detail === undefined) console.info(`[VAST] ${event}`);
  else console.info(`[VAST] ${event}`, detail);
}
