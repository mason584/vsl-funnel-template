import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { THANKS } from "@/content/thanks";
import { Breakouts } from "@/components/breakouts";
import { ConversionPing } from "@/components/conversion-ping";
import { VideoSlot } from "@/components/video-slot";
import { VisitPing } from "@/components/visit-ping";
import { ButtonLink } from "@/components/ui/primitives";
import { W } from "@/lib/wording";
import { outcomeFor } from "../actions";

/**
 * La page de remerciement — après la réservation.
 *
 * Bandeau de confirmation, vidéo principale, six vidéos courtes, renvoi vers
 * l'immersion. L'événement de conversion ne part **que si le serveur** a
 * vérifié que la session a réservé, et que le trafic vient de Meta : arriver
 * ici par l'URL renvoie sur la landing. C'est ce qui garantit qu'un faux
 * rendez-vous ne remonte jamais à Meta.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: W.thanksTitle,
  robots: { index: false, follow: false },
};

function formatSlot(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  })
    .format(date)
    .replace(":", "h");
}

export default async function ThanksPage({
  searchParams,
}: {
  searchParams: Promise<{ sid?: string }>;
}) {
  const { sid } = await searchParams;
  const outcome = sid ? await outcomeFor(sid) : null;
  if (!outcome || outcome.status !== "booked") redirect("/");

  const firstName = outcome.firstName ?? "";
  const slot = outcome.slotIso ? formatSlot(outcome.slotIso) : "";
  const fill = (text: string) =>
    text
      .replace(/\{prenom\}/g, firstName)
      .replace(/\{creneau\}/g, slot)
      .replace(/^\s*,\s*/, "")
      .replace(/\s+—\s*$/, "")
      .replace(/^(\p{L})/u, (c) => c.toUpperCase());

  return (
    <>
      <VisitPing path="/merci" />
      {outcome.fireMeta && <ConversionPing eventName={THANKS.metaEventName} eventId={sid!} />}

      <article className="mx-auto max-w-5xl px-5 pt-10 sm:px-10 sm:pt-14">
        {/* ── Confirmation ──────────────────────────────────────────────── */}
        <div
          role="status"
          className="flex items-start gap-4 rounded-lg border border-[var(--border-soft)] bg-[var(--panel)] px-5 py-5 shadow-[var(--shadow-soft)] sm:px-7"
        >
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--ok-soft)] text-[20px] text-[var(--ok)]"
          >
            ✓
          </span>
          <div>
            <p className="font-display text-[clamp(18px,2.2vw,24px)] leading-[1.2]">
              {fill(THANKS.banner.title)}
            </p>
            <p className="mt-1.5 text-sm text-[var(--text-secondary)]">{THANKS.banner.detail}</p>
          </div>
        </div>

        {/* ── Vidéo principale ─────────────────────────────────────────── */}
        <section className="mt-14 text-center">
          {THANKS.eyebrow && <p className="eyebrow">{THANKS.eyebrow}</p>}
          <h1 className="mt-3 font-display text-[clamp(30px,4.6vw,50px)] leading-[1.06]">
            {THANKS.headline}
          </h1>
          {THANKS.lede && (
            <p className="mx-auto mt-4 max-w-xl text-[16px] text-[var(--text-secondary)]">
              {THANKS.lede}
            </p>
          )}
          <div className="mt-8 text-left">
            <VideoSlot video={THANKS.mainVideo} caption={THANKS.mainVideoCaption} />
          </div>
        </section>

        {/* ── Les six vidéos courtes ───────────────────────────────────── */}
        <section className="mt-20">
          <div className="text-center">
            {THANKS.breakouts.eyebrow && <p className="eyebrow">{THANKS.breakouts.eyebrow}</p>}
            <h2 className="mt-3 font-display text-[clamp(26px,3.6vw,40px)] leading-[1.08]">
              {THANKS.breakouts.title}
            </h2>
            {THANKS.breakouts.lede && (
              <p className="mx-auto mt-3 max-w-lg text-[15px] text-[var(--text-secondary)]">
                {THANKS.breakouts.lede}
              </p>
            )}
          </div>
          <div className="mt-10">
            <Breakouts items={THANKS.breakouts.items} />
          </div>
        </section>

        {/* ── La suite ─────────────────────────────────────────────────── */}
        <section className="mt-20 rounded-lg border border-[var(--border-soft)] bg-[var(--panel-accent)] px-6 py-10 text-center">
          {THANKS.next.eyebrow && <p className="eyebrow">{THANKS.next.eyebrow}</p>}
          <h2 className="mt-3 font-display text-[clamp(24px,3.2vw,36px)] leading-[1.1]">
            {THANKS.next.title}
          </h2>
          {THANKS.next.lede && (
            <p className="mx-auto mt-3 max-w-md text-[15px] text-[var(--text-secondary)]">
              {THANKS.next.lede}
            </p>
          )}
          <div className="mt-6 flex justify-center">
            <ButtonLink href="/immersion">{THANKS.next.cta}</ButtonLink>
          </div>
        </section>
      </article>
    </>
  );
}
