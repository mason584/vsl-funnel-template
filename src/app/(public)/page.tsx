import type { Metadata } from "next";
import { headers } from "next/headers";
import { FORM } from "@/content/form";
import { LANDING } from "@/content/landing";
import { FormLoader } from "@/components/form/form-loader";
import { Testimonials } from "@/components/testimonials";
import { VideoSlot } from "@/components/video-slot";
import { VisitPing } from "@/components/visit-ping";
import { ButtonLink } from "@/components/ui/primitives";
import { resolveWordmark } from "@/lib/appearance";
import { getAppearance, getLogoVersion } from "@/lib/appearance-store";
import { FORM_INLINE, LANDING_PATH } from "@/lib/funnel";
import { defaultCountry } from "@/lib/phone";
import { getLockSettings } from "@/lib/settings";
import { Gate } from "./gate";

/**
 * La landing — l'entrée du tunnel, la page que l'ad pointe.
 *
 * Un titre, la VSL, puis la candidature derrière un décompte : le formulaire
 * lui-même sous la vidéo (`LANDING.form: "inline"`, le montage Savoire), ou
 * un bouton vers `/candidature`. Le réglage du verrou est lu à chaque
 * requête, côté serveur : l'administration doit pouvoir couper le décompte en
 * plein trafic sans redéploiement, et le lire côté navigateur ferait
 * clignoter l'état du verrou après l'hydratation.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: LANDING.meta.title,
  description: LANDING.meta.description,
};

export default async function LandingPage() {
  const [lock, appearance, logoVersion] = await Promise.all([
    getLockSettings(),
    getAppearance(),
    getLogoVersion(),
  ]);

  // Vercel géolocalise chaque requête : le menu d'indicatifs du formulaire
  // démarre sur le pays du visiteur. En local l'en-tête est absent — la France.
  const country = defaultCountry((await headers()).get("x-vercel-ip-country"));
  const mark = resolveWordmark(appearance, logoVersion);

  const application = FORM_INLINE ? (
    <div>
      <h2 className="font-display text-[clamp(24px,3.2vw,34px)] leading-[1.1]">{FORM.intro.title}</h2>
      <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-[var(--text-secondary)]">
        {FORM.intro.body}
      </p>
      <div className="mt-6">
        <FormLoader form={FORM} defaultDialCountry={country} wordmark={mark} embedded />
      </div>
    </div>
  ) : (
    <div className="text-center">
      <ButtonLink href="/candidature" className="px-8 text-[16px]">
        {LANDING.cta}
      </ButtonLink>
      {LANDING.ctaNote && (
        <p className="mx-auto mt-4 max-w-md text-sm text-[var(--text-muted)]">{LANDING.ctaNote}</p>
      )}
    </div>
  );

  return (
    <>
      <VisitPing path={LANDING_PATH} />

      <article className="mx-auto max-w-4xl px-5 pt-12 sm:px-10 sm:pt-16">
        <div className="mx-auto max-w-3xl text-center">
          {LANDING.eyebrow && <p className="eyebrow">{LANDING.eyebrow}</p>}
          <h1 className="mt-4 font-display text-[clamp(30px,4.6vw,50px)] leading-[1.08]">
            {LANDING.headline}
            {LANDING.figure && (
              <>
                {" "}
                <span className="text-[var(--accent)]">{LANDING.figure}</span>
              </>
            )}
          </h1>
          {LANDING.lede && (
            <p className="mx-auto mt-5 max-w-2xl text-[clamp(16px,2vw,19px)] leading-relaxed text-[var(--text-secondary)]">
              {LANDING.lede}
            </p>
          )}
          {LANDING.disclaimer && (
            <p className="mx-auto mt-5 max-w-2xl text-[13px] leading-relaxed text-[var(--text-muted)]">
              <span className="eyebrow mr-2">Disclaimer</span>
              {LANDING.disclaimer}
            </p>
          )}
        </div>

        <div className="mt-10">
          <VideoSlot video={LANDING.video} caption={LANDING.videoCaption} />
        </div>

        {LANDING.proof && (
          <p className="mt-5 text-center text-sm text-[var(--text-secondary)]">
            <span aria-hidden className="mr-2 tracking-[0.1em] text-[var(--accent)]">
              ★★★★★
            </span>
            {LANDING.proof}
          </p>
        )}

        <div className={`mx-auto mt-10 ${FORM_INLINE ? "max-w-3xl" : "max-w-xl"}`}>
          {lock.enabled ? (
            <Gate
              durationSeconds={lock.durationSeconds}
              title={LANDING.lock.title}
              hint={LANDING.lock.hint}
            >
              {application}
            </Gate>
          ) : (
            application
          )}
        </div>

        {/* ── Témoignages ──────────────────────────────────────────────── */}
        {LANDING.testimonials && (
          <section className="mt-24">
            <div className="text-center">
              {LANDING.testimonials.eyebrow && (
                <p className="eyebrow">{LANDING.testimonials.eyebrow}</p>
              )}
              <h2 className="mt-3 font-display text-[clamp(26px,3.6vw,40px)] leading-[1.08]">
                {LANDING.testimonials.title}
              </h2>
            </div>

            <div className="mt-10">
              <Testimonials items={LANDING.testimonials.items} />
            </div>

            {LANDING.testimonials.closingTitle && !FORM_INLINE && (
              <div className="mt-16 rounded-lg border border-[var(--border-soft)] bg-[var(--panel-accent)] px-6 py-10 text-center">
                <p className="font-display text-[clamp(22px,2.8vw,30px)]">
                  {LANDING.testimonials.closingTitle}
                </p>
                <div className="mt-6">{application}</div>
              </div>
            )}
          </section>
        )}
      </article>
    </>
  );
}
