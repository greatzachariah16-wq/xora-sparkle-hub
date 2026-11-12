import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, FileText } from "lucide-react";
import { Logo } from "@/components/xora/Logo";
import { cn } from "@/lib/utils";

/**
 * Hidden partner page.
 *
 * - Not linked from navigation, the feed, search results or the sitemap.
 * - Marked `noindex, nofollow` below and disallowed for crawlers in public/robots.txt.
 * - The real PDF is hosted at `public/<PDF_FILENAME>`; dropping the file there serves
 *   it at <PDF_URL> automatically. No placeholder PDF is created here.
 */
const PDF_FILENAME = "XoraTV_Eudor_Partner_Onboarding_Working_Draft.pdf";
const PDF_URL = `/${PDF_FILENAME}`;

export const Route = createFileRoute("/secret-download/eudor-partner-onboarding")({
  head: () => ({
    meta: [
      { title: "Eudor Partner Onboarding — XoraTV" },
      {
        name: "description",
        content: "XoraTV Eudor partner onboarding working draft, available as a PDF download.",
      },
      { property: "og:title", content: "Eudor Partner Onboarding — XoraTV" },
      {
        property: "og:description",
        content: "Download the XoraTV Eudor partner onboarding working draft.",
      },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: EudorPartnerOnboardingPage,
});

function EudorPartnerOnboardingPage() {
  // null = still checking, true = PDF is hosted, false = not uploaded yet.
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(PDF_URL, { method: "HEAD", cache: "no-store" });
        const type = res.headers.get("content-type") ?? "";
        // A missing file falls back to the app shell (text/html), so that counts as absent.
        if (!cancelled) setAvailable(res.ok && !type.includes("text/html"));
      } catch {
        if (!cancelled) setAvailable(false);
      }
    };
    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  const pending = available === false;

  return (
    <div className="flex min-h-dvh flex-col bg-background px-4 pb-[calc(env(safe-area-inset-bottom,0px)+2rem)] pt-[calc(env(safe-area-inset-top,0px)+2rem)]">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
        <div className="rise">
          <div className="flex justify-center">
            <Link to="/" className="press" aria-label="Xora home">
              <Logo />
            </Link>
          </div>

          <div className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-card">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-clay-soft text-primary">
                <FileText className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Working draft
                </p>
                <h1 className="mt-1 font-display text-xl font-semibold tracking-tight text-balance">
                  XoraTV Eudor Partner Onboarding
                </h1>
              </div>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              The onboarding working draft for XoraTV Eudor partners. Download the PDF to read it
              offline or share it with your team.
            </p>

            <a
              href={PDF_URL}
              download={PDF_FILENAME}
              aria-disabled={pending || undefined}
              className={cn(
                "press mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground shadow-card",
                pending && "pointer-events-none opacity-60",
              )}
            >
              <Download className="size-4" aria-hidden="true" />
              Download PDF
            </a>

            <p className="mt-3 text-center text-xs break-all text-muted-foreground">
              {pending ? "This PDF hasn't been uploaded yet." : PDF_FILENAME}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
