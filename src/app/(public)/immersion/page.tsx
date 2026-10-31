import type { Metadata } from "next";
import { IMMERSION } from "@/content/immersion";
import { Testimonials } from "@/components/testimonials";
import { VideoSlot } from "@/components/video-slot";
import { VisitPing } from "@/components/visit-ping";

/**
 * La page d'immersion — les deux vidéos à regarder avant l'appel.
 *
 * Publique, hors index : le lien circule par email et depuis la page de
 * remerciement. Aucun événement de conversion n'y part — il est déjà parti sur
 * `/merci`. La visite est comptée : c'est la dernière marche de l'entonnoir,
 * celle qui dit combien de rendez-vous pris regardent ce qu'on leur envoie.
 *
 * Sous les deux vidéos, deux preuves facultatives : les témoignages (les
 * mêmes cartes que la landing) et un mur d'avis en captures.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: IMMERSION.meta.title,
  description: IMMERSION.meta.description,
  robots: { index: false, follow: false },
};

export default function ImmersionPage() {
  return (
    <>
      <VisitPing path="/immersion" />

      <article className="mx-auto max-w-4xl px-5 pt-12 sm:px-10 sm:pt-20">
        <div className="flex items-center justify-between gap-4">
          <span className="eyebrow">{IMMERSION.access}</span>
        </div>

        <h1 className="mt-5 max-w-3xl font-display text-[clamp(32px,4.8vw,54px)] leading-[1.06]">
          {IMMERSION.headline}
        </h1>
        <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-[var(--text-secondary)]">
          {IMMERSION.lede}
        </p>

        <div className="mt-16 flex flex-col gap-20">
          {IMMERSION.videos.map((video, i) => (
            <section key={video.title}>
              <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-[var(--border-strong)] pb-4">
                <div className="flex items-baseline gap-4">
                  <span className="font-display text-[34px] leading-none text-[var(--tan)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="eyebrow">{video.eyebrow}</p>
                    <h2 className="mt-2 max-w-2xl font-display text-[clamp(24px,2.8vw,34px)] leading-[1.1]">
                      {video.title}
                    </h2>
                  </div>
                </div>
                {video.duration && (
                  <span className="font-mono text-xs text-[var(--text-muted)]">{video.duration}</span>
                )}
              </div>

              <div className="mt-6">
                <VideoSlot video={video.video} caption={video.videoCaption} />
              </div>

              <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-[var(--text-secondary)]">
                {video.note}
              </p>

              {video.programme.length > 0 && (
                <div className="mt-7">
                  <p className="eyebrow mb-2">Au programme</p>
                  <ul className="list-none p-0">
                    {video.programme.map((item) => (
                      <li
                        key={item.text}
                        className="flex items-start gap-3 border-b border-[var(--border-soft)] py-3 text-[15px]"
                      >
                        <span aria-hidden className="mt-[3px] shrink-0 text-[var(--tan)]">
                          —
                        </span>
                        <span className={item.locked ? "text-[var(--text-muted)]" : "text-[var(--text-secondary)]"}>
                          {item.text}
                        </span>
                        {item.locked && (
                          <span className="ml-auto shrink-0 rounded bg-[var(--warn-bg)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--warn-text)]">
                            {IMMERSION.lockLabel}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          ))}
        </div>

        {/* ── Témoignages ──────────────────────────────────────────────── */}
        {IMMERSION.testimonials && (
          <section className="mt-24">
            <div className="text-center">
              {IMMERSION.testimonials.eyebrow && (
                <p className="eyebrow">{IMMERSION.testimonials.eyebrow}</p>
              )}
              <h2 className="mt-3 font-display text-[clamp(26px,3.6vw,40px)] leading-[1.08]">
                {IMMERSION.testimonials.title}
              </h2>
            </div>
            <div className="mt-10">
              <Testimonials items={IMMERSION.testimonials.items} />
            </div>
          </section>
        )}

        {/* ── Mur d'avis ───────────────────────────────────────────────── */}
        {IMMERSION.reviews && (
          <section className="mt-24">
            <div className="text-center">
              {IMMERSION.reviews.eyebrow && <p className="eyebrow">{IMMERSION.reviews.eyebrow}</p>}
              <h2 className="mt-3 font-display text-[clamp(26px,3.6vw,40px)] leading-[1.08]">
                {IMMERSION.reviews.title}
              </h2>
            </div>
            {/* Colonnes CSS : chaque capture garde sa hauteur, sans trous. */}
            <div className="mt-10 columns-1 gap-4 sm:columns-2 lg:columns-3">
              {IMMERSION.reviews.images.map((src) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={src}
                  src={src}
                  alt=""
                  loading="lazy"
                  className="mb-4 w-full break-inside-avoid rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--panel)]"
                />
              ))}
            </div>
          </section>
        )}
      </article>
    </>
  );
}
