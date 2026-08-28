/** Minimal VAST 2/3/4 fetcher + parser that runs on the server (no DOMParser). */

export type VastAd = {
  mediaUrl: string;
  mimeType: string;
  duration: number | null;
  clickThrough: string | null;
  impressions: string[];
  trackingComplete: string[];
};

export type VastResult =
  | { ok: true; ad: VastAd }
  | { ok: false; reason: "nofill" | "invalid" | "timeout" | "network" | "nomedia"; message: string };

const VAST_TIMEOUT_MS = 8000;
const MAX_WRAPPERS = 4;

const PLAYABLE = [
  "video/mp4",
  "video/webm",
  "video/ogg",
  "application/x-mpegurl",
  "application/vnd.apple.mpegurl",
];

function tagContents(xml: string, tag: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(m[1] ?? "");
  return out;
}

function tagNodes(xml: string, tag: string): { attrs: string; body: string }[] {
  const out: { attrs: string; body: string }[] = [];
  const re = new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}>`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push({ attrs: m[1] ?? "", body: m[2] ?? "" });
  return out;
}

function attr(attrs: string, name: string): string | null {
  const m = new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i").exec(attrs);
  return m?.[1] ?? null;
}

function clean(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .trim();
}

function parseDuration(value: string | undefined): number | null {
  if (!value) return null;
  const parts = clean(value).split(":").map(Number);
  if (parts.some((n) => Number.isNaN(n))) return null;
  if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  if (parts.length === 2) return parts[0]! * 60 + parts[1]!;
  return parts[0] ?? null;
}

async function fetchXml(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VAST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/xml,text/xml,*/*" },
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function resolveVast(url: string, depth = 0): Promise<VastResult> {
  let xml: string;
  try {
    xml = await fetchXml(url);
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return {
      ok: false,
      reason: aborted ? "timeout" : "network",
      message: aborted ? "Ad request timed out." : "Ad request failed.",
    };
  }

  if (!xml || !/<VAST[\s>]/i.test(xml)) {
    return { ok: false, reason: "invalid", message: "Invalid ad response." };
  }
  if (!/<Ad\b/i.test(xml)) {
    return { ok: false, reason: "nofill", message: "No advertisement available." };
  }

  // Wrapper: follow the redirect tag.
  const wrapperTag = tagContents(xml, "VASTAdTagURI")[0];
  if (wrapperTag && depth < MAX_WRAPPERS) {
    const next = clean(wrapperTag);
    if (next) {
      const inner = await resolveVast(next, depth + 1);
      if (inner.ok) {
        const outerImps = tagContents(xml, "Impression").map(clean).filter(Boolean);
        return { ok: true, ad: { ...inner.ad, impressions: [...outerImps, ...inner.ad.impressions] } };
      }
      return inner;
    }
  }

  const linear = tagContents(xml, "Linear")[0];
  if (!linear) return { ok: false, reason: "nomedia", message: "No playable advertisement." };

  const candidates = tagNodes(linear, "MediaFile")
    .map((node) => ({
      url: clean(node.body),
      type: (attr(node.attrs, "type") ?? "").toLowerCase(),
      width: Number(attr(node.attrs, "width") ?? 0) || 0,
      delivery: (attr(node.attrs, "delivery") ?? "").toLowerCase(),
    }))
    .filter((m) => m.url && PLAYABLE.includes(m.type));

  if (candidates.length === 0) {
    return { ok: false, reason: "nomedia", message: "Advertisement format is not supported." };
  }

  candidates.sort((a, b) => {
    const rank = (t: string) => (t === "video/mp4" ? 0 : t === "video/webm" ? 1 : 2);
    return rank(a.type) - rank(b.type) || a.width - b.width;
  });
  const best = candidates.find((c) => c.width >= 640) ?? candidates[candidates.length - 1]!;

  const trackingComplete = tagNodes(linear, "Tracking")
    .filter((n) => (attr(n.attrs, "event") ?? "").toLowerCase() === "complete")
    .map((n) => clean(n.body))
    .filter(Boolean);

  return {
    ok: true,
    ad: {
      mediaUrl: best.url,
      mimeType: best.type,
      duration: parseDuration(tagContents(linear, "Duration")[0]),
      clickThrough: clean(tagContents(linear, "ClickThrough")[0] ?? "") || null,
      impressions: tagContents(xml, "Impression").map(clean).filter(Boolean),
      trackingComplete,
    },
  };
}
