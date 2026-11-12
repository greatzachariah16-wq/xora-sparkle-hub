import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Check, CircleHelp, Gift, LockKeyhole, Phone, ShieldCheck, Smartphone, Sparkles, Wifi } from "lucide-react";
import { AppShell } from "@/components/xora/AppShell";
import { cn } from "@/lib/utils";

const networks = [
  { id: "mtn", name: "MTN", short: "MTN" },
  { id: "airtel", name: "Airtel", short: "ATL" },
  { id: "glo", name: "Glo", short: "GLO" },
  { id: "9mobile", name: "9mobile", short: "9M" },
] as const;

const plans = [
  { id: "500mb", label: "500 MB", price: 300, tag: "Starter" },
  { id: "1gb", label: "1 GB", price: 450, tag: "Popular" },
  { id: "2gb", label: "2 GB", price: 800, tag: "Value" },
  { id: "5gb", label: "5 GB", price: 1900, tag: "Heavy use" },
];

function Data() {
  const [network, setNetwork] = useState<(typeof networks)[number]["id"]>("mtn");
  const [planId, setPlanId] = useState("1gb");
  const [phone, setPhone] = useState("");
  const selected = useMemo(() => plans.find((plan) => plan.id === planId) ?? plans[1], [planId]);
  const phoneValid = /^0\d{10}$/.test(phone);
  const canContinue = phoneValid && Boolean(selected);

  return (
    <AppShell wide>
      <div className="mx-auto max-w-3xl space-y-5">
        <section className="overflow-hidden rounded-[2rem] border border-border bg-surface shadow-card">
          <div className="bg-gradient-to-br from-clay-soft via-surface to-secondary p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-background/80 px-3 py-1.5 text-xs font-semibold text-primary"><Wifi className="size-3.5" /> Xora Data</span>
                <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Stay connected.</h1>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">Buy mobile data without leaving Xora. Your purchase can also unlock eligible Xora rewards.</p>
              </div>
              <div className="hidden size-16 shrink-0 place-items-center rounded-3xl bg-background/80 shadow-card sm:grid"><Smartphone className="size-7 text-primary" /></div>
            </div>
            <div className="mt-5 flex items-center gap-2 rounded-2xl border border-primary/15 bg-background/70 p-3 text-xs font-medium"><Gift className="size-4 shrink-0 text-primary" /><span>Launch offer: qualifying first purchases can receive a one-time 500 MB bonus.</span></div>
          </div>
        </section>
        <section className="rounded-3xl border border-border bg-surface p-4 shadow-card sm:p-5">
          <div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">1 · Network</p><h2 className="mt-1 font-display text-xl font-semibold">Choose a network</h2></div><CircleHelp className="size-5 text-muted-foreground" /></div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{networks.map((item) => <button key={item.id} type="button" onClick={() => setNetwork(item.id)} className={cn("press rounded-2xl border p-3 text-left", network === item.id ? "border-primary bg-primary/10 shadow-sm" : "border-border bg-background hover:bg-secondary")}><span className="grid size-9 place-items-center rounded-xl bg-secondary text-xs font-bold">{item.short}</span><span className="mt-2 block text-sm font-semibold">{item.name}</span>{network === item.id ? <Check className="mt-1 size-4 text-primary" /> : null}</button>)}</div>
        </section>
        <section className="rounded-3xl border border-border bg-surface p-4 shadow-card sm:p-5">
          <div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">2 · Data plan</p><h2 className="mt-1 font-display text-xl font-semibold">Pick your bundle</h2></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">{plans.map((plan) => <button key={plan.id} type="button" onClick={() => setPlanId(plan.id)} className={cn("press relative rounded-2xl border p-4 text-left", planId === plan.id ? "border-primary bg-primary/10 shadow-sm" : "border-border bg-background hover:bg-secondary")}><span className="absolute right-3 top-3 rounded-full bg-secondary px-2 py-1 text-[10px] font-semibold">{plan.tag}</span><p className="font-display text-2xl font-semibold">{plan.label}</p><p className="mt-1 text-sm text-muted-foreground">For your selected {networks.find((n) => n.id === network)?.name} line</p><p className="mt-4 text-lg font-bold">₦{plan.price.toLocaleString()}</p></button>)}</div>
        </section>
        <section className="rounded-3xl border border-border bg-surface p-4 shadow-card sm:p-5">
          <div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">3 · Recipient</p><h2 className="mt-1 font-display text-xl font-semibold">Where should we send it?</h2></div>
          <label className="mt-4 flex items-center gap-3 rounded-2xl border border-input bg-background px-4 py-3 focus-within:ring-2 focus-within:ring-ring"><Phone className="size-5 text-muted-foreground" /><input inputMode="numeric" autoComplete="tel" maxLength={11} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))} placeholder="08012345678" className="min-w-0 flex-1 bg-transparent text-base outline-none" aria-label="Recipient phone number" /></label>
          {phone.length > 0 && !phoneValid ? <p className="mt-2 text-xs text-destructive">Enter an 11-digit Nigerian phone number.</p> : null}
        </section>
        <section className="rounded-3xl border border-border bg-ink p-5 text-background shadow-lift sm:p-6">
          <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-background/60">Order summary</p><h2 className="mt-1 font-display text-2xl font-semibold">{selected.label} · {networks.find((n) => n.id === network)?.name}</h2><p className="mt-1 text-sm text-background/65">To {phone || "recipient number"}</p></div><p className="font-display text-2xl font-semibold">₦{selected.price.toLocaleString()}</p></div>
          <button type="button" disabled={!canContinue} className="press mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-background px-4 py-3.5 text-sm font-bold text-ink disabled:cursor-not-allowed disabled:opacity-40">Continue to payment <ArrowRight className="size-4" /></button>
          <div className="mt-4 grid gap-2 text-xs text-background/65 sm:grid-cols-3"><span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-3.5" /> Secure checkout</span><span className="inline-flex items-center gap-1.5"><LockKeyhole className="size-3.5" /> Protected payment</span><span className="inline-flex items-center gap-1.5"><Sparkles className="size-3.5" /> Rewards may apply</span></div>
        </section>
        <div className="flex items-center justify-between px-1 text-xs text-muted-foreground"><Link to="/learn" className="hover:text-foreground">Back to Learn</Link><span>Prices and availability are confirmed at checkout.</span></div>
      </div>
    </AppShell>
  );
}

export const Route = createFileRoute("/data")({
  head: () => ({ meta: [{ title: "Buy Data — Xora" }, { name: "description", content: "Buy mobile data on Xora." }] }),
  component: Data,
});
